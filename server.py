"""Local Shikhram booking pilot. Run: python3 server.py. No payments are processed."""
import datetime as dt
import hmac
import json
import os
from pathlib import Path
import secrets
import sqlite3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('SHIKHRAM_DB', str(ROOT / '.data/pilot.sqlite3')))
ADMIN = os.environ.get('SHIKHRAM_ADMIN_TOKEN') or secrets.token_urlsafe(24)
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))

def connect():
    con = sqlite3.connect(DB, timeout=15)
    con.row_factory = sqlite3.Row
    return con

def initialize():
    DB.parent.mkdir(parents=True, exist_ok=True)
    with connect() as con:
        con.executescript('CREATE TABLE IF NOT EXISTS offers(id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,idem TEXT UNIQUE,data TEXT NOT NULL,created TEXT NOT NULL);')
        if con.execute('SELECT COUNT(*) FROM offers').fetchone()[0]:
            return
        offers = []
        for key, name, price, minutes, capacity in [('shikhram','Shikhram',1200,60,1),('deepak','Deepak',1000,60,1),('kavita','Kavita',3000,60,1),('preeti','Preeti',3000,60,1),('reset','Sound Reset',700,30,6),('resonance','Resonance Journey',1200,60,8),('ritual','Private Sound Ritual',2500,75,1)]:
            for day in range(1,15):
                date = dt.datetime.now(IST).date() + dt.timedelta(days=day)
                offers.append(dict(id=f'{key}-{date}',kind='session',group=key,title=name,price=price,capacity=capacity,start=f'{date}T09:30:00+05:30',includes=f'{minutes} minutes · Guided practice · '+('Online & Private' if key in ('deepak','kavita','preeti') else 'Pune studio'),active=True))
        for key,title,date,price,deposit,capacity,nights in [('rishikesh','Return to the Source','2026-10-18',42000,8000,6,5),('sahyadri','Stillness in the Hills','2026-12-12',18500,5000,10,2),('goa','Breath by the Sea','2027-02-06',32000,7000,0,3)]:
            for room,extra in [('Shared twin',0),('Private room',14000)]:
                offers.append(dict(id=f'{key}-{room.split()[0].lower()}',kind='retreat',group=key,title=title,room=room,price=price+extra,deposit=deposit,capacity=capacity//2,start=f'{date}T14:00:00+05:30',balanceDate=str(dt.date.fromisoformat(date)-dt.timedelta(days=30)),includes=f'{nights} nights · Vegetarian meals · Daily yoga, breathwork and meditation · Led by Shikhram. Travel excluded.',policy='Demo policy: deposit refundable until 30 days before arrival; thereafter non-refundable. Subject to owner approval.',active=True))
        for key,title,price,stock in [('mat','Natural Cork Mat',4200,12),('bowl','Singing Bowl',2800,8),('cushion','Meditation Cushion',1850,15)]:
            offers.append(dict(id=key,kind='product',title=title,price=price,capacity=stock,includes='Free India delivery · Dispatch in 3–5 working days · Demo stock',active=True))
        con.executemany('INSERT INTO offers VALUES (?,?)',[(o['id'],json.dumps(o)) for o in offers])

def catalog(con):
    offers = [json.loads(r['data']) for r in con.execute('SELECT data FROM offers')]
    used = {}
    for row in con.execute('SELECT data FROM requests'):
        request = json.loads(row['data'])
        if request['status'] in ('cancelled','waitlist','new'):
            continue
        for item in request.get('items',[]):
            used[item['id']] = used.get(item['id'],0) + item['quantity']
    now = dt.datetime.now(IST)
    for offer in offers:
        offer['available'] = max(0, offer['capacity'] - used.get(offer['id'],0))
        offer['expired'] = bool(offer.get('start') and dt.datetime.fromisoformat(offer['start']) <= now)
    return offers

def clean(value, maximum=500):
    if not isinstance(value,str) or not value.strip() or len(value)>maximum:
        raise ValueError('Please complete the required details.')
    return value.strip()

def create_request(data):
    kind = data.get('kind')
    if kind not in ('session','retreat','shop','corporate','partnership','match','waitlist','newsletter'):
        raise ValueError('Unknown request type.')
    customer = dict(name=clean(data.get('name'),100),contact=clean(data.get('contact'),160))
    contact = customer['contact']
    if not ('@' in contact and '.' in contact.split('@')[-1]) and len(''.join(filter(str.isdigit,contact)))<10:
        raise ValueError('Enter a valid email or phone number.')
    idem = clean(data.get('idempotency'),100)
    with connect() as con:
        con.execute('BEGIN IMMEDIATE')
        previous = con.execute('SELECT data FROM requests WHERE idem=?',(idem,)).fetchone()
        if previous:
            return json.loads(previous['data'])
        offers = {o['id']:o for o in catalog(con)}
        items = data.get('items',[])
        if not isinstance(items,list) or len(items)>30 or (kind in ('session','retreat','waitlist') and len(items)!=1) or (kind=='shop' and not items):
            raise ValueError('Choose an available item first.')
        resolved, seen = [],set()
        for item in items:
            offer = offers.get(item.get('id'))
            quantity = item.get('quantity',1)
            if not offer or not offer['active'] or offer['expired'] or type(quantity) is not int or not 1<=quantity<=20 or offer['id'] in seen:
                raise ValueError('This selection is no longer available.')
            expected = 'product' if kind=='shop' else 'retreat' if kind=='waitlist' else kind
            if offer['kind']!=expected or (kind=='session' and quantity!=1):
                raise ValueError('Invalid selection for this booking.')
            if kind!='waitlist' and quantity>offer['available']:
                raise ValueError('There are not enough spaces or stock. Please choose again.')
            seen.add(offer['id'])
            resolved.append(dict(id=offer['id'],title=offer['title'],room=offer.get('room'),start=offer.get('start'),quantity=quantity,price=offer['price'],deposit=offer.get('deposit',0),balanceDate=offer.get('balanceDate')))
        details = data.get('details',{})
        if not isinstance(details,dict) or len(json.dumps(details))>3000:
            raise ValueError('Details are too long.')
        if kind=='corporate':
            for field in ('company','teamSize','tier'):
                clean(details.get(field),200)
        elif kind=='partnership':
            clean(details.get('partnerType','Other'),200)
        if kind=='shop':
            clean(details.get('address'),1000)
        total=sum(i['price']*i['quantity'] for i in resolved)
        due=sum(i['deposit']*i['quantity'] for i in resolved) if kind=='retreat' else total if kind=='shop' else 0
        request=dict(id='SY-'+secrets.token_hex(5).upper(),kind=kind,customer=customer,details=details,items=resolved,total=total,due=due if kind!='waitlist' else 0,status='waitlist' if kind=='waitlist' else 'new' if kind in ('corporate','partnership','match') else 'requested' if kind=='session' else 'test_reserved' if kind=='retreat' else 'test_order',created=dt.datetime.now(IST).isoformat())
        con.execute('INSERT INTO requests VALUES (?,?,?,?)',(request['id'],idem,json.dumps(request),request['created']))

        # Automatic enquiry notification log (local alert simulation)
        notif_file = ROOT / '.data/enquiry_notifications.log'
        notif_file.parent.mkdir(parents=True, exist_ok=True)
        with open(notif_file, 'a', encoding='utf-8') as f:
            f.write(f"[{request['created']}] ALERT TO aniket@shikhramyoga.com: New {kind.upper()} enquiry {request['id']} from {customer['name']} ({customer['contact']}) | Details: {json.dumps(details)}\n")
        print(f"\n🔔 [ALERT -> aniket@shikhramyoga.com] New {kind.upper()} enquiry: {request['id']} | {customer['name']} ({customer['contact']})\n")

        return request

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT),**kwargs)

    def reply(self,status,data):
        body=json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def admin(self):
        return hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+ADMIN)

    def do_GET(self):
        path=urlsplit(self.path).path
        if path.startswith('/api/'):
            if path=='/api/catalog':
                with connect() as con:
                    self.reply(200,dict(offers=[o for o in catalog(con) if o['active'] and not o['expired']],whatsapp=os.environ.get('SHIKHRAM_WHATSAPP','+91 79773 81156')))
            elif path=='/api/admin' and self.admin():
                with connect() as con:
                    self.reply(200,dict(offers=catalog(con),requests=[json.loads(r['data']) for r in con.execute('SELECT data FROM requests ORDER BY created DESC')]))
            else:
                self.reply(401,dict(error='Owner access required.'))
            return
        target=Path(self.translate_path(self.path)).resolve()
        if not target.is_relative_to(ROOT) or any(p.startswith('.') for p in target.relative_to(ROOT).parts) or (target!=ROOT and target.suffix.lower() not in ('.html','.css','.js','.png','.jpg','.jpeg','.webp','.svg','.woff','.woff2','.mp3','.mp4','.ico','.webmanifest','.json')):
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        super().do_HEAD()

    def do_POST(self):
        try:
            origin=self.headers.get('Origin')
            if origin and origin!='http://'+self.headers.get('Host',''):
                self.reply(403,dict(error='Please open the website on this server.'))
                return
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=16000:
                raise ValueError('Invalid request size.')
            data=json.loads(self.rfile.read(length))
            if not isinstance(data,dict):
                raise ValueError('Invalid request.')
            path=urlsplit(self.path).path
            if path=='/api/request':
                self.reply(201,create_request(data))
                return
            if not self.admin():
                self.reply(401,dict(error='Owner access required.'))
                return
            with connect() as con:
                con.execute('BEGIN IMMEDIATE')
                if path=='/api/admin/offer':
                    offer=data.get('offer',{})
                    clean(offer.get('id'),100)
                    clean(offer.get('title'),150)
                    clean(offer.get('includes'),1000)
                    if offer.get('kind') not in ('session','retreat','product') or type(offer.get('active')) is not bool:
                        raise ValueError('Invalid offering type.')
                    for field in ('capacity','price'):
                        if type(offer.get(field)) is not int or not 0<=offer[field]<=1000000:
                            raise ValueError('Price and capacity must be positive whole numbers.')
                    if offer['kind']!='product':
                        date=dt.datetime.fromisoformat(offer.get('start',''))
                        if date.tzinfo is None:
                            raise ValueError('Include a timezone in the date.')
                        clean(offer.get('group'),100)
                    if offer['kind']=='retreat':
                        clean(offer.get('room'),100)
                        clean(offer.get('policy'),2000)
                        dt.date.fromisoformat(offer.get('balanceDate',''))
                        if type(offer.get('deposit')) is not int or not 0<offer['deposit']<=offer['price']:
                            raise ValueError('Deposit must be between 1 and the total price.')
                    offer.pop('available',None)
                    offer.pop('expired',None)
                    con.execute('INSERT INTO offers VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',(offer['id'],json.dumps(offer)))
                elif path=='/api/admin/status':
                    row=con.execute('SELECT data FROM requests WHERE id=?',(data.get('id'),)).fetchone()
                    if not row:
                        raise ValueError('Request not found.')
                    request=json.loads(row['data'])
                    allowed={'requested':['confirmed','cancelled'],'confirmed':['cancelled'],'test_reserved':['cancelled'],'test_order':['fulfilled','cancelled'],'new':['contacted','cancelled'],'contacted':['cancelled'],'waitlist':['cancelled']}
                    if data.get('status') not in allowed.get(request['status'],[]):
                        raise ValueError('This status change is not available.')
                    request['status']=data['status']
                    con.execute('UPDATE requests SET data=? WHERE id=?',(json.dumps(request),request['id']))
                else:
                    raise ValueError('Unknown action.')
            self.reply(200,dict(ok=True))
        except (ValueError,TypeError,KeyError,AttributeError) as error:
            self.reply(400,dict(error=str(error) or 'Invalid request.'))

if __name__=='__main__':
    initialize()
    print('Website: http://127.0.0.1:4174/\nOwner: http://127.0.0.1:4174/admin.html\nOwner access key: '+ADMIN,flush=True)
    ThreadingHTTPServer(('127.0.0.1',4174),Handler).serve_forever()
