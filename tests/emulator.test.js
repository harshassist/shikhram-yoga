const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const projectId = process.env.GCLOUD_PROJECT || 'shikhram-yoga';
process.env.GCLOUD_PROJECT = projectId;

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}
const db = admin.firestore();
const auth = admin.auth();

const API_BASE = process.env.API_BASE || `http://127.0.0.1:5001/${projectId}/us-central1/api`;

async function fetchJson(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

describe('Shikhram Yoga — Firebase Backend & Architecture Verification', () => {
  let adminIdToken = '';
  let normalIdToken = '';
  const adminEmail = `admin-${Date.now()}@shikhramyoga.com`;
  const normalEmail = `guest-${Date.now()}@example.com`;
  const password = 'SecurePassword123!';

  before(async () => {
    // 1. Create Normal User
    const normalUser = await auth.createUser({ email: normalEmail, password });
    
    // 2. Create Admin User and set custom claim { admin: true }
    const adminUser = await auth.createUser({ email: adminEmail, password });
    await auth.setCustomUserClaims(adminUser.uid, { admin: true });

    // 3. Obtain ID tokens via Auth Emulator REST API
    async function login(email, pass) {
      const res = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, returnSecureToken: true })
      });
      const json = await res.json();
      return json.idToken;
    }

    normalIdToken = await login(normalEmail, password);
    adminIdToken = await login(adminEmail, password);

    // 4. Seed test offerings in Firestore
    await db.collection('offers').doc('test-session-solo').set({
      id: 'test-session-solo',
      kind: 'session',
      group: 'shikhram',
      title: 'Solo Test Session',
      price: 1200,
      capacity: 1,
      allocated: 0,
      start: new Date(Date.now() + 86400000 * 5).toISOString(),
      includes: '60 minutes · Pune Studio',
      active: true
    });

    await db.collection('offers').doc('test-retreat-shared').set({
      id: 'test-retreat-shared',
      kind: 'retreat',
      group: 'rishikesh',
      title: 'Return to the Source',
      room: 'Shared twin',
      price: 42000,
      deposit: 8000,
      capacity: 10,
      allocated: 0,
      start: new Date(Date.now() + 86400000 * 30).toISOString(),
      balanceDate: '2026-09-18',
      includes: '5 nights · Meals included',
      policy: 'Demo policy: deposit refundable until 30 days before arrival.',
      active: true
    });

    await db.collection('offers').doc('test-retreat-soldout').set({
      id: 'test-retreat-soldout',
      kind: 'retreat',
      group: 'goa',
      title: 'Breath by the Sea',
      room: 'Shared twin',
      price: 32000,
      deposit: 7000,
      capacity: 2,
      allocated: 2, // 0 available
      start: new Date(Date.now() + 86400000 * 60).toISOString(),
      balanceDate: '2027-01-06',
      includes: '3 nights stay',
      policy: 'Standard policy',
      active: true
    });

    await db.collection('offers').doc('test-product-mat').set({
      id: 'test-product-mat',
      kind: 'product',
      title: 'Natural Cork Mat',
      price: 4200,
      capacity: 5,
      allocated: 0,
      includes: 'Free India delivery',
      active: true
    });
  });

  after(async () => {
    // Clean up test documents
    const testDocIds = ['test-session-solo', 'test-retreat-shared', 'test-retreat-soldout', 'test-product-mat'];
    for (const id of testDocIds) {
      await db.collection('offers').doc(id).delete().catch(() => {});
    }
  });

  // 1. PUBLIC CATALOGUE
  test('1. Public catalogue returns active unexpired offerings with computed availability', async () => {
    const { status, data } = await fetchJson('/api/catalog');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.offers));
    const testSession = data.offers.find(o => o.id === 'test-session-solo');
    assert.ok(testSession, 'test-session-solo should be present');
    assert.equal(testSession.available, 1);
    assert.equal(testSession.expired, false);
  });

  // 2. ADMIN AUTHORIZATION
  test('2. Owner endpoints deny unauthenticated or non-admin requests', async () => {
    // No token
    const resNoToken = await fetchJson('/api/admin');
    assert.equal(resNoToken.status, 401);

    // Normal user token (no admin claim)
    const resNormal = await fetchJson('/api/admin', {
      headers: { Authorization: `Bearer ${normalIdToken}` }
    });
    assert.equal(resNormal.status, 403);
    assert.match(resNormal.data.error, /admin privileges/i);

    // Admin user token
    const resAdmin = await fetchJson('/api/admin', {
      headers: { Authorization: `Bearer ${adminIdToken}` }
    });
    assert.equal(resAdmin.status, 200);
    assert.ok(Array.isArray(resAdmin.data.offers));
    assert.ok(Array.isArray(resAdmin.data.requests));
  });

  // 3. CONCURRENCY & OVERBOOKING
  test('3. Concurrent booking attempts for the last place prevent overbooking via Firestore transactions', async () => {
    const payloadA = {
      kind: 'session',
      name: 'Guest A',
      contact: 'guesta@example.com',
      idempotency: `race-a-${Date.now()}`,
      items: [{ id: 'test-session-solo', quantity: 1 }]
    };
    const payloadB = {
      kind: 'session',
      name: 'Guest B',
      contact: 'guestb@example.com',
      idempotency: `race-b-${Date.now()}`,
      items: [{ id: 'test-session-solo', quantity: 1 }]
    };

    // Fire both requests concurrently
    const [resA, resB] = await Promise.all([
      fetchJson('/api/request', { method: 'POST', body: JSON.stringify(payloadA) }),
      fetchJson('/api/request', { method: 'POST', body: JSON.stringify(payloadB) })
    ]);

    const statuses = [resA.status, resB.status].sort();
    assert.deepEqual(statuses, [201, 400], 'Exactly one request succeeds (201) and one is rejected (400)');

    const failedRes = resA.status === 400 ? resA : resB;
    assert.match(failedRes.data.error, /not enough spaces/i);

    // Verify allocated count is exactly 1 in Firestore
    const offerDoc = await db.collection('offers').doc('test-session-solo').get();
    assert.equal(offerDoc.data().allocated, 1);
  });

  // 4. IDEMPOTENCY
  test('4. Duplicate submissions with identical idempotency key return cached booking without double allocation', async () => {
    const idemKey = `idem-${Date.now()}`;
    const payload = {
      kind: 'retreat',
      name: 'Priya Sharma',
      contact: 'priya@example.com',
      idempotency: idemKey,
      items: [{ id: 'test-retreat-shared', quantity: 1 }]
    };

    // First submission
    const res1 = await fetchJson('/api/request', { method: 'POST', body: JSON.stringify(payload) });
    assert.equal(res1.status, 201);
    const bookingId = res1.data.id;

    const offerDoc1 = await db.collection('offers').doc('test-retreat-shared').get();
    const allocatedBefore = offerDoc1.data().allocated;

    // Retry submission with the same idempotency key
    const res2 = await fetchJson('/api/request', { method: 'POST', body: JSON.stringify(payload) });
    assert.equal(res2.status, 201);
    assert.equal(res2.data.id, bookingId, 'Must return the same booking reference ID');

    const offerDoc2 = await db.collection('offers').doc('test-retreat-shared').get();
    assert.equal(offerDoc2.data().allocated, allocatedBefore, 'Allocated capacity must NOT increment twice');
  });

  // 5. SERVER CALCULATED PRICES & TAMPERING PREVENTION
  test('5. Server calculates totals and deposits independently of client payload values', async () => {
    const payload = {
      kind: 'retreat',
      name: 'Kabir Das',
      contact: '9876543210',
      idempotency: `tamper-${Date.now()}`,
      items: [{
        id: 'test-retreat-shared',
        quantity: 2,
        price: 1,      // Attempted client tampering
        deposit: 1     // Attempted client tampering
      }]
    };

    const res = await fetchJson('/api/request', { method: 'POST', body: JSON.stringify(payload) });
    assert.equal(res.status, 201);

    // 2 guests * ₹42,000 = ₹84,000 total; deposit = 2 * ₹8,000 = ₹16,000
    assert.equal(res.data.total, 84000, 'Server must compute ₹84,000 total');
    assert.equal(res.data.due, 16000, 'Server must compute ₹16,000 simulated deposit');
    assert.equal(res.data.status, 'test_reserved');
  });

  // 6. WAITLIST & CORPORATE NON-ALLOCATION
  test('6. Waitlists and corporate enquiries do not allocate inventory or charge deposits', async () => {
    // Waitlist for full retreat
    const waitlistRes = await fetchJson('/api/request', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'waitlist',
        name: 'Asha Rao',
        contact: 'asha@example.com',
        idempotency: `waitlist-${Date.now()}`,
        items: [{ id: 'test-retreat-soldout', quantity: 1 }]
      })
    });
    assert.equal(waitlistRes.status, 201);
    assert.equal(waitlistRes.data.status, 'waitlist');
    assert.equal(waitlistRes.data.due, 0);

    const soldoutDoc = await db.collection('offers').doc('test-retreat-soldout').get();
    assert.equal(soldoutDoc.data().allocated, 2, 'Waitlist must not increase allocated count');

    // Corporate enquiry
    const corpRes = await fetchJson('/api/request', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'corporate',
        name: 'Anita Verma',
        contact: 'anita@techcorp.com',
        idempotency: `corp-${Date.now()}`,
        details: {
          company: 'TechCorp Pune',
          teamSize: '21–50',
          tier: 'Corporate sound bath'
        }
      })
    });
    assert.equal(corpRes.status, 201);
    assert.equal(corpRes.data.status, 'new');
    assert.equal(corpRes.data.due, 0);

    // Partnership enquiry (Hotels, properties, retreat leaders)
    const partnerRes = await fetchJson('/api/request', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'partnership',
        name: 'Devendra Patil',
        contact: 'devendra@heritagehotel.com',
        idempotency: `partner-${Date.now()}`,
        details: {
          propertyOrOrg: 'Heritage Palace Resort',
          partnerType: 'Hotel or resort',
          notes: 'Looking to host quarterly wellness retreats with sound healing and daily sadhana.'
        }
      })
    });
    assert.equal(partnerRes.status, 201);
    assert.equal(partnerRes.data.status, 'new');
    assert.equal(partnerRes.data.due, 0);
    assert.equal(partnerRes.data.details.propertyOrOrg, 'Heritage Palace Resort');
    assert.equal(partnerRes.data.details.partnerType, 'Hotel or resort');
  });

  // 7. CANCELLATION INVENTORY RELEASE
  test('7. Authorized cancellation releases inventory exactly once; duplicate cancellation rejected', async () => {
    // Book product
    const orderRes = await fetchJson('/api/request', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'shop',
        name: 'Rohan Mehra',
        contact: '9123456780',
        idempotency: `order-${Date.now()}`,
        items: [{ id: 'test-product-mat', quantity: 2 }],
        details: { address: '101 Lotus Court, Koregaon Park, Pune 411001' }
      })
    });
    assert.equal(orderRes.status, 201);
    const orderId = orderRes.data.id;

    const matBefore = await db.collection('offers').doc('test-product-mat').get();
    assert.equal(matBefore.data().allocated, 2);

    // Cancel order as Admin
    const cancelRes = await fetchJson('/api/admin/status', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminIdToken}` },
      body: JSON.stringify({ id: orderId, status: 'cancelled' })
    });
    assert.equal(cancelRes.status, 200);

    const matAfter = await db.collection('offers').doc('test-product-mat').get();
    assert.equal(matAfter.data().allocated, 0, 'Allocated count must be reduced by 2 on cancellation');

    // Attempt duplicate cancellation -> should be rejected and not decrement below 0
    const cancelRetry = await fetchJson('/api/admin/status', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminIdToken}` },
      body: JSON.stringify({ id: orderId, status: 'cancelled' })
    });
    assert.equal(cancelRetry.status, 400, 'Duplicate cancellation must fail');

    const matAfterRetry = await db.collection('offers').doc('test-product-mat').get();
    assert.equal(matAfterRetry.data().allocated, 0, 'Allocated count must remain 0, never negative');
  });

  // 8. CMS OFFERING CREATION
  test('8. Admin can create new offerings that immediately appear in the catalogue', async () => {
    const newSession = {
      id: 'ananya-test-2026-12-01',
      kind: 'session',
      group: 'ananya',
      title: 'Ananya Roy',
      price: 1500,
      capacity: 8,
      start: '2026-12-01T10:00:00+05:30',
      includes: '75 minutes · Restorative Sound & Breathwork · Pune Studio',
      active: true
    };

    const createRes = await fetchJson('/api/admin/offer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminIdToken}` },
      body: JSON.stringify({ offer: newSession })
    });
    assert.equal(createRes.status, 200);

    // Verify it appears in public catalog
    const catalogRes = await fetchJson('/api/catalog');
    const createdInCatalog = catalogRes.data.offers.find(o => o.id === newSession.id);
    assert.ok(createdInCatalog, 'Newly created session must be in public catalog');
    assert.equal(createdInCatalog.title, 'Ananya Roy');
    assert.equal(createdInCatalog.price, 1500);

    // Clean up
    await db.collection('offers').doc(newSession.id).delete();
  });

  // 9. FIRESTORE SECURITY RULES DIRECT ACCESS CONTROL
  test('9. Firestore security rules deny direct client writes and private document reads', async () => {
    const firestoreBase = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents`;

    // Direct anonymous read of private requests collection -> 403 Forbidden
    const reqRes = await fetch(`${firestoreBase}/requests`);
    assert.equal(reqRes.status, 403, 'Direct access to requests collection must be denied by rules');

    // Direct anonymous write attempt to offers -> 403 Forbidden
    const writeRes = await fetch(`${firestoreBase}/offers/tamper-doc`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { title: { stringValue: 'Malicious' } } })
    });
    assert.equal(writeRes.status, 403, 'Direct client writes must be denied by rules');

    // Direct read of single active offer -> 200 OK
    const readOfferRes = await fetch(`${firestoreBase}/offers/test-retreat-shared`);
    assert.equal(readOfferRes.status, 200, 'Direct read of active catalogue item is permitted');
  });
});

