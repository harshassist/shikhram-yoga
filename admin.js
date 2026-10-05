(() => {
  // Initialize Firebase Client SDK
  const firebaseConfig = {
    apiKey: "AIzaSyBu8cSCao0611BYsAGTV8YfGevo4ztPTTM",
    authDomain: "shikhram-yoga.firebaseapp.com",
    projectId: "shikhram-yoga",
    storageBucket: "shikhram-yoga.firebasestorage.app",
    messagingSenderId: "406528833007",
    appId: "1:406528833007:web:65076494932c68fb64721a",
    measurementId: "G-8DFQ1LLD1W"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Connect to local emulators when running locally on port 5005
  if (['localhost', '127.0.0.1'].includes(location.hostname) && location.port === '5005') {
    try {
      auth.useEmulator('http://127.0.0.1:9099');
      db.useEmulator('127.0.0.1', 8080);
    } catch (_) {}
  }

  let currentUser = null;
  let cachedToken = '';
  let data = { offers: [], requests: [] };

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const message = document.querySelector('#owner-message');

  async function getToken() {
    if (currentUser) {
      cachedToken = await currentUser.getIdToken();
    }
    return cachedToken;
  }

  async function api(path, body) {
    try {
      const token = await getToken();
      const r = await fetch(path, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Server error (' + r.status + ')');
      }
      return await r.json();
    } catch (err) {
      // Direct Firestore fallback for 100% Free Spark Plan
      if (path === '/api/admin' && !body) {
        const [offersSnap, requestsSnap] = await Promise.all([
          db.collection('offers').get(),
          db.collection('requests').orderBy('created', 'desc').get()
        ]);
        const now = new Date();
        const offers = [];
        offersSnap.forEach(doc => {
          const o = doc.data();
          const allocated = typeof o.allocated === 'number' ? o.allocated : 0;
          const available = Math.max(0, (o.capacity || 0) - allocated);
          const expired = Boolean(o.start && new Date(o.start) <= now);
          offers.push({ ...o, available, expired });
        });
        const requests = [];
        requestsSnap.forEach(doc => requests.push(doc.data()));
        return { offers, requests };
      }

      if (path === '/api/admin/offer' && body) {
        const offer = body.offer;
        const offerRef = db.collection('offers').doc(offer.id);
        const existing = await offerRef.get();
        const allocated = existing.exists && typeof existing.data().allocated === 'number' ? existing.data().allocated : 0;
        delete offer.available;
        delete offer.expired;
        await offerRef.set({ ...offer, allocated, updatedAt: new Date().toISOString() }, { merge: true });
        return { ok: true };
      }

      if ((path === '/api/admin/delete-offer' || path.startsWith('/api/admin/offer/')) && body) {
        const id = body.id || path.split('/').pop();
        await db.collection('offers').doc(id).delete();
        return { ok: true };
      }

      if (path === '/api/admin/status' && body) {
        const { id, status: newStatus } = body;
        const reqRef = db.collection('requests').doc(id);
        const reqDoc = await reqRef.get();
        if (!reqDoc.exists) throw new Error('Request not found.');
        const reqData = reqDoc.data();
        const currentStatus = reqData.status;

        // Inventory release on cancellation
        const wasAllocated = ['requested', 'confirmed', 'test_reserved', 'test_order'].includes(currentStatus);
        if (newStatus === 'cancelled' && wasAllocated) {
          for (const item of (reqData.items || [])) {
            const oRef = db.collection('offers').doc(item.id);
            const oDoc = await oRef.get();
            if (oDoc.exists) {
              const cur = oDoc.data().allocated || 0;
              await oRef.update({
                allocated: Math.max(0, cur - (item.quantity || 1)),
                updatedAt: new Date().toISOString()
              });
            }
          }
        }
        await reqRef.update({ status: newStatus, updatedAt: new Date().toISOString() });
        return { ok: true };
      }

      throw err;
    }
  }

  const transitions = {
    requested: ['confirmed', 'cancelled'],
    confirmed: ['cancelled'],
    test_reserved: ['cancelled'],
    test_order: ['fulfilled', 'cancelled'],
    new: ['contacted', 'cancelled'],
    contacted: ['cancelled'],
    waitlist: ['cancelled']
  };

  function requests() {
    const filter = document.querySelector('#request-filter')?.value || 'all';
    const statusFilter = document.querySelector('#status-filter')?.value || 'all';
    const searchQuery = (document.querySelector('#request-search')?.value || '').trim().toLowerCase();

    const filtered = data.requests.filter(r => {
      if (filter !== 'all' && r.kind !== filter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery) {
        const searchable = [
          r.id,
          r.customer?.name,
          r.customer?.contact,
          r.kind,
          r.status,
          ...(r.items || []).map(i => i.title),
          ...(r.items || []).map(i => i.room),
          ...Object.values(r.details || {})
        ].filter(Boolean).join(' ').toLowerCase();

        const terms = searchQuery.split(/\s+/).filter(Boolean);
        if (!terms.every(term => searchable.includes(term))) return false;
      }
      return true;
    });

    const countEl = document.querySelector('#request-count');
    if (countEl) {
      countEl.textContent = `Showing ${filtered.length} of ${data.requests.length} records`;
    }

    const statusBadgeClass = {
      confirmed: 'badge-confirmed',
      fulfilled: 'badge-fulfilled',
      requested: 'badge-requested',
      new: 'badge-new',
      contacted: 'badge-contacted',
      waitlist: 'badge-waitlist',
      cancelled: 'badge-cancelled'
    };

    const cardsHtml = filtered.map(r => {
      const contactStr = r.customer?.contact || '';
      const emailMatch = contactStr.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      const email = emailMatch ? emailMatch[1] : '';
      const phoneDigits = contactStr.replace(/[^0-9]/g, '');
      const waPhone = phoneDigits.length === 10 ? '91' + phoneDigits : phoneDigits;
      
      const guestName = r.customer?.name || 'Guest';
      const itemSummary = (r.items || []).map(i => i.title).join(', ') || (r.details?.choice ? `${r.details.interest} · ${r.details.choice}` : r.details?.interest) || r.kind;

      let waMsg = `Hi ${guestName}, this is Shikhram Yoga regarding your booking request for ${itemSummary} (Ref: ${r.id}).`;
      let mailSub = `Shikhram Yoga — Booking Reference ${r.id}`;
      let mailContent = `Hi ${guestName},\n\nThank you for reaching out to Shikhram Yoga regarding ${itemSummary} (Ref: ${r.id})...\n\nWarm regards,\nShikhram Yoga`;

      if (r.kind === 'partnership') {
        const partnerProperty = r.details?.propertyOrOrg || 'your property/community';
        waMsg = `Hi ${guestName}, this is Shikhram Yoga regarding your partnership enquiry for ${partnerProperty} (Ref: ${r.id}).`;
        mailSub = `Shikhram Yoga — Partnership Enquiry (Ref: ${r.id})`;
        mailContent = `Hi ${guestName},\n\nThank you for reaching out to Shikhram Yoga regarding a partnership for ${partnerProperty} (Ref: ${r.id}). We would love to explore collaborating.\n\nWarm regards,\nShikhram Yoga`;
      } else if (r.kind === 'corporate') {
        const comp = r.details?.company || 'your team';
        waMsg = `Hi ${guestName}, this is Shikhram Yoga regarding your corporate wellness enquiry for ${comp} (Ref: ${r.id}).`;
        mailSub = `Shikhram Yoga — Team Wellness Proposal (Ref: ${r.id})`;
        mailContent = `Hi ${guestName},\n\nThank you for reaching out to Shikhram Yoga regarding corporate wellness sessions for ${comp} (Ref: ${r.id})...\n\nWarm regards,\nShikhram Yoga`;
      }

      const waText = encodeURIComponent(waMsg);
      const mailSubject = encodeURIComponent(mailSub);
      const mailBody = encodeURIComponent(mailContent);

      const detailKeyLabels = {
        interest: 'Enquiry about',
        choice: 'Selected option',
        source: 'Signed up on',
        propertyOrOrg: 'Property / Organisation',
        partnerType: 'Partner Type',
        notes: 'Notes / Scope',
        company: 'Company / Organisation',
        teamSize: 'Team Size',
        tier: 'Preferred Tier / Format',
        address: 'Shipping Address'
      };

      const badgeCls = statusBadgeClass[r.status] || 'badge-requested';

      return `
        <article class="owner-request">
          <div class="request-header">
            <span class="eyebrow" style="margin:0">${esc(r.kind)}</span>
            <span class="status-badge ${badgeCls}">${esc((r.status || '').replaceAll('_', ' '))}</span>
          </div>
          <h3>${esc(r.customer?.name || 'Guest')}</h3>
          <p><strong>Contact:</strong> ${esc(contactStr)} · <small>Ref: ${esc(r.id)}</small></p>
          
          <div class="customer-actions">
            ${phoneDigits.length >= 10 ? `<a href="https://wa.me/${waPhone}?text=${waText}" target="_blank" rel="noopener" class="action-btn btn-whatsapp">💬 WhatsApp</a>` : ''}
            ${email ? `<a href="mailto:${email}?subject=${mailSubject}&body=${mailBody}" class="action-btn btn-email">✉️ Email</a>` : ''}
            ${phoneDigits.length >= 10 ? `<a href="tel:+${waPhone}" class="action-btn btn-call">📞 Call</a>` : ''}
          </div>

          ${(r.items || []).length ? `<p>${(r.items || []).map(i => `<strong>${esc(i.title)}</strong> ${esc(i.room || '')} × ${i.quantity}${i.start ? ' · ' + esc(i.start) : ''}`).join('<br>')}</p>` : ''}
          ${r.details && Object.keys(r.details).length ? `<p>${Object.entries(r.details).map(([k, v]) => `<strong>${esc(detailKeyLabels[k] || k)}:</strong> ${esc(v)}`).join(' · ')}</p>` : ''}
          ${r.due ? `<p><strong>Due:</strong> ₹${r.due.toLocaleString('en-IN')} · <strong>Total:</strong> ₹${r.total.toLocaleString('en-IN')}</p>` : ''}
          <small>${esc(new Date(r.created).toLocaleString('en-IN'))}</small>
          
          <div class="owner-toolbar">
            ${(transitions[r.status] || []).map(s => `
              <button class="button" data-request="${esc(r.id)}" data-status="${s}">
                ${s === 'cancelled' ? (['corporate', 'partnership', 'match', 'waitlist', 'newsletter'].includes(r.kind) ? 'Close enquiry' : 'Cancel request (releases inventory)') : s === 'confirmed' ? 'Confirm session' : s === 'fulfilled' ? 'Mark fulfilled' : 'Mark contacted'}
              </button>
            `).join('')}
          </div>
        </article>
      `;
    }).join('');

    const emptyStateHtml = data.requests.length === 0 ? `
      <div class="admin-empty-state">
        <div class="empty-icon-ring">✧</div>
        <h3>Your client pipeline is clear</h3>
        <p>No bookings or enquiries recorded yet. When guests book classes, request team wellness proposals, submit hotel partnerships, or order from the edit, they will appear here in real time.</p>
        <div class="empty-actions">
          <a href="index.html" target="_blank" class="button button-small">View website ↗</a>
        </div>
      </div>
    ` : `
      <div class="admin-empty-state" style="padding:3rem 1.5rem">
        <div class="empty-icon-ring" style="width:42px;height:42px;font-size:1.1rem">🔍</div>
        <h3 style="font-size:1.4rem">No matching requests</h3>
        <p>No records found matching your active search and filter criteria.</p>
      </div>
    `;

    document.querySelector('#owner-requests').innerHTML = filtered.length ? cardsHtml : emptyStateHtml;

    document.querySelectorAll('[data-request]').forEach(b => {
      b.onclick = async () => {
        b.disabled = true;
        try {
          await api('/api/admin/status', { id: b.dataset.request, status: b.dataset.status });
          await load();
          message.textContent = 'Status updated. Inventory adjusted accordingly.';
        } catch (e) {
          message.textContent = e.message;
          b.disabled = false;
        }
      };
    });
  }

  function exportCSV() {
    if (!data.requests || !data.requests.length) {
      alert('No requests available to export.');
      return;
    }

    const headers = [
      'Reference ID',
      'Created Date',
      'Customer Name',
      'Contact',
      'Type',
      'Status',
      'Items',
      'Due Amount (INR)',
      'Total Amount (INR)',
      'Details'
    ];

    const filter = document.querySelector('#request-filter')?.value || 'all';
    const statusFilter = document.querySelector('#status-filter')?.value || 'all';
    const searchQuery = (document.querySelector('#request-search')?.value || '').trim().toLowerCase();

    const exportData = data.requests.filter(r => {
      if (filter !== 'all' && r.kind !== filter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery) {
        const searchable = [
          r.id,
          r.customer?.name,
          r.customer?.contact,
          r.kind,
          r.status,
          ...(r.items || []).map(i => i.title),
          ...(r.items || []).map(i => i.room),
          ...Object.values(r.details || {})
        ].filter(Boolean).join(' ').toLowerCase();
        const terms = searchQuery.split(/\s+/).filter(Boolean);
        if (!terms.every(term => searchable.includes(term))) return false;
      }
      return true;
    });

    if (!exportData.length) {
      alert('No matching records found for current filters to export.');
      return;
    }

    const rows = exportData.map(r => {
      const itemsStr = (r.items || []).map(i => `${i.title} ${i.room || ''} (Qty: ${i.quantity})`).join('; ');
      const detailsStr = Object.entries(r.details || {}).map(([k, v]) => `${k}: ${v}`).join('; ');
      return [
        `"${(r.id || '').replace(/"/g, '""')}"`,
        `"${new Date(r.created).toLocaleString('en-IN').replace(/"/g, '""')}"`,
        `"${(r.customer?.name || '').replace(/"/g, '""')}"`,
        `"${(r.customer?.contact || '').replace(/"/g, '""')}"`,
        `"${(r.kind || '').replace(/"/g, '""')}"`,
        `"${(r.status || '').replace(/"/g, '""')}"`,
        `"${itemsStr.replace(/"/g, '""')}"`,
        r.due || 0,
        r.total || 0,
        `"${detailsStr.replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `shikhram-requests-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function editor() {
    const picker = document.querySelector('#offer-picker');
    const offer = data.offers.find(o => o.id === picker.value);
    const form = document.querySelector('#offer-editor');
    if (!offer) {
      form.innerHTML = '';
      return;
    }

    const fields = [
      'title', 'price', 'capacity', 'includes',
      ...(offer.kind !== 'product' ? ['group', 'start'] : []),
      ...(offer.kind === 'retreat' ? ['room', 'deposit', 'balanceDate', 'policy'] : [])
    ];

    form.innerHTML = `
      <p class="full"><strong>ID:</strong> ${esc(offer.id)} · <strong>Available:</strong> ${offer.available} of ${offer.capacity}${offer.expired ? ' · <em>Past date</em>' : ''}</p>
      ${fields.map(f => `
        <label class="${['includes', 'policy'].includes(f) ? 'full' : ''}">
          ${esc(({
            title: 'Offering Title',
            price: 'Price (INR)',
            capacity: 'Total Capacity / Stock',
            start: 'Start Date & Time (ISO with timezone, e.g. 2026-10-18T14:00:00+05:30)',
            group: 'Group identifier (e.g. shikhram, resonance, rishikesh)',
            includes: 'What’s Included',
            room: 'Room Type (e.g. Shared twin, Private room)',
            deposit: 'Deposit Amount (INR)',
            balanceDate: 'Balance Due Date (YYYY-MM-DD)',
            policy: 'Cancellation & Booking Policy'
          })[f] || f)}
          ${['includes', 'policy'].includes(f)
            ? `<textarea name="${f}" required>${esc(offer[f])}</textarea>`
            : `<input name="${f}" value="${esc(offer[f])}" ${['price', 'capacity', 'deposit'].includes(f) ? 'type="number" min="0" step="1"' : ''} required>`}
        </label>
      `).join('')}
      <label class="full">
        <input type="checkbox" name="active" ${offer.active ? 'checked' : ''}> Published (visible on website)
      </label>
      <div class="full owner-toolbar">
        <button class="button" type="submit">Save changes</button>
        ${offer.kind === 'session' ? '<button class="text-link" type="button" id="duplicate-session">Duplicate session with new date</button>' : ''}
        <button class="button btn-delete-offer" type="button" id="delete-offer-btn" style="margin-left:auto">Delete offering 🗑</button>
      </div>
    `;

    async function save(duplicate = false) {
      const values = Object.fromEntries(new FormData(form));
      for (const f of ['price', 'capacity', 'deposit']) {
        if (f in values) values[f] = Number(values[f]);
      }
      const updated = {
        ...offer,
        ...values,
        active: form.elements.active.checked
      };
      if (duplicate) {
        updated.id = offer.group + '-' + crypto.randomUUID().slice(0, 8);
      }
      try {
        await api('/api/admin/offer', { offer: updated });
        await load(updated.id);
        message.textContent = duplicate ? 'New session duplicated and published.' : 'Offering updated.';
      } catch (e) {
        message.textContent = e.message;
      }
    }

    form.onsubmit = e => { e.preventDefault(); save(false); };
    form.querySelector('#duplicate-session')?.addEventListener('click', () => {
      if (form.reportValidity()) save(true);
    });
    form.querySelector('#delete-offer-btn')?.addEventListener('click', async () => {
      const confirmed = window.confirm(`Are you sure you want to permanently delete "${offer.title}" (${offer.id})?\n\nThis will remove it from the catalogue.`);
      if (!confirmed) return;
      try {
        await api('/api/admin/delete-offer', { id: offer.id });
        message.textContent = `Offering "${offer.title}" was deleted.`;
        await load();
      } catch (err) {
        message.textContent = 'Failed to delete offering: ' + err.message;
      }
    });
  }

  function renderNewOfferingForm() {
    const form = document.querySelector('#offer-editor');
    form.innerHTML = `
      <h3 class="full">Create a brand new offering</h3>
      <label>
        Kind
        <select name="kind" id="new-offer-kind">
          <option value="session">Session (Class or Sound Meditation)</option>
          <option value="retreat">Retreat</option>
          <option value="product">Shop Product</option>
        </select>
      </label>
      <label>
        Unique ID (slug)
        <input name="id" required placeholder="e.g. ananya-2026-11-01, dharamsala-shared, eye-pillow">
      </label>
      <label>
        Title
        <input name="title" required placeholder="Offering Title">
      </label>
      <label>
        Group / Series
        <input name="group" required placeholder="e.g. ananya, dharamsala">
      </label>
      <label>
        Price (INR)
        <input name="price" type="number" min="0" step="1" required placeholder="1200">
      </label>
      <label>
        Capacity / Stock
        <input name="capacity" type="number" min="0" step="1" required placeholder="10">
      </label>
      <div id="kind-specific-fields" class="full" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;"></div>
      <label class="full">
        What’s Included
        <textarea name="includes" required placeholder="Inclusions, duration, location, details"></textarea>
      </label>
      <label class="full">
        <input type="checkbox" name="active" checked> Published immediately
      </label>
      <div class="full owner-toolbar">
        <button class="button" type="submit">Publish new offering</button>
        <button class="text-link" type="button" id="btn-cancel-new">Cancel</button>
      </div>
    `;

    const kindSelect = form.querySelector('#new-offer-kind');
    const specificFields = form.querySelector('#kind-specific-fields');

    function updateSpecific() {
      const k = kindSelect.value;
      if (k === 'product') {
        specificFields.innerHTML = '';
        form.querySelector('[name=group]').value = 'shop';
        form.querySelector('[name=group]').parentElement.style.display = 'none';
      } else if (k === 'session') {
        form.querySelector('[name=group]').parentElement.style.display = 'grid';
        specificFields.innerHTML = `
          <label class="full">
            Start Date & Time (ISO with timezone)
            <input name="start" required placeholder="2026-11-01T09:30:00+05:30" value="${new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10)}T09:30:00+05:30">
          </label>
        `;
      } else if (k === 'retreat') {
        form.querySelector('[name=group]').parentElement.style.display = 'grid';
        specificFields.innerHTML = `
          <label>
            Room Type
            <input name="room" required placeholder="e.g. Shared twin, Private cottage">
          </label>
          <label>
            Deposit (INR)
            <input name="deposit" type="number" min="1" step="1" required placeholder="8000">
          </label>
          <label>
            Start Date & Time
            <input name="start" required placeholder="2026-11-20T14:00:00+05:30" value="2026-11-20T14:00:00+05:30">
          </label>
          <label>
            Balance Due Date
            <input name="balanceDate" required placeholder="2026-10-20" value="2026-10-20">
          </label>
          <label class="full">
            Cancellation Policy
            <textarea name="policy" required>Deposit refundable until 30 days before retreat start date. Balance due 30 days prior.</textarea>
          </label>
        `;
      }
    }

    kindSelect.onchange = updateSpecific;
    updateSpecific();

    form.querySelector('#btn-cancel-new').onclick = () => editor();

    form.onsubmit = async (e) => {
      e.preventDefault();
      const vals = Object.fromEntries(new FormData(form));
      for (const f of ['price', 'capacity', 'deposit']) {
        if (f in vals) vals[f] = Number(vals[f]);
      }
      const newOffer = {
        id: vals.id.trim(),
        kind: vals.kind,
        title: vals.title.trim(),
        group: vals.group?.trim() || vals.id.trim(),
        price: vals.price,
        capacity: vals.capacity,
        includes: vals.includes.trim(),
        active: form.elements.active.checked
      };
      if (vals.kind !== 'product') {
        newOffer.start = vals.start.trim();
      }
      if (vals.kind === 'retreat') {
        newOffer.room = vals.room.trim();
        newOffer.deposit = vals.deposit;
        newOffer.balanceDate = vals.balanceDate.trim();
        newOffer.policy = vals.policy.trim();
      }

      try {
        await api('/api/admin/offer', { offer: newOffer });
        await load(newOffer.id);
        message.textContent = `New ${newOffer.kind} "${newOffer.title}" published! It is now live on the website.`;
      } catch (err) {
        message.textContent = err.message;
      }
    };
  }

  async function load(selected) {
    message.textContent = 'Loading...';
    try {
      data = await api('/api/admin');
      message.textContent = '';
      document.querySelector('#owner-login').hidden = true;
      document.querySelector('#owner-content').hidden = false;

      // Calculate financial and operational metrics
      const confirmedRevenue = data.requests
        .filter(r => ['confirmed', 'fulfilled'].includes(r.status))
        .reduce((sum, r) => sum + (Number(r.total) || Number(r.due) || 0), 0);

      const pendingRevenue = data.requests
        .filter(r => ['requested', 'test_reserved', 'test_order'].includes(r.status))
        .reduce((sum, r) => sum + (Number(r.total) || Number(r.due) || 0), 0);

      const pendingCount = data.requests.filter(r => r.status === 'requested').length;
      const newEnquiries = data.requests.filter(r => r.status === 'new').length;
      const waitlistCount = data.requests.filter(r => r.status === 'waitlist').length;

      document.querySelector('#owner-stats').innerHTML = [
        ['Total Requests', data.requests.length],
        ['Confirmed Revenue', '₹' + confirmedRevenue.toLocaleString('en-IN')],
        ['Pending Value', '₹' + pendingRevenue.toLocaleString('en-IN')],
        ['Pending Sessions', pendingCount],
        ['Team & Partner Leads', newEnquiries],
        ['Waitlist', waitlistCount]
      ].map(([label, val]) => `<article><strong>${val}</strong><span>${label}</span></article>`).join('');

      // Populate offer picker if present
      const picker = document.querySelector('#offer-picker');
      if (picker) {
        const old = selected || picker.value;
        picker.innerHTML = data.offers.map(o => `
          <option value="${esc(o.id)}">${esc(o.title)} · ${esc(o.room || o.start?.slice(0, 10) || 'Shop')} · ${o.available}/${o.capacity} left${!o.active ? ' [Unpublished]' : ''}</option>
        `).join('');
        if (data.offers.some(o => o.id === old)) {
          picker.value = old;
        }
      }

      requests();
      if (picker && document.querySelector('#offer-editor')) {
        editor();
      }
    } catch (e) {
      message.textContent = e.message;
      if (e.message.includes('Owner access required') || e.message.includes('privileges required')) {
        document.querySelector('#owner-login').hidden = false;
        document.querySelector('#owner-content').hidden = true;
      }
    }
  }

  // Handle Firebase Auth state
  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
      try {
        await load();
      } catch (err) {
        message.textContent = err.message;
      }
    } else {
      document.querySelector('#owner-login').hidden = false;
      document.querySelector('#owner-content').hidden = true;
    }
  });

  let isSignUpMode = false;
  const toggleBtn = document.querySelector('#auth-toggle-btn');
  const modeTitle = document.querySelector('#auth-mode-title');
  const submitBtn = document.querySelector('#auth-submit-btn');

  if (toggleBtn) {
    toggleBtn.onclick = () => {
      isSignUpMode = !isSignUpMode;
      if (isSignUpMode) {
        modeTitle.textContent = 'Create owner account';
        submitBtn.textContent = 'Create account';
        toggleBtn.textContent = 'Already have an account? Sign in';
      } else {
        modeTitle.textContent = 'Sign in as owner';
        submitBtn.textContent = 'Sign in';
        toggleBtn.textContent = 'First time? Create owner account';
      }
    };
  }

  // Login / Signup form handler
  document.querySelector('#owner-login').onsubmit = async (e) => {
    e.preventDefault();
    message.textContent = isSignUpMode ? 'Creating account...' : 'Verifying credentials...';
    const email = e.target.elements.email.value.trim();
    const password = e.target.elements.password.value;
    try {
      if (isSignUpMode) {
        await auth.createUserWithEmailAndPassword(email, password);
      } else {
        await auth.signInWithEmailAndPassword(email, password);
      }
      message.textContent = '';
      e.target.reset();
    } catch (error) {
      message.textContent = error.message;
    }
  };

  document.querySelector('#owner-refresh')?.addEventListener('click', () => load().catch(e => { message.textContent = e.message; }));
  
  document.querySelector('#owner-clear-records')?.addEventListener('click', async () => {
    const confirmClear = window.confirm('Are you sure you want to permanently clear all enquiries and requests?\n\nThis will reset your request count and pipeline to 0.');
    if (!confirmClear) return;
    try {
      message.textContent = 'Clearing database...';
      const snap = await db.collection('requests').get();
      const batch = db.batch();
      snap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // Reset offer allocations
      const offersSnap = await db.collection('offers').get();
      const offerBatch = db.batch();
      let hasAllocations = false;
      offersSnap.forEach(doc => {
        if (doc.data().allocated > 0) {
          offerBatch.update(doc.ref, { allocated: 0, updatedAt: new Date().toISOString() });
          hasAllocations = true;
        }
      });
      if (hasAllocations) await offerBatch.commit();

      await load();
      message.textContent = 'Database wiped successfully. Pipeline is now clear.';
    } catch (e) {
      message.textContent = 'Error clearing records: ' + e.message;
    }
  });

  document.querySelector('#owner-logout')?.addEventListener('click', async () => {
    await auth.signOut();
    location.reload();
  });

  document.querySelector('#request-filter')?.addEventListener('change', requests);
  document.querySelector('#status-filter')?.addEventListener('change', requests);
  document.querySelector('#request-search')?.addEventListener('input', requests);
  document.querySelector('#btn-export-csv')?.addEventListener('click', exportCSV);
  document.querySelector('#offer-picker')?.addEventListener('change', editor);
  document.querySelector('#btn-new-offering')?.addEventListener('click', renderNewOfferingForm);

  // Automatically remove emulator notice banner for a clean, executive interface
  const removeEmulatorNotice = () => {
    document.querySelectorAll('.firebase-emulator-warning, div[style*="Running in emulator mode"]').forEach(el => el.remove());
  };
  removeEmulatorNotice();
  try {
    new MutationObserver(removeEmulatorNotice).observe(document.body, { childList: true, subtree: true });
  } catch (_) {}
})();
