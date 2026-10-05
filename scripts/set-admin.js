#!/usr/bin/env node
/**
 * Privileged server script to grant the owner admin role in Firebase Authentication.
 * 
 * Usage:
 *   node scripts/set-admin.js <email> [password]
 */

const admin = require('firebase-admin');

const email = process.argv[2];
const password = process.argv[3] || 'ShikhramAdmin2026!';

if (!email) {
  console.error('❌ Usage: node scripts/set-admin.js <email> [password]');
  process.exit(1);
}

// Default to Auth Emulator if not in production
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}

const projectId = process.env.GCLOUD_PROJECT || 'shikhram-yoga';
if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

async function setAdmin() {
  console.log(`\n🔑 Setting owner admin privileges for: ${email}`);
  console.log(`Auth Target: ${process.env.FIREBASE_AUTH_EMULATOR_HOST ? 'Emulator (' + process.env.FIREBASE_AUTH_EMULATOR_HOST + ')' : 'Production Cloud'}\n`);

  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    console.log(`Found existing user with UID: ${user.uid}. Updating password...`);
    await admin.auth().updateUser(user.uid, { password });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(`User does not exist. Creating new user...`);
      user = await admin.auth().createUser({
        email,
        password,
        emailVerified: true,
        displayName: 'Shikhram Owner'
      });
      console.log(`Created user with UID: ${user.uid}`);
    } else {
      throw err;
    }
  }

  // Set custom user claims { admin: true }
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  console.log(`✅ Granted custom claim: { admin: true } to ${email}`);
  console.log(`The owner can now log in at /admin.html.\n`);
}

setAdmin().catch(err => {
  console.error('❌ Failed to set admin claim:', err);
  process.exit(1);
});
