# Shikhram Yoga — Firebase Backend & Website

A mindful yoga and sound meditation sanctuary web application with a trusted Firebase backend, Cloud Firestore persistence, Firebase Authentication, Cloud Functions business transactions, and Firebase Hosting.

---

## 1. Firebase Architecture & Tech Stack

- **Frontend**: Responsive semantic HTML5, Vanilla CSS (`styles.css`, `pilot.css`), dynamic client orchestration (`flows.js`, `script.js`, `sound.js`, `admin.js`).
- **Hosting**: Firebase Hosting for static assets and CDN distribution, with rewrites routing `/api/**` to Cloud Functions.
- **Database**: Cloud Firestore for catalogue (`offers`), private customer records (`requests`), transaction locks (`idempotency`), and configuration (`settings`).
- **Functions**: Cloud Functions (Node.js 22, Express API) providing server-side validation, server-calculated totals, atomic concurrency handling via Firestore transactions, and admin operations.
- **Authentication**: Firebase Authentication for owner login with server-issued custom claims (`{ admin: true }`).
- **Security**: Deny-by-default Firestore security rules (`firestore.rules`). Anonymous clients can only read published catalogue items; customer requests and admin operations are restricted.
- **Local Development**: Firebase Local Emulator Suite (Auth, Firestore, Functions, Hosting, UI).

### Billing & Cloud Requirements
- **Local Emulators**: 100% free and offline. No Google Cloud project credentials or credit card required.
- **Production Cloud Functions**: Cloud Functions (2nd Gen / Node 22) requires a Google Cloud / Firebase project on the **Blaze (pay-as-you-go)** billing plan. Free tier quotas apply (first 2M invocations/month and 1GB storage are typically free). Before public cloud deployment, owner approval for Blaze billing is required.

---

## 2. Quick Start with Local Emulators

### Prerequisites
- Node.js 18+ (tested on Node 22)
- Java JDK 21+ (required for Firestore emulator)
- Firebase CLI (`npm install -g firebase-tools` or `npx -y firebase-tools@latest`)

### Setup & Installation
```bash
# 1. Install root and functions dependencies
npm install
cd functions && npm install && cd ..

# 2. Start Firebase Local Emulator Suite
npm run emulators
```

The emulators will start on the following local ports:
- **Website (Hosting)**: [http://127.0.0.1:5005](http://127.0.0.1:5005)
- **Owner Dashboard**: [http://127.0.0.1:5005/admin.html](http://127.0.0.1:5005/admin.html)
- **Functions API**: [http://127.0.0.1:5001/shikhram-yoga-dev/us-central1/api](http://127.0.0.1:5001/shikhram-yoga-dev/us-central1/api)
- **Firestore Emulator**: `127.0.0.1:8080`
- **Auth Emulator**: `127.0.0.1:9099`
- **Emulator UI**: [http://127.0.0.1:4000](http://127.0.0.1:4000)

---

## 3. SQLite Migration Tooling

A repeatable migration script is provided in `scripts/migrate-sqlite.js` to transfer existing SQLite data to Cloud Firestore.

```bash
# Preview what will be migrated without writing to Firestore (Dry Run)
node scripts/migrate-sqlite.js --dry-run

# Run migration (imports catalogue offerings; excludes QA bookings by default)
node scripts/migrate-sqlite.js

# Optional: Include historical QA bookings/orders into Firestore
node scripts/migrate-sqlite.js --include-qa-bookings

# Force overwrite existing Firestore records
node scripts/migrate-sqlite.js --force
```

> **Data Safety Note**: The original SQLite database at `.data/pilot.sqlite3` is opened in read-only mode and is preserved completely untouched.

---

## 4. Owner Dashboard & Initial Admin Setup

Owner dashboard access is protected by Firebase Authentication and server-issued custom claims (`admin: true`). Users cannot assign themselves admin privileges.

### Initial Owner Setup
To create or authorize an owner account with admin privileges, run the privileged server script:

```bash
# Usage: node scripts/set-admin.js <email> [password]
node scripts/set-admin.js owner@shikhramyoga.com "MySecurePass123!"
```

Then visit [http://127.0.0.1:5005/admin.html](http://127.0.0.1:5005/admin.html) and sign in with those credentials.

### Owner Capabilities
- **Overview & Statistics**: Total requests, pending sessions, new corporate leads, waitlist counts.
- **Manage Requests**: View customer details, confirm sessions, mark corporate enquiries as contacted, fulfill orders, or cancel bookings (which safely releases inventory back to stock exactly once).
- **Edit Catalogue**: Adjust prices, capacities, dates, room options, deposits, and publication status.
- **Dynamic Publishing**: Click **+ Create new offering** to publish a new session, retreat, or shop product. Newly published offerings automatically appear on the website without editing HTML!

---

## 5. Automated Emulator Tests

Run the test suite covering security rules, admin authorization, race conditions, idempotency, price tampering, and inventory releases:

```bash
npm test
```

### Verified Test Scenarios
1. **Access Rules**: Unauthenticated and non-admin users denied access to private requests.
2. **Admin Authorization**: Non-admin bearer tokens rejected with 403.
3. **Concurrency**: Concurrent requests for the last remaining spot prevent overbooking using Firestore transactions.
4. **Idempotency**: Submitting duplicate idempotency keys returns the cached record without double-allocating inventory.
5. **Price Tampering**: Client-side prices/deposits are ignored; totals strictly computed by the server.
6. **Cancellation**: Cancelling an active booking releases allocated capacity exactly once; retried cancellations are rejected.
7. **Waitlist & Corporate**: Waitlist entries and corporate enquiries do not allocate capacity.

---

## 6. Production Deployment Instructions

When ready to deploy to production:

### 1. Select Firebase Project & Enable Services
```bash
# Login to Firebase
npx firebase login

# Select your production project
npx firebase use <your-production-project-id>
```

### 2. Verify Pre-Deployment Checklist
- [ ] Confirm Cloud Functions Blaze billing is active in Google Cloud Console.
- [ ] Set `SHIKHRAM_WHATSAPP` environment variable with the verified owner phone number (digits only, e.g. `919876543210`).
- [ ] Run migration script against production Firestore:
  ```bash
  GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/migrate-sqlite.js
  ```
- [ ] Provision initial owner in production:
  ```bash
  GOOGLE_APPLICATION_CREDENTIALS=service-account.json node scripts/set-admin.js owner@shikhramyoga.com
  ```

### 3. Deploy
```bash
# Deploy Firestore rules & indexes
npx firebase deploy --only firestore

# Deploy Cloud Functions
npx firebase deploy --only functions

# Deploy Website to Firebase Hosting
npx firebase deploy --only hosting
```
