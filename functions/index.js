const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '64kb' }));

function clean(value, maximum = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error('Please complete the required details.');
  }
  return value.trim();
}

async function getWhatsAppNumber() {
  const envNumber = process.env.SHIKHRAM_WHATSAPP;
  if (envNumber && envNumber.trim()) {
    return envNumber.trim();
  }
  try {
    const doc = await db.collection('settings').doc('public').get();
    if (doc.exists && doc.data().whatsapp) {
      return String(doc.data().whatsapp).trim();
    }
  } catch (_) {}
  return '+91 79773 81156';
}

// Authentication middleware verifying Firebase Auth token and custom admin claim
async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Owner access required.' });
  }
  const token = authHeader.split('Bearer ')[1].trim();
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.admin) {
      return res.status(403).json({ error: 'Owner admin privileges required.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired owner token.' });
  }
}

const router = express.Router();

// GET /catalog - Public catalogue with live availability and verified WhatsApp contact
router.get('/catalog', async (req, res) => {
  try {
    const snapshot = await db.collection('offers').where('active', '==', true).get();
    const now = new Date();
    const offers = [];

    snapshot.forEach(doc => {
      const o = doc.data();
      const allocated = typeof o.allocated === 'number' ? o.allocated : 0;
      const available = Math.max(0, (o.capacity || 0) - allocated);
      const expired = Boolean(o.start && new Date(o.start) <= now);
      if (!expired) {
        offers.push({
          ...o,
          available,
          expired: false
        });
      }
    });

    const whatsapp = await getWhatsAppNumber();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ offers, whatsapp });
  } catch (err) {
    return res.status(500).json({ error: 'Unable to load catalogue.' });
  }
});

// POST /request - Idempotent, transaction-safe booking request creation
router.post('/request', async (req, res) => {
  try {
    const data = req.body || {};
    const kind = data.kind;
    if (!['session', 'retreat', 'shop', 'corporate', 'partnership', 'match', 'waitlist', 'newsletter'].includes(kind)) {
      throw new Error('Unknown request type.');
    }

    const customer = {
      name: clean(data.name, 100),
      contact: clean(data.contact, 160)
    };

    const contact = customer.contact;
    const isEmail = contact.includes('@') && contact.split('@').pop().includes('.');
    const digits = contact.replace(/\D/g, '');
    if (!isEmail && digits.length < 10) {
      throw new Error('Enter a valid email or phone number.');
    }

    const idem = clean(data.idempotency, 100);
    const idemRef = db.collection('idempotency').doc(idem);

    // Run within a Firestore transaction for atomic idempotency and capacity allocation
    const result = await db.runTransaction(async (t) => {
      const existingIdem = await t.get(idemRef);
      if (existingIdem.exists) {
        return existingIdem.data().response;
      }

      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length > 30 || (['session', 'retreat', 'waitlist'].includes(kind) && items.length !== 1) || (kind === 'shop' && items.length === 0)) {
        throw new Error('Choose an available item first.');
      }

      const resolved = [];
      const seen = new Set();
      const now = new Date();

      for (const item of items) {
        if (!item || !item.id) {
          throw new Error('Choose an available item first.');
        }
        if (seen.has(item.id)) {
          throw new Error('This selection is no longer available.');
        }
        seen.add(item.id);

        const offerRef = db.collection('offers').doc(item.id);
        const offerDoc = await t.get(offerRef);
        if (!offerDoc.exists) {
          throw new Error('This selection is no longer available.');
        }

        const offer = offerDoc.data();
        const quantity = item.quantity === undefined ? 1 : item.quantity;
        if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
          throw new Error('Invalid quantity selected.');
        }

        const allocated = typeof offer.allocated === 'number' ? offer.allocated : 0;
        const available = Math.max(0, (offer.capacity || 0) - allocated);
        const expired = Boolean(offer.start && new Date(offer.start) <= now);

        if (!offer.active || expired) {
          throw new Error('This selection is no longer available.');
        }

        const expectedKind = kind === 'shop' ? 'product' : (kind === 'waitlist' ? 'retreat' : kind);
        if (offer.kind !== expectedKind || (kind === 'session' && quantity !== 1)) {
          throw new Error('Invalid selection for this booking.');
        }

        if (kind !== 'waitlist' && quantity > available) {
          throw new Error('There are not enough spaces or stock. Please choose again.');
        }

        // Allocate capacity in transaction (Waitlist, Corporate, Partnerships and Matches do NOT allocate)
        if (kind !== 'waitlist' && kind !== 'corporate' && kind !== 'partnership' && kind !== 'match') {
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

      const details = (typeof data.details === 'object' && data.details !== null) ? data.details : {};
      if (JSON.stringify(details).length > 3000) {
        throw new Error('Details are too long.');
      }

      if (kind === 'corporate') {
        for (const field of ['company', 'teamSize', 'tier']) {
          clean(details[field], 200);
        }
      }
      if (kind === 'partnership') {
        for (const field of ['propertyOrOrg', 'partnerType', 'notes']) {
          clean(details[field], 1000);
        }
      }
      if (kind === 'shop') {
        clean(details.address, 1000);
      }

      // Recompute prices and deposits on the server (never trust client amounts)
      const total = resolved.reduce((s, i) => s + (i.price * i.quantity), 0);
      let due = 0;
      if (kind === 'retreat') {
        due = resolved.reduce((s, i) => s + (i.deposit * i.quantity), 0);
      } else if (kind === 'shop') {
        due = total;
      }

      const requestId = 'SY-' + crypto.randomBytes(5).toString('hex').toUpperCase();
      let status = 'new';
      if (kind === 'waitlist') {
        status = 'waitlist';
      } else if (kind === 'session') {
        status = 'requested';
      } else if (kind === 'retreat') {
        status = 'test_reserved';
      } else if (kind === 'shop') {
        status = 'test_order';
      }

      const created = new Date().toISOString();
      const requestRecord = {
        id: requestId,
        idempotency: idem,
        kind,
        customer,
        details,
        items: resolved,
        total,
        due,
        status,
        created
      };

      const requestRef = db.collection('requests').doc(requestId);
      t.set(requestRef, requestRecord);
      t.set(idemRef, {
        requestId,
        response: requestRecord,
        created
      });

      return requestRecord;
    });

    return res.status(201).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Invalid request.' });
  }
});

// GET /admin - Protected owner catalogue and request log
router.get('/admin', requireAdmin, async (req, res) => {
  try {
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
      offers.push({
        ...o,
        available,
        expired
      });
    });

    const requests = [];
    requestsSnap.forEach(doc => {
      requests.push(doc.data());
    });

    return res.status(200).json({ offers, requests });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load admin data.' });
  }
});

// POST /admin/offer - Create or update offerings with validation
router.post('/admin/offer', requireAdmin, async (req, res) => {
  try {
    const offer = req.body?.offer || {};
    clean(offer.id, 100);
    clean(offer.title, 150);
    clean(offer.includes, 1000);

    if (!['session', 'retreat', 'product'].includes(offer.kind) || typeof offer.active !== 'boolean') {
      throw new Error('Invalid offering type.');
    }

    for (const field of ['capacity', 'price']) {
      if (typeof offer[field] !== 'number' || !Number.isInteger(offer[field]) || offer[field] < 0 || offer[field] > 1000000) {
        throw new Error('Price and capacity must be positive whole numbers.');
      }
    }

    if (offer.kind !== 'product') {
      const parsedDate = new Date(offer.start || '');
      if (isNaN(parsedDate.getTime()) || (!String(offer.start).includes('+') && !String(offer.start).includes('Z'))) {
        throw new Error('Include a valid timezone in the date.');
      }
      clean(offer.group, 100);
    }

    if (offer.kind === 'retreat') {
      clean(offer.room, 100);
      clean(offer.policy, 2000);
      const balanceDate = new Date(offer.balanceDate || '');
      if (isNaN(balanceDate.getTime())) {
        throw new Error('Include a valid balance due date.');
      }
      if (typeof offer.deposit !== 'number' || !Number.isInteger(offer.deposit) || offer.deposit <= 0 || offer.deposit > offer.price) {
        throw new Error('Deposit must be between 1 and the total price.');
      }
    }

    delete offer.available;
    delete offer.expired;

    const offerRef = db.collection('offers').doc(offer.id);
    await db.runTransaction(async (t) => {
      const existing = await t.get(offerRef);
      const allocated = existing.exists && typeof existing.data().allocated === 'number' ? existing.data().allocated : 0;
      t.set(offerRef, {
        ...offer,
        allocated
      }, { merge: true });
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Invalid request.' });
  }
});

// DELETE /admin/offer/:id or POST /admin/delete-offer - Safely delete an offering
router.all(['/admin/offer/:id', '/admin/delete-offer'], requireAdmin, async (req, res) => {
  try {
    const id = req.params.id || req.body?.id;
    if (!id) throw new Error('Missing offering ID.');
    const offerRef = db.collection('offers').doc(id);
    const doc = await offerRef.get();
    if (!doc.exists) throw new Error('Offering not found.');
    await offerRef.delete();
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to delete offering.' });
  }
});

// POST /admin/status - Update booking/order status and release inventory on cancellation
router.post('/admin/status', requireAdmin, async (req, res) => {
  try {
    const { id, status: newStatus } = req.body || {};
    if (!id || !newStatus) {
      throw new Error('Missing request ID or status.');
    }

    const requestRef = db.collection('requests').doc(id);

    await db.runTransaction(async (t) => {
      const requestDoc = await t.get(requestRef);
      if (!requestDoc.exists) {
        throw new Error('Request not found.');
      }

      const requestData = requestDoc.data();
      const currentStatus = requestData.status;

      const allowedTransitions = {
        requested: ['confirmed', 'cancelled'],
        confirmed: ['cancelled'],
        test_reserved: ['cancelled'],
        test_order: ['fulfilled', 'cancelled'],
        new: ['contacted', 'cancelled'],
        contacted: ['cancelled'],
        waitlist: ['cancelled']
      };

      if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
        throw new Error('This status change is not available.');
      }

      // Single inventory release on cancellation
      const wasAllocated = ['requested', 'confirmed', 'test_reserved', 'test_order'].includes(currentStatus);
      if (newStatus === 'cancelled' && wasAllocated) {
        for (const item of (requestData.items || [])) {
          const offerRef = db.collection('offers').doc(item.id);
          const offerDoc = await t.get(offerRef);
          if (offerDoc.exists) {
            const currentAllocated = offerDoc.data().allocated || 0;
            const updatedAllocated = Math.max(0, currentAllocated - (item.quantity || 1));
            t.update(offerRef, {
              allocated: updatedAllocated,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      t.update(requestRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Invalid request.' });
  }
});

// Support both /api/* and /* paths seamlessly
app.use('/api', router);
app.use('/', router);

exports.api = functions.https.onRequest(app);

// Automatic Email Alerts for every new enquiry/booking arriving in Firestore
exports.sendEnquiryNotification = functions.firestore
  .document('requests/{requestId}')
  .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    const requestId = context.params.requestId;
    const kind = data.kind || 'enquiry';
    const customer = data.customer || {};
    const details = data.details || {};

    const alertSubject = `[Shikhram Alert] New ${kind.toUpperCase()} Enquiry · Ref ${requestId} (${customer.name || 'New Guest'})`;
    const alertBody = `
New enquiry received on Shikhram Yoga:

• Reference ID: ${requestId}
• Type: ${kind}
• Customer: ${customer.name || 'Not provided'}
• Contact: ${customer.contact || 'Not provided'}
• Submitted: ${data.created || new Date().toISOString()}

Details:
${JSON.stringify(details, null, 2)}

Action: Please reply within 1 working day as promised to the customer.
Admin Console: https://shikhramyoga.com/admin.html
    `.trim();

    console.log(`[ENQUIRY_NOTIFICATION_ALERT] ${alertSubject}\n${alertBody}`);

    // If RESEND_API_KEY is configured in Cloud Functions environment
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const https = require('https');
        const payload = JSON.stringify({
          from: 'Shikhram Yoga <notifications@shikhramyoga.com>',
          to: ['aniket@shikhramyoga.com'],
          subject: alertSubject,
          text: alertBody
        });

        const req = https.request('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        }, (res) => {
          console.log(`[RESEND_EMAIL_RESPONSE] Status: ${res.statusCode}`);
        });

        req.on('error', (e) => console.error('[RESEND_EMAIL_ERROR]', e));
        req.write(payload);
        req.end();
      } catch (err) {
        console.error('[ENQUIRY_NOTIFICATION_DISPATCH_FAIL]', err);
      }
    }
  });

