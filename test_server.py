import json
import tempfile
import unittest
from pathlib import Path
import server

class BookingTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.old=server.DB
        server.DB=Path(self.temp.name)/'test.sqlite3'
        server.initialize()
        with server.connect() as con:
            self.session=next(o for o in server.catalog(con) if o['kind']=='session' and o['capacity']==1)

    def tearDown(self):
        server.DB=self.old
        self.temp.cleanup()

    def request(self,**values):
        return server.create_request(dict(kind='session',name='Test Guest',contact='guest@example.com',idempotency='test-one',items=[dict(id=self.session['id'],quantity=1)],**values))

    def test_saved_request_and_idempotency(self):
        first=self.request()
        self.assertEqual(first['id'],self.request()['id'])
        with server.connect() as con:
            self.assertEqual(con.execute('SELECT COUNT(*) FROM requests').fetchone()[0],1)
            self.assertEqual(next(o for o in server.catalog(con) if o['id']==self.session['id'])['available'],0)

    def test_overbooking_rejected_and_cancellation_releases(self):
        first=self.request()
        payload=dict(kind='session',name='Second',contact='guest2@example.com',idempotency='test-two',items=[dict(id=self.session['id'],quantity=1)])
        with self.assertRaises(ValueError): server.create_request(payload)
        first['status']='cancelled'
        with server.connect() as con: con.execute('UPDATE requests SET data=? WHERE id=?',(json.dumps(first),first['id']))
        self.assertEqual(server.create_request(payload)['status'],'requested')

    def test_server_price_and_deposit_for_two_guests(self):
        result=server.create_request(dict(kind='retreat',name='Guest',contact='9876543210',idempotency='retreat',items=[dict(id='rishikesh-shared',quantity=2,price=1,deposit=1)]))
        self.assertEqual(result['total'],84000)
        self.assertEqual(result['due'],16000)

    def test_waitlist_does_not_charge(self):
        result=server.create_request(dict(kind='waitlist',name='Guest',contact='9876543210',idempotency='waitlist',items=[dict(id='goa-shared',quantity=1)]))
        self.assertEqual(result['due'],0)
        self.assertEqual(result['status'],'waitlist')

    def test_duplicate_items_and_wrong_kind_rejected(self):
        for items in ([dict(id='mat',quantity=1)], [dict(id=self.session['id'],quantity=1)]*2):
            with self.assertRaises(ValueError):
                server.create_request(dict(kind='session',name='Guest',contact='9876543210',idempotency='invalid',items=items))

    def test_shop_address_required(self):
        with self.assertRaises(ValueError):
            server.create_request(dict(kind='shop',name='Guest',contact='9876543210',idempotency='shop',items=[dict(id='mat',quantity=1)]))

if __name__=='__main__': unittest.main()
