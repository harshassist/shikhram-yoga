#!/usr/bin/env node
/**
 * Repeatable SQLite-to-Firestore migration script for Shikhram Yoga.
 * 
 * Usage:
 *   node scripts/migrate-sqlite.js [--dry-run] [--include-qa-bookings] [--force] [--db path/to/pilot.sqlite3]
 */

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const includeQaBookings = args.includes('--include-qa-bookings');
const isForce = args.includes('--force');
const dbArgIndex = args.indexOf('--db');
const dbPath = dbArgIndex !== -1 && args[dbArgIndex + 1]
  ? path.resolve(args[dbArgIndex + 1])
  : path.resolve(__dirname, '../.data/pilot.sqlite3');

if (!fs.existsSync(dbPath)) {
  console.error(`❌ SQLite database file not found at: ${dbPath}`);
  process.exit(1);
}

// Ensure emulator host defaults if not running against production credentials
if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const projectId = process.env.GCLOUD_PROJECT || 'shikhram-yoga';
if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}
const db = admin.firestore();

// Extract SQLite data via python or node:sqlite
function loadSqliteData(sqliteFile) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const sqlite = new DatabaseSync(sqliteFile, { open: true, readOnly: true });
    const offersRows = sqlite.prepare('SELECT id, data FROM offers').all();
    let requestsRows = [];
    try {
      requestsRows = sqlite.prepare('SELECT id, idem, data, created FROM requests').all();
    } catch (_) {}
    return {
      offers: offersRows.map(r => ({ id: r.id, data: JSON.parse(r.data) })),
      requests: requestsRows.map(r => ({ id: r.id, idem: r.idem, data: JSON.parse(r.data), created: r.created }))
    };
  } catch (e) {
    const { execSync } = require('child_process');
    const script = `import sqlite3, json, sys
con = sqlite3.connect(sys.argv[1])
offers = [{'id': r[0], 'data': json.loads(r[1])} for r in con.execute('SELECT id, data FROM offers')]
try:
  requests = [{'id': r[0], 'idem': r[1], 'data': json.loads(r[2]), 'created': r[3]} for r in con.execute('SELECT id, idem, data, created FROM requests')]
except:
  requests = []
print(json.dumps({'offers': offers, 'requests': requests}))`;
    const out = execSync(`python3 -c "${script.replace(/"/g, '\\"')}" "${sqliteFile}"`).toString();
    return JSON.parse(out);
  }
}

async function migrate() {
  console.log(`\n🌿 --- Shikhram Yoga Catalogue Migration --- 🌿`);
  console.log(`Source Database : ${dbPath}`);
  console.log(`Target Firestore: ${process.env.FIRESTORE_EMULATOR_HOST ? 'Emulator (' + process.env.FIRESTORE_EMULATOR_HOST + ')' : 'Cloud (' + projectId + ')'}`);
  console.log(`Mode            : ${isDryRun ? '🔍 DRY RUN (no writes will be made)' : '🚀 LIVE WRITE'}`);
  console.log(`QA Bookings     : ${includeQaBookings ? 'Included' : 'Excluded by default (catalogue only)'}`);
  console.log(`Force Overwrite : ${isForce ? 'Yes' : 'No (skips existing)'}\n`);

  const { offers, requests } = loadSqliteData(dbPath);
  console.log(`Found in SQLite: ${offers.length} offers, ${requests.length} requests/bookings.\n`);

  // Calculate allocated units if QA bookings are included
  const allocatedMap = {};
  if (includeQaBookings) {
    for (const req of requests) {
      if (['cancelled', 'waitlist', 'new'].includes(req.data.status)) continue;
      for (const item of (req.data.items || [])) {
        allocatedMap[item.id] = (allocatedMap[item.id] || 0) + (item.quantity || 1);
      }
    }
  }

  // 1. Process Offers
  let importedOffers = 0;
  let skippedOffers = 0;

  for (const item of offers) {
    const offerDoc = item.data;
    const docRef = db.collection('offers').doc(item.id);

    if (!isForce && !isDryRun) {
      const existing = await docRef.get();
      if (existing.exists) {
        skippedOffers++;
        continue;
      }
    }

    const payload = {
      ...offerDoc,
      allocated: allocatedMap[item.id] || 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    delete payload.available;
    delete payload.expired;

    if (!isDryRun) {
      await docRef.set(payload, { merge: true });
    }
    importedOffers++;
  }

  console.log(`Offers: ${importedOffers} ${isDryRun ? 'would be imported' : 'imported'}, ${skippedOffers} skipped (already exist).`);

  // 2. Process Requests (QA bookings)
  let importedRequests = 0;
  let skippedRequests = 0;

  if (includeQaBookings) {
    for (const req of requests) {
      const docRef = db.collection('requests').doc(req.id);
      const idemRef = req.idem ? db.collection('idempotency').doc(req.idem) : null;

      if (!isForce && !isDryRun) {
        const existing = await docRef.get();
        if (existing.exists) {
          skippedRequests++;
          continue;
        }
      }

      if (!isDryRun) {
        await docRef.set(req.data);
        if (idemRef) {
          await idemRef.set({
            requestId: req.id,
            response: req.data,
            created: req.created
          });
        }
      }
      importedRequests++;
    }
    console.log(`Requests: ${importedRequests} ${isDryRun ? 'would be imported' : 'imported'}, ${skippedRequests} skipped.`);
  } else {
    console.log(`Requests: Skipped ${requests.length} QA/test requests (use --include-qa-bookings to migrate them).`);
  }

  console.log(`\n✅ Migration finished successfully. SQLite source remains intact at ${dbPath}.\n`);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
