(() => {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = 'pilot.css';
  document.head.append(stylesheet);

  const page = location.pathname.split('/').pop() || 'index.html';
  const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = value => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  const DEFAULT_WHATSAPP = '917977381156';
  let catalog = [], whatsapp = DEFAULT_WHATSAPP, cart = {};
  try {
    cart = JSON.parse(localStorage.getItem('shikhram-bag') || '{}');
    if (!cart || Array.isArray(cart) || typeof cart !== 'object') cart = {};
  } catch {
    cart = {};
  }

  const firebaseConfig = {
    apiKey: "AIzaSyBu8cSCao0611BYsAGTV8YfGevo4ztPTTM",
    authDomain: "shikhram-yoga.firebaseapp.com",
    projectId: "shikhram-yoga",
    storageBucket: "shikhram-yoga.firebasestorage.app",
    messagingSenderId: "406528833007",
    appId: "1:406528833007:web:65076494932c68fb64721a",
    measurementId: "G-8DFQ1LLD1W"
  };

  let db = null;
  function loadScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.append(s);
    });
  }

  let dbPromise = null;
  async function getDb() {
    if (db) return db;
    if (dbPromise) return dbPromise;
    dbPromise = (async () => {
      if (!window.firebase || !window.firebase.firestore) {
        await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');
      }
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      if (['localhost', '127.0.0.1'].includes(location.hostname) && location.port === '5005') {
        try { db.useEmulator('127.0.0.1', 8080); } catch (_) {}
      }
      return db;
    })();
    return dbPromise;
  }

  async function api(path, data) {
    const response = await fetch(path, {
      method: data ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('The booking backend is momentarily unavailable.');
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Request failed.');
    return result;
  }

  async function refresh() {
    // 1. Prioritize direct Firestore queries (100% reliable on Spark Free Plan)
    try {
      const firestore = await getDb();
      const snap = await firestore.collection('offers').where('active', '==', true).get();
      const now = new Date();
      catalog = [];
      snap.forEach(doc => {
        const o = doc.data();
        const allocated = typeof o.allocated === 'number' ? o.allocated : 0;
        const available = Math.max(0, (o.capacity || 0) - allocated);
        const expired = Boolean(o.start && new Date(o.start) <= now);
        if (!expired) {
          catalog.push({ ...o, available, expired: false });
        }
      });
      try {
        const s = await firestore.collection('settings').doc('public').get();
        if (s.exists && s.data().whatsapp) {
          whatsapp = String(s.data().whatsapp);
        } else if (!whatsapp) {
          whatsapp = DEFAULT_WHATSAPP;
        }
      } catch (e) {}
      if (catalog.length > 0) return catalog;
    } catch (err) {
      console.warn('Direct Firestore fetch attempt:', err);
    }

    // 2. Fallback to API if emulator or functions backend is active
    try {
      const data = await api('/api/catalog');
      if (data && data.offers) {
        catalog = data.offers || [];
        whatsapp = (data && data.whatsapp) ? data.whatsapp : (whatsapp || DEFAULT_WHATSAPP);
      }
      return catalog;
    } catch (_) {
      return catalog;
    }
  }

  async function submitDirect(payload, idempotency) {
    const firestore = await getDb();
    const idemRef = firestore.collection('idempotency').doc(idempotency);

    return await firestore.runTransaction(async (t) => {
      const existingIdem = await t.get(idemRef);
      if (existingIdem.exists) {
        return existingIdem.data().response;
      }

      const items = payload.items || [];
      const resolved = [];
      const seen = new Set();
      const now = new Date();

      for (const item of items) {
        if (!item || !item.id || seen.has(item.id)) throw new Error('Invalid or duplicate selection.');
        seen.add(item.id);

        const offerRef = firestore.collection('offers').doc(item.id);
        const offerDoc = await t.get(offerRef);
        if (!offerDoc.exists) throw new Error('This selection is no longer available.');

        const offer = offerDoc.data();
        const quantity = item.quantity || 1;
        const allocated = typeof offer.allocated === 'number' ? offer.allocated : 0;
        const available = Math.max(0, (offer.capacity || 0) - allocated);
        const expired = Boolean(offer.start && new Date(offer.start) <= now);

        if (!offer.active || expired) throw new Error('This selection is no longer available.');
        if (payload.kind !== 'waitlist' && quantity > available) {
          throw new Error('There are not enough spaces or stock. Please choose again.');
        }

        if (!['waitlist', 'corporate', 'partnership', 'match'].includes(payload.kind)) {
          t.update(offerRef, {
            allocated: allocated + quantity,
            updatedAt: new Date().toISOString()
          });
        }

        resolved.push({
          id: offer.id,
          title: offer.title,
          room: offer.room || null,
          start: offer.start || null,
          quantity,
          price: offer.price,
          deposit: offer.deposit || 0,
          balanceDate: offer.balanceDate || null
        });
      }

      const total = resolved.reduce((s, i) => s + (i.price * i.quantity), 0);
      const due = payload.kind === 'retreat'
        ? resolved.reduce((s, i) => s + (i.deposit * i.quantity), 0)
        : (payload.kind === 'shop' ? total : 0);

      const randomBytes = new Uint8Array(5);
      (window.crypto || window.msCrypto).getRandomValues(randomBytes);
      const requestId = 'SY-' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

      const statusMap = { waitlist: 'waitlist', session: 'requested', retreat: 'test_reserved', shop: 'test_order' };
      const status = statusMap[payload.kind] || 'new';
      const created = new Date().toISOString();

      const requestRecord = {
        id: requestId,
        idempotency,
        kind: payload.kind,
        customer: { name: (payload.name || '').trim(), contact: (payload.contact || '').trim() },
        details: payload.details || {},
        items: resolved,
        total,
        due,
        status,
        created
      };

      t.set(firestore.collection('requests').doc(requestId), requestRecord);
      t.set(idemRef, { requestId, response: requestRecord, created });
      return requestRecord;
    });
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'flow-dialog';
  dialog.setAttribute('aria-label', 'Booking and enquiries');
  document.body.append(dialog);

  const close = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
  dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));

  function view(content) {
    dialog.innerHTML = `<button class="flow-close" aria-label="Close">×</button><div class="fast-flow booking-pilot">${content}</div>`;
    dialog.querySelector('.flow-close').onclick = close;
    if (!dialog.open) {
      dialog.showModal();
      document.body.classList.add('modal-open');
    }
  }

  function fallback(context) {
    const cleanNumber = whatsapp.replace(/\D/g, '');
    return cleanNumber
      ? `<a class="whatsapp-fallback" target="_blank" rel="noopener" href="https://wa.me/${escape(cleanNumber)}?text=${encodeURIComponent(context)}">Chat on WhatsApp ↗</a>`
      : '<p class="inline-trust">WhatsApp contact is awaiting owner setup. You can save your request directly using this form.</p>';
  }

  const fields = `
    <label>Your name
      <input name="name" required maxlength="100" autocomplete="name" placeholder="Full name">
    </label>
    <label>Phone or email
      <input name="contact" required maxlength="160" autocomplete="email" placeholder="email@example.com or 10-digit phone">
    </label>
  `;

  async function submit(form, payload) {
    const button = form.querySelector('[type=submit],button:not([type])');
    if (button) button.disabled = true;
    form.querySelector('.flow-error')?.remove();

    const idempotency = form.dataset.idempotency || (form.dataset.idempotency = crypto.randomUUID());

    try {
      let result;
      try {
        result = await submitDirect(payload, idempotency);
      } catch (err) {
        result = await api('/api/request', { ...payload, idempotency });
      }
      if (payload.kind === 'shop') {
        cart = {};
        saveCart();
      }

      const title = {
        session: 'Session requested',
        retreat: 'Reservation request received',
        waitlist: 'You’re on the waitlist',
        corporate: 'Thanks — we’ll send a proposal within one working day.',
        partnership: 'Partnership enquiry received',
        match: ({ 'for-you.html': 'Consultation request received', 'nutrition.html': 'Nutrition consultation requested', 'retreats.html': 'Retreat enquiry received', 'sound-healing.html': 'Sound session requested' })[page] || 'Your teacher match request is saved',
        shop: 'Order request received'
      }[payload.kind] || 'Request received';

      view(`
        <span class="success-mark">✓</span>
        <h2>${title}</h2>
        <p>Reference <b>${escape(result.id)}</b></p>
        <p>${
          payload.kind === 'session'
            ? 'Your preferred time is held pending the team’s confirmation.'
            : payload.kind === 'waitlist'
            ? 'The team will contact you when a space opens. No payment is due.'
            : payload.kind === 'partnership'
            ? 'Thank you for reaching out. We will review your property or community concept and reply within one working day.'
            : payload.kind === 'match'
            ? (({
                'nutrition.html': 'Thank you. A certified holistic nutritionist will review your dietary goals and reply within one working day with consultation times and next steps.',
                'retreats.html': 'Thank you. We will reply within one working day with dates, room options and pricing for your chosen retreat. No payment is due now.',
                'sound-healing.html': 'Thank you. We will reply within one working day with available times for your sound session.'
              })[page] || 'Thank you. We will review your preferred practice and goals, then reply within one working day with a recommendation and clear next steps.')
            : payload.kind === 'retreat'
            ? 'We’ll confirm your place, room preference and deposit schedule by WhatsApp and email.'
            : payload.kind === 'shop'
            ? 'We’ll confirm availability, delivery details and the next step shortly.'
            : 'Your details are with the Shikhram team.'
        }</p>
        ${payload.kind === 'retreat' ? '<p class="inline-trust">No payment is collected until the team confirms your reservation.</p>' : ''}
        ${payload.kind === 'session' || payload.kind === 'retreat' ? `
          <div class="calendar-sync-row" style="justify-content: center; margin: 1.2rem 0;">
            <a class="cal-btn" id="confirm-google-cal" target="_blank" rel="noopener">📅 Add to Google Calendar</a>
            <button class="cal-btn" type="button" id="confirm-ics-cal">🍏 Apple Calendar (.ics)</button>
          </div>
        ` : ''}
        ${payload.kind !== 'shop' ? fallback('Hi, please help with my request ' + result.id) : ''}
        <button class="button" data-done>Done</button>
      `);

      if (window.shikhramCalendar && (payload.kind === 'session' || payload.kind === 'retreat')) {
        const item = (result.items && result.items[0]) || { title: title };
        const ev = { id: result.id, title: item.title, start: item.start };
        const gBtn = dialog.querySelector('#confirm-google-cal');
        if (gBtn) gBtn.href = window.shikhramCalendar.googleUrl(ev);
        const icsBtn = dialog.querySelector('#confirm-ics-cal');
        if (icsBtn) icsBtn.onclick = () => window.shikhramCalendar.downloadIcs(ev);
      }

      dialog.querySelector('[data-done]').onclick = close;
    } catch (error) {
      const p = document.createElement('p');
      p.className = 'flow-error';
      p.setAttribute('role', 'alert');
      p.textContent = error.message;
      form.append(p);
      if (button) button.disabled = false;
    }
  }

  function wireSubmit(kind, getDetails) {
    const form = dialog.querySelector('form');
    if (!form) return;
    form.onsubmit = e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      submit(form, {
        kind,
        name: data.name,
        contact: data.contact,
        ...getDetails(data)
      });
    };
  }

  async function launch(action, group) {
    view('<p role="status">Checking availability…</p>');
    try {
      await refresh();
      if (action === 'session') schedule(group);
      else if (action === 'retreat') retreat(group);
      else if (action === 'bag') bag();
      else proposal(group);
    } catch (error) {
      view(`
        <h2>Let’s reconnect.</h2>
        <p role="alert">${escape(error.message)}</p>
        <button class="button" data-retry>Try again</button>
      `);
      dialog.querySelector('[data-retry]').onclick = () => launch(action, group);
    }
  }

  function schedule(group) {
    const offerings = catalog.filter(o => o.kind === 'session' && (!group || o.group === group));
    const allSessions = catalog.filter(o => o.kind === 'session');
    const availableOfferings = offerings.length ? offerings : allSessions;
    const groups = [...new Set(availableOfferings.map(o => o.group))];

    if (!groups.length) {
      view('<h2>No sessions are currently scheduled.</h2><p>Please check back soon or message us.</p>' + fallback('Hi, I’d like to enquire about future yoga sessions.'));
      return;
    }

    view(`
      <p class="eyebrow">Book a practice</p>
      <h2>Make time for <em>yourself.</em></h2>
      <form>
        <label>Teacher or session
          <select name="service">
            ${groups.map(g => `<option value="${escape(g)}" ${g === group ? 'selected' : ''}>${escape(availableOfferings.find(o => o.group === g)?.title || g)}</option>`).join('')}
          </select>
        </label>
        <label>Your time · IST
          <select name="slot" required></select>
        </label>
        <p class="selected-service"></p>
        ${fields}
        <button class="button" type="submit">Request session</button>
        ${fallback('Hi, I’d like to book ' + (availableOfferings[0]?.title || 'a yoga session'))}
      </form>
    `);

    const form = dialog.querySelector('form');
    function update() {
      const available = availableOfferings.filter(o => o.group === form.elements.service.value && o.available > 0);
      form.elements.slot.innerHTML = available.map(o => `<option value="${escape(o.id)}">${escape(when(o.start))} · ${o.available} left</option>`).join('');
      const offer = available.find(o => o.id === form.elements.slot.value);
      dialog.querySelector('.selected-service').textContent = offer ? `${money(offer.price)} · ${offer.includes}` : 'No available times for this guide. Please choose another.';
      form.querySelector('[type=submit]').disabled = !offer;
    }

    form.elements.service.onchange = update;
    update();
    form.elements.slot.onchange = () => {
      const o = availableOfferings.find(o => o.id === form.elements.slot.value);
      if (o) dialog.querySelector('.selected-service').textContent = `${money(o.price)} · ${o.includes}`;
    };
    wireSubmit('session', data => ({ items: [{ id: data.slot, quantity: 1 }] }));
  }

  function retreat(group = 'rishikesh') {
    let offers = catalog.filter(o => o.kind === 'retreat' && o.group === group);
    if (!offers.length) {
      view(`
        <h2>Upcoming journeys</h2>
        <p>This retreat schedule is currently being refreshed for the season.</p>
        ${fallback('Hi, I’d like to enquire about the upcoming ' + (group ? group.charAt(0).toUpperCase() + group.slice(1) : '') + ' yoga retreat.')}
      `);
      return;
    }

    const available = offers.filter(o => o.available > 0);
    const waitlist = !available.length;
    if (!waitlist) offers = available;
    const first = offers[0];

    view(`
      <p class="eyebrow">${waitlist ? 'Join the waitlist' : 'Reserve your retreat'}</p>
      <h2>${escape(first.title)}</h2>
      <p>${escape(when(first.start))} · IST</p>
      <p>${escape(first.includes)}</p>
      <form>
        <label>Room
          <select name="room">
            ${offers.map(o => `<option value="${escape(o.id)}">${escape(o.room)} · ${money(o.price)} · ${o.available} places left</option>`).join('')}
          </select>
        </label>
        <label>Guests
          <select name="quantity"></select>
        </label>
        <p class="selected-service" aria-live="polite"></p>
        <details>
          <summary>Cancellation policy</summary>
          <p>${escape(first.policy)}</p>
        </details>
        ${fields}
        <label>
          <input type="checkbox" required> I have reviewed the room, balance schedule and cancellation policy.
        </label>
        <button class="button" type="submit">${waitlist ? 'Join waitlist · No payment' : 'Request reservation'}</button>
        <p class="inline-trust">${waitlist ? 'No deposit required.' : 'Your reservation is confirmed before any payment is collected.'}</p>
        ${fallback('Hi, I’d like to ' + (waitlist ? 'join the waitlist for ' : 'reserve ') + first.title)}
      </form>
    `);

    const form = dialog.querySelector('form');
    function price() {
      const o = offers.find(o => o.id === form.elements.room.value) || first;
      const n = Number(form.elements.quantity.value) || 1;
      dialog.querySelector('.selected-service').textContent = waitlist
        ? 'Waitlist · No payment required'
        : `${o.available} places left · Total ${money(o.price * n)} · Deposit ${money(o.deposit * n)} · Balance ${money((o.price - o.deposit) * n)} by ${o.balanceDate}`;
    }
    function rooms() {
      const o = offers.find(o => o.id === form.elements.room.value) || first;
      form.elements.quantity.innerHTML = Array.from({ length: waitlist ? 1 : Math.min(o.available, 6) }, (_, i) => `<option>${i + 1}</option>`).join('');
      price();
    }
    form.elements.room.onchange = rooms;
    form.elements.quantity.onchange = price;
    rooms();
    wireSubmit(waitlist ? 'waitlist' : 'retreat', data => ({ items: [{ id: data.room, quantity: Number(data.quantity) }] }));
  }

  function proposal(tier = 'Team Reset') {
    view(`
      <p class="eyebrow">Corporate wellness</p>
      <h2>Care for <em>your team.</em></h2>
      <p>Tailored pricing · Pune on-site or virtual · Teacher, session plan and setup guidance included. Availability confirmed in your proposal.</p>
      <form>
        <label>Company<input name="company" required maxlength="200" placeholder="Organisation name"></label>
        <label>Your name<input name="name" required maxlength="100" autocomplete="name" placeholder="Your name"></label>
        <label>Work email<input name="contact" type="email" required maxlength="160" autocomplete="email" placeholder="work@company.com"></label>
        <label>Team size
          <select name="teamSize">
            <option>1–20</option>
            <option>21–50</option>
            <option>51–150</option>
            <option>150+</option>
          </select>
        </label>
        <label>Preferred program
          <select name="tier">
            ${['Team Reset', 'Culture of Care', 'Leadership Retreat', 'Corporate sound bath'].map(t => `<option ${t === tier ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </label>
        <button class="button" type="submit">Request a proposal</button>
        ${fallback('Hi, I’d like a ' + tier + ' proposal for my team.')}
      </form>
    `);
    wireSubmit('corporate', data => ({ details: { company: data.company, teamSize: data.teamSize, tier: data.tier } }));
  }

  function saveCart() {
    try {
      localStorage.setItem('shikhram-bag', JSON.stringify(cart));
    } catch {}
    document.querySelectorAll('.icon-button span').forEach(el => {
      el.textContent = Object.values(cart).reduce((s, n) => s + Number(n), 0);
    });
  }

  function bag() {
    const products = catalog.filter(o => o.kind === 'product');
    const entries = Object.entries(cart).filter(([id, n]) => products.some(o => o.id === id) && Number.isInteger(n) && n > 0);
    const total = entries.reduce((s, [id, n]) => s + products.find(o => o.id === id).price * n, 0);

    view(`
      <p class="eyebrow">Your bag</p>
      <h2>Chosen with <em>intention.</em></h2>
      <div class="cart-items">
        ${entries.map(([id, n]) => {
          const o = products.find(p => p.id === id);
          return `
            <article>
              <div>
                ${escape(o.title)}
                <small>${money(o.price)} · ${o.available} in stock</small>
              </div>
              <label>Quantity
                <input aria-label="Quantity for ${escape(o.title)}" type="number" min="0" max="${o.available}" value="${n}" data-product="${id}">
              </label>
            </article>
          `;
        }).join('') || '<p>Your bag is empty.</p>'}
      </div>
      ${entries.length ? `
        <p class="selected-service">Total ${money(total)} · Delivery included</p>
        <form>
          ${fields}
          <label>Delivery address, city and PIN
            <textarea name="address" required maxlength="1000" autocomplete="street-address" placeholder="Flat/House, Street, City, PIN code"></textarea>
          </label>
          <p class="inline-trust">Order request · Dispatch estimate 3–5 working days</p>
          <button class="button" type="submit">Place order request · ${money(total)}</button>
        </form>
      ` : ''}
    `);

    dialog.querySelectorAll('[data-product]').forEach(input => {
      input.onchange = () => {
        if (!input.reportValidity()) return;
        const n = Number(input.value);
        if (n > 0) cart[input.dataset.product] = n;
        else delete cart[input.dataset.product];
        saveCart();
        bag();
      };
    });

    if (entries.length) {
      wireSubmit('shop', data => ({
        items: entries.map(([id, quantity]) => ({ id, quantity })),
        details: { address: data.address }
      }));
    }
  }

  // Bind trigger clicks
  document.querySelector('#booking-dialog')?.remove();
  document.querySelectorAll('.reserve-trigger,.waitlist-trigger').forEach(el => {
    el.onclick = e => { e.preventDefault(); launch('retreat', el.dataset.retreat); };
  });
  document.querySelectorAll('.card-actions .button[href="#book"]').forEach(el => {
    el.onclick = e => { e.preventDefault(); launch('session', el.closest('article').id); };
  });
  document.querySelectorAll('.fast-book-trigger').forEach(el => {
    el.onclick = e => {
      e.preventDefault();
      const service = el.dataset.service || '';
      const teacher = service.toLowerCase().includes('deepak') ? 'deepak' : 'shikhram';
      launch('session', teacher);
    };
  });
  document.querySelectorAll('.sound-session-grid .button').forEach((el, i) => {
    el.onclick = e => { e.preventDefault(); launch('session', ['reset', 'resonance', 'ritual'][i]); };
  });
  document.querySelectorAll('a[href="corporate.html#proposal"]').forEach(el => {
    if (el.closest('.corporate-sound-cta')) el.href = 'corporate.html?tier=sound#proposal';
  });
  document.querySelectorAll('.product-grid .price-row button,.product button').forEach((el, i) => {
    el.onclick = async e => {
      e.preventDefault();
      const id = ['mat', 'bowl', 'cushion'][i % 3];
      cart[id] = (cart[id] || 0) + 1;
      saveCart();
      launch('bag');
    };
  });
  document.querySelectorAll('.header-actions .icon-button').forEach(el => {
    el.onclick = e => { e.preventDefault(); launch('bag'); };
  });

  // Context-aware navigation and mobile sticky button
  const actions = {
    'teachers.html': ['Book a class', 'session'],
    'sound-healing.html': ['Book sound session', 'session'],
    'retreats.html': ['Reserve', 'retreat'],
    'corporate.html': ['Request proposal', 'proposal'],
    'shop.html': ['Bag', 'bag']
  };

  const action = actions[page];
  if (action) {
    const nav = document.querySelector('.header-actions .button');
    if (page === 'corporate.html') {
      if (nav) {
        nav.textContent = 'Request proposal';
        nav.onclick = e => {
          e.preventDefault();
          document.querySelector('#proposal')?.scrollIntoView({ behavior: 'smooth' });
        };
      }
    } else {
      const run = e => {
        e.preventDefault();
        launch(action[1], page === 'sound-healing.html' ? 'resonance' : undefined);
      };
      if (nav) {
        nav.textContent = action[0];
        nav.onclick = run;
      }

    }
  }

  if (page === 'corporate.html') {
    document.querySelectorAll('a[href="#proposal"]').forEach(el => {
      el.onclick = e => {
        e.preventDefault();
        document.querySelector('#proposal')?.scrollIntoView({ behavior: 'smooth' });
      };
    });
    const form = document.querySelector('form[data-flow="corporate"], #proposal form');
    if (form) {
      if (new URLSearchParams(location.search).get('tier') === 'sound') {
        const tierSelect = form.querySelector('select[name="tier"]');
        if (tierSelect) tierSelect.value = 'Corporate sound bath & deep acoustic reset';
      }
      form.onsubmit = e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(form));
        const contact = [d.email, d.phone].filter(Boolean).join(' · ');
        submit(form, {
          kind: 'corporate',
          name: (d.name || '').trim(),
          contact: contact || d.email || 'Contact provided',
          details: {
            company: d.company || '',
            teamSize: d.teamSize || '',
            tier: d.tier || '',
            notes: d.notes || ''
          }
        });
      };
    }
  }

  if (page === 'teachers.html') {
    const form = document.querySelector('form[data-flow="teacher"], .enquiry-panel form');
    if (form) {
      form.onsubmit = e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(form));
        const contact = [d.email, d.phone].filter(Boolean).join(' · ');
        submit(form, {
          kind: 'match',
          name: (d.name || '').trim(),
          contact: contact || d.email || 'Contact provided',
          details: {
            format: d.format || '',
            experience: d.experience || '',
            needs: d.notes || ''
          }
        });
      };
    }
  }

  if (page === 'partnerships.html') {
    const form = document.querySelector('form[data-flow="partnership"], #partner-enquiry form');
    if (form) {
      form.onsubmit = e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(form));
        const contact = [d.email, d.phone].filter(Boolean).join(' · ');
        submit(form, {
          kind: 'partnership',
          name: (d.name || '').trim(),
          contact: contact || d.email || 'Contact provided',
          details: {
            propertyOrOrg: d.property || '',
            partnerType: d.partnerType || '',
            notes: d.notes || ''
          }
        });
      };
    }
  }

  if (page === 'for-you.html') {
    const form = document.querySelector('form[data-flow="personal"], #personal-enquiry form');
    if (form) {
      form.onsubmit = e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(form));
        const contact = [d.email, d.phone].filter(Boolean).join(' · ');
        submit(form, {
          kind: 'match',
          name: (d.name || '').trim(),
          contact: contact || d.email || 'Contact provided',
          details: {
            format: d.format || '',
            interest: d.interest || '',
            needs: d.notes || ''
          }
        });
      };
    }
  }

  if (page === 'nutrition.html') {
    const form = document.querySelector('form[data-flow="nutrition"], #nutrition-enquiry form');
    if (form) {
      form.onsubmit = e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(form));
        const contact = [d.email, d.phone].filter(Boolean).join(' · ');
        submit(form, {
          kind: 'match',
          name: (d.name || '').trim(),
          contact: contact || d.email || 'Contact provided',
          details: {
            interest: 'Nutrition Consultation',
            goals: d.goals || '',
            diet: d.diet || '',
            format: d.format || '',
            notes: d.notes || ''
          }
        });
      };
    }
  }

  // Retreat and sound-healing enquiry forms (previously unhandled — they reloaded the page and were lost)
  [['retreats.html', 'retreat', 'Retreat enquiry', 'destination'],
   ['sound-healing.html', 'sound', 'Sound healing session', 'session']].forEach(([p, flow, interest, choiceField]) => {
    if (page !== p) return;
    const form = document.querySelector(`form[data-flow="${flow}"]`);
    if (!form) return;
    form.onsubmit = e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      submit(form, {
        kind: 'match',
        name: (d.name || '').trim(),
        contact: [d.email, d.phone].filter(Boolean).join(' · ') || 'Contact provided',
        details: { interest, choice: d[choiceField] || '', notes: d.notes || '' }
      });
    };
  });

  // Newsletter sign-ups (footer on every page + blog) — saved as enquiries of kind "newsletter"
  document.querySelectorAll('footer form, form[data-flow="newsletter"]').forEach(form => {
    form.onsubmit = async e => {
      e.preventDefault();
      const input = form.querySelector('input[type=email]');
      const button = form.querySelector('button');
      const email = (input?.value || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { input?.focus(); return; }
      button.disabled = true;
      const payload = { kind: 'newsletter', name: '', contact: email, details: { source: page } };
      const idempotency = crypto.randomUUID();
      try {
        try { await submitDirect(payload, idempotency); }
        catch (err) { await api('/api/request', { ...payload, idempotency }); }
        input.value = '';
        input.placeholder = 'Subscribed — thank you';
        button.textContent = '✓';
      } catch (err) {
        button.disabled = false;
        input.placeholder = 'Could not subscribe — please try again';
      }
    };
  });

  saveCart();

  // Dynamic catalog publishing: update existing elements & inject newly published offerings
  refresh().then(() => {
    // 1. WhatsApp link sync
    document.querySelectorAll('.enquiry-panel form').forEach(form => {
      const fbText = page === 'corporate.html'
        ? 'Hi, I’d like a corporate wellness proposal.'
        : (page === 'partnerships.html'
          ? 'Hi, I’d like to explore a wellness retreat partnership for our property or community.'
          : (page === 'for-you.html'
            ? 'Hi, I’d like to explore personal or community yoga with Shikhram.'
            : (page === 'nutrition.html'
              ? 'Hi, I’d like to book a holistic nutrition consultation with Shikhram.'
              : 'Hi, please help me choose a yoga teacher.')));
      form.insertAdjacentHTML('beforeend', fallback(fbText));
    });
    const cleanWhatsApp = (whatsapp || DEFAULT_WHATSAPP).replace(/\D/g, '') || DEFAULT_WHATSAPP;
    document.querySelectorAll('a[href*="wa.me/"]:not(.wa-popover-btn)').forEach(el => {
      el.href = el.href.replace(/wa.me\/\d+/, `wa.me/${cleanWhatsApp}`);
      if (!el.href.includes('text=')) {
        el.href += (el.href.includes('?') ? '&' : '?') + 'text=' + encodeURIComponent('Hi, I would like to connect with Shikhram Yoga');
      }
    });

    // 2. Shop page dynamic rendering
    if (page === 'shop.html') {
      const productGrid = document.querySelector('.product-grid');
      const products = catalog.filter(o => o.kind === 'product');

      // Update static products
      document.querySelectorAll('.product-grid .listing-card').forEach((el, i) => {
        const id = ['mat', 'bowl', 'cushion'][i];
        const o = products.find(p => p.id === id);
        if (o) {
          el.querySelector('.price-row b').textContent = money(o.price);
          const p = document.createElement('p');
          p.className = 'inline-trust';
          p.textContent = `${o.available} in stock · ${o.includes}`;
          el.querySelector('.price-row').before(p);
        }
      });

      // Inject dynamically created products from CMS
      products.forEach(p => {
        if (!['mat', 'bowl', 'cushion'].includes(p.id) && !document.querySelector(`[data-product-id="${p.id}"]`)) {
          const card = document.createElement('article');
          card.className = 'listing-card filter-item';
          card.dataset.tags = 'practice';
          card.dataset.productId = p.id;
          card.innerHTML = `
            <div class="listing-card-visual"><i class="product-shape" style="height:120px;width:120px;background:#3c3327;border-radius:6px"></i></div>
            <div class="listing-card-content">
              <p class="eyebrow">Practice essentials</p>
              <h2>${escape(p.title)}</h2>
              <p>${escape(p.includes)}</p>
              <p class="inline-trust">${p.available} in stock</p>
              <div class="price-row">
                <b>${money(p.price)}</b>
                <button aria-label="Add ${escape(p.title)} to bag">+</button>
              </div>
            </div>
          `;
          card.querySelector('button').onclick = e => {
            e.preventDefault();
            cart[p.id] = (cart[p.id] || 0) + 1;
            saveCart();
            launch('bag');
          };
          productGrid.append(card);
        }
      });
    }

    // 3. Retreats page (dates and prices disabled per user request)
    if (page === 'retreats.html') {
      // Dynamic schedule and pricing injection removed
    }

    // 4. Teachers page (schedules and pricing disabled per user request)
    if (page === 'teachers.html') {
      // Dynamic session price injection removed
    }

    // 5. Sound page dynamic session cards
    if (page === 'sound-healing.html') {
      document.querySelectorAll('.sound-session-grid article').forEach((el, i) => {
        const group = ['reset', 'resonance', 'ritual'][i];
        const o = catalog.find(o => o.group === group && o.available > 0);
        if (o) {
          const p = document.createElement('p');
          p.className = 'inline-trust';
          p.textContent = `${money(o.price)} · ${o.includes} · Next ${when(o.start)} IST`;
          el.querySelector('.button')?.before(p);
        }
      });
    }

    if (typeof window.refreshSearchAndFilter === 'function') {
      window.refreshSearchAndFilter();
    }
  }).catch(() => {});
})();
