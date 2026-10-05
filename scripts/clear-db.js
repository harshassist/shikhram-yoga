const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const projectId = process.env.GCLOUD_PROJECT || 'shikhram-yoga';

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();

async function clearDatabase() {
  console.log(`Connecting to Firestore (${process.env.FIRESTORE_EMULATOR_HOST ? 'Emulator: ' + process.env.FIRESTORE_EMULATOR_HOST : 'Cloud Project: ' + projectId})...`);

  // 1. Delete all requests
  const reqSnapshot = await db.collection('requests').get();
  console.log(`Found ${reqSnapshot.size} requests to delete.`);
  
  const batchSize = 400;
  let batch = db.batch();
  let count = 0;

  for (const doc of reqSnapshot.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % batchSize !== 0 && reqSnapshot.size > 0) {
    await batch.commit();
  }
  console.log(`Successfully deleted ${count} requests.`);

  // 2. Reset allocated inventory in offers
  const offersSnapshot = await db.collection('offers').get();
  let offerBatch = db.batch();
  let offerCount = 0;

  for (const doc of offersSnapshot.docs) {
    const data = doc.data();
    if (data.allocated && data.allocated > 0) {
      offerBatch.update(doc.ref, { allocated: 0, updatedAt: new Date().toISOString() });
      offerCount++;
    }
  }
  if (offerCount > 0) {
    await offerBatch.commit();
    console.log(`Reset inventory allocations for ${offerCount} offerings.`);
  }

  console.log('Database successfully wiped and reset to clean professional state.');
}

clearDatabase().catch(err => {
  console.error('Error clearing database:', err);
  process.exit(1);
});
