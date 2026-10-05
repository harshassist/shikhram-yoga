# Implementation Status: Shikhram Yoga (PRD Mapping)

Baseline: 9 September 2026 · Source of Truth: [PRD.md](PRD.md)

## Status Legend
- ✅ **Complete**: Verified working in emulators and integration tests.
- 🟡 **In Progress**: Currently being implemented/tested.
- ⏳ **Stage B (Planned Next Scope)**: Explicitly tracked for post-migration phase.
- 🔒 **Stage C / Production Blocked**: Requires owner-provided credentials, real payment provider, or explicit billing approval.

---

## 1. Architecture & Platform Setup (PRD §8, §9)

| Requirement | Stage | Status | Notes |
|---|---|---|---|
| Firebase Hosting for website | Stage A | ✅ Complete | Static assets + API rewrite on port 5005 |
| Cloud Firestore for catalogue, requests & inventory | Stage A | ✅ Complete | Schema, transactions, allocations & idempotency |
| Firebase Authentication for owner workspace | Stage A | ✅ Complete | Email/password login in `admin.html` |
| Server-issued admin custom claims | Stage A | ✅ Complete | Set via `scripts/set-admin.js`, verified via middleware |
| Cloud Functions for trusted transactions | Stage A | ✅ Complete | Express API in Node 22 (`functions/index.js`) |
| Firebase Emulator Suite configuration | Stage A | ✅ Complete | Auth (9099), Firestore (8080), Functions (5001), Hosting (5005), UI (4000) |
| Deny-by-default Firestore security rules | Stage A | ✅ Complete | Verified with unit tests; direct client writes blocked |
| Billing & production credentials disclosure | Stage A | ✅ Complete | Documented; emulators 100% free; Blaze plan documented |

---

## 2. Four Conversion Flows (PRD §5)

| Flow | Stage | Status | Notes |
|---|---|---|---|
| Classes & sound sessions booking | Stage A | ✅ Complete | Teacher & slot choice, capacity check, reference confirmation |
| Corporate sound-bath routing to corporate enquiry | Stage A | ✅ Complete | Auto-preselects 'Corporate sound bath' tier |
| Retreat reservation with room & deposit calculation | Stage A | ✅ Complete | Snapshot pricing, balance schedule, deposit calculation |
| Sold-out retreat waitlist (zero payment, no inventory hold) | Stage A | ✅ Complete | Waitlist status, no capacity consumed |
| Corporate proposal brief (no checkout/cart) | Stage A | ✅ Complete | Short brief form, no payment/checkout |
| Shop persistent bag, quantity adjustment & demo checkout | Stage A | ✅ Complete | Server stock validation & order snapshot |
| Context-aware navigation & mobile sticky CTAs | Stage A | ✅ Complete | Preserved across all 6 pages with 16px+ mobile inputs |
| Verified owner WhatsApp links (no invented number) | Stage A | ✅ Complete | Dynamic configuration from env/settings; fallback displayed if unset |

---

## 3. Trusted Backend & Concurrency (PRD §7)

| Requirement | Stage | Status | Notes |
|---|---|---|---|
| Server-calculated prices, deposits, and totals | Stage A | ✅ Complete | Client amounts ignored; verified in test 5 |
| Input validation and character limits | Stage A | ✅ Complete | Sanitized and validated on server |
| Firestore transactions to prevent overbooking | Stage A | ✅ Complete | Race-condition tested in test 3 |
| Idempotency on booking and order submission | Stage A | ✅ Complete | Tested in test 4; duplicate retries return cached record |
| Permitted status transitions enforcement | Stage A | ✅ Complete | Strict transition map enforced |
| Single inventory release on cancellation | Stage A | ✅ Complete | Tested in test 7; retried cancellations rejected |
| Waitlist & corporate do not consume inventory | Stage A | ✅ Complete | Tested in test 6; explicit zero allocation |
| Commercial snapshots (price, deposit, room, dates) | Stage A | ✅ Complete | Preserved on request record |
| Clear handling of stale availability and network errors | Stage A | ✅ Complete | Dialog error handling and retry states in `flows.js` |

---

## 4. Owner Dashboard & CMS (PRD §6)

| Requirement | Stage | Status | Notes |
|---|---|---|---|
| Firebase Auth login replacing shared access key | Stage A | ✅ Complete | Authenticated with email/password via Firebase Auth SDK |
| Privileged admin check on backend API | Stage A | ✅ Complete | Middleware enforces `claims.admin === true` (test 2) |
| Privileged script for initial owner setup | Stage A | ✅ Complete | `scripts/set-admin.js` |
| Create, edit, and duplicate offerings | Stage A | ✅ Complete | Create new offerings UI + duplicate session support |
| Dynamic catalogue publishing without HTML edits | Stage A | ✅ Complete | Tested in test 8 & verified dynamic client rendering |
| Request filtering, status updates, and cancellations | Stage A | ✅ Complete | Status transitions & inventory release verified |
| Customer privacy protection | Stage A | ✅ Complete | Direct client reads blocked; admin token required |

---

## 5. Migration Tooling (PRD §9)

| Requirement | Stage | Status | Notes |
|---|---|---|---|
| Repeatable SQLite-to-Firestore migration script | Stage A | ✅ Complete | `scripts/migrate-sqlite.js` |
| Dry-run mode (`--dry-run`) | Stage A | ✅ Complete | Verified dry-run execution |
| Deduplication / skip existing records | Stage A | ✅ Complete | Verified 93 offers skipped on second run |
| Exclude QA/test bookings by default | Stage A | ✅ Complete | QA bookings excluded unless `--include-qa-bookings` passed |
| Preserve SQLite database untouched | Stage A | ✅ Complete | Opened with read-only connection; DB preserved intact |

---

## 6. Testing & Quality Assurance (PRD §11)

| Test Area | Stage | Status | Notes |
|---|---|---|---|
| Firestore security rules tests | Stage A | ✅ Complete | Test 9 in `tests/emulator.test.js` |
| Admin authorization enforcement tests | Stage A | ✅ Complete | Test 2 in `tests/emulator.test.js` |
| Concurrent booking race condition tests | Stage A | ✅ Complete | Test 3 in `tests/emulator.test.js` |
| Duplicate submission idempotency tests | Stage A | ✅ Complete | Test 4 in `tests/emulator.test.js` |
| Price & deposit tampering tests | Stage A | ✅ Complete | Test 5 in `tests/emulator.test.js` |
| Cancellation inventory release tests | Stage A | ✅ Complete | Test 7 in `tests/emulator.test.js` |
| Cross-device and mobile responsiveness (390px) | Stage A | ✅ Complete | Mobile CSS with sticky CTAs, touch targets, and inputs >= 16px |

---

## 7. Stage B — Operational Booking Essentials (Explicitly Tracked for Next Phase)

- [ ] Private customer booking lookup by unguessable token or verified auth (PRD §7)
- [ ] Customer-initiated reschedule and cancellation requests with owner approval workflow (PRD §4, §7)
- [ ] Configurable automated booking hold expiration worker (PRD §4, §7)
- [ ] Recurring session creation with teacher conflict detection and blocked dates (PRD §6)
- [ ] Outgoing notification events (Email, SMS, WhatsApp) through configured providers (PRD §10)
- [ ] Extended rich retreat itinerary and product variant details (PRD §5.3, §5.5)

---

## 8. Stage C — Production Launch Checklist (Awaiting Owner Inputs)

- [ ] Final Firebase Project ID and deployment region selected.
- [ ] Explicit owner approval for Cloud Functions Blaze billing.
- [ ] Real WhatsApp / business contact phone number configured.
- [ ] Owner-approved copy, teacher biographies, retreat terms, and product photography.
- [ ] Payment gateway (e.g. Razorpay) account setup and webhook verification.
