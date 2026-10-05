# Shikhram Yoga — Product Requirements Document

Version: 1.0 · Updated: 9 September 2026

Status: planning baseline for the existing pilot and proposed Firebase release. This document does not imply that planned features have been implemented or that a public deployment is approved.

## 1. Product purpose

Build a calm, premium website and owner workspace for Shikhram Yoga, a Pune-based yoga and wellness brand. Visitors should be able to find a teacher, request a yoga or sound session, reserve a retreat, enquire about corporate wellness, and purchase practice essentials. The instructor should manage offerings and requests without routine code changes.

The experience must preserve the established cream/sand, dark and gold palette, display serif, gold italic emphasis, original brand logo and existing animation style. Functional improvements must not redesign the visual identity.

## 2. Users and outcomes

| User | Primary need | Successful outcome |
| --- | --- | --- |
| Individual practitioner | Find a suitable teacher and time | Request saved with a clear confirmation path |
| Sound meditation guest | Understand formats and book simply | Suitable session selected with price and inclusions visible |
| Retreat traveller | Understand a high-value commitment | Clear room, dates, inclusions, deposit and balance schedule |
| HR or corporate organiser | Find a credible wellness partner | Short enquiry submitted or contextual WhatsApp conversation opened |
| Shop customer | Select useful products | Accurate bag and order summary with delivery details |
| Owner/instructor | Manage the business in one place | Update offerings, review requests and maintain accurate availability |

## 3. Current state versus target

The current implementation uses static HTML/CSS/JavaScript, a local Python server and SQLite. It is a pilot, not a production service.

| Area | Current pilot | Firebase release target |
| --- | --- | --- |
| Public pages | Home, teachers, sound healing, retreats, corporate, shop | Preserve pages; load published offerings dynamically |
| Sessions | Saved requests and capacity checks | Managed calendar, booking status and controlled change requests |
| Retreats | Room selection, simulated deposits, guest counts, waitlist | Full detail views, reservation lifecycle and hold expiry |
| Corporate | Saved proposal enquiries, including sound baths | Lead workflow and owner notifications |
| Shop | Persistent browser bag and saved demo orders | Product details, separate checkout summary and managed stock |
| Owner access | Shared server-generated key | Firebase Authentication with privileged admin authorization |
| CMS | Edit existing offerings; duplicate sessions | Create, edit, publish and archive sessions, retreats and products |
| Customer follow-up | Reference displayed after submission | Private status access and reschedule/cancellation requests |
| Notifications | No automatic messages | Provider-ready events; actual delivery requires configuration |
| Hosting | Localhost only | Firebase Hosting with server functions and Firestore |

Current pending session requests consume capacity until manually cancelled or confirmed. Unsubmitted contact information is not saved. WhatsApp links require the actual owner number. General page copy, photos and some catalogue cards remain defined in site files.

## 4. Scope and release stages

### Stage A — Firebase demo migration

- Migrate catalogue and request persistence to Firestore.
- Serve the existing website through Firebase Hosting.
- Implement trusted Cloud Functions for booking, inventory and owner operations.
- Replace the shared key with authenticated owner access.
- Preserve and test the four distinct conversion flows.
- Publish CMS-created offerings without editing HTML.
- Keep all payments simulated and all outgoing notifications disabled.
- Provide emulator setup, migration tooling, tests and deployment instructions.

### Stage B — Operational booking essentials

- Private booking details and status access.
- Reschedule and cancellation requests with owner approval.
- Configurable booking hold expiry.
- Recurring session creation, teacher conflict checks and unavailable dates.
- Notification events and configured owner alerts.
- Complete retreat and product details.

Stage B is the recommended next scope, not functionality already delivered. Owner policies and notification providers must be settled before dependent features go live.

### Stage C — Production launch

Requires owner-approved content, prices and policies; production authentication and rules; database backup/recovery arrangements; configured contact details; and explicit approval for public deployment and any billing changes. Real payments and automated customer messaging require separate integration and authorization.

Out of scope for the initial migration: memberships, subscriptions, loyalty points, coupons, marketplace payouts, native apps, medical records and a redesign of the brand.

## 5. Public experience requirements

### 5.1 Shared requirements

- Keep one primary navigation CTA in a consistent position: Book a class on Teachers, Book sound session on Sound, Reserve on Retreats, Request a proposal on Corporate, and Bag on Shop.
- Include Sound in the main navigation across all public pages.
- Show price or tailored-quote framing, availability and inclusions near the action.
- Use responsive dialogs or dedicated step views matching the existing design.
- Provide visible loading, validation, empty, sold-out, error and retry states.
- Offer a contextual WhatsApp handoff outside the shop when the owner number is configured. Never use an invented number.
- Do not claim a WhatsApp link sent a message or saved a lead; the visitor must complete the handoff.
- Do not silently capture abandoned personal details. Offer an explicit save/contact action or WhatsApp alternative. Any future draft-lead capture must disclose what is saved and why.
- Use labelled fields, keyboard navigation, visible focus, sensible focus restoration, accessible status announcements and reduced-motion support.
- Mobile forms should use at least 16px input text, comfortable touch targets, no horizontal overflow and a reachable primary action. Sticky buttons must not obscure fields or confirmation content.
- Customer account creation must not be required before the initial enquiry or booking request.

### 5.2 Class and individual sound booking

Flow: choose teacher/session → choose time and enter name plus phone/email → request confirmation.

- Minimise screens and target two to three primary actions after selecting an offering, excluding typing.
- Display duration, location/online format, price and times in IST.
- Only allow published, future offerings with available capacity.
- Validate availability on submission, not only when displaying the slot.
- Confirm the reference, selected service and preferred time. Explain that the request awaits the team's confirmation.
- Make pending hold behaviour explicit once expiry is implemented.
- Sound Reset, Resonance Journey and Private Sound Ritual retain their distinct durations and prices.
- Corporate sound baths route to a preselected corporate enquiry, not a private-session booking.

### 5.3 Retreat reservation

Flow: full retreat details → room/guest availability → deposit and balance review → reservation → confirmation.

- Detail content includes dates, location, itinerary, teacher biography/photo, accommodation, meals, accessibility guidance, travel arrangements and exclusions.
- Place remaining spaces, room type, teacher identity, cancellation policy and deposit reassurance beside the reserve action.
- Calculate total and deposit for every guest and selected room. Never reuse another retreat's room price.
- Display both deposit and balance due date before submission.
- Demo example: shared Rishikesh stay costs ₹42,000 per guest, with ₹8,000 simulated deposit and ₹34,000 balance. These are placeholders pending owner approval.
- Sold-out offerings provide a waitlist with no payment and no inventory allocation.
- Record the accepted policy version with a reservation once owner-approved policies are available.
- Changes to catalogue prices must not alter existing reservation snapshots.
- A real reservation must never be marked paid based only on a browser redirect; future payment confirmation must use verified provider events.

### 5.4 Corporate wellness

Flow: select program → short brief or WhatsApp → enquiry confirmation.

- Required fields: company, name, work email, team size and preferred program.
- Programs include Team Reset, Culture of Care, Leadership Retreat and Corporate sound bath.
- Use tailored proposal framing and state what planning/delivery support is included.
- Never show a corporate shopping cart or payment checkout.
- Confirmation: “Thanks — we'll send a proposal within one working day.” Owner must approve this service commitment before launch.
- Owner workflow: new → contacted → proposal sent → won/lost, with optional internal notes. The last three stages are planned additions to the current pilot.

### 5.5 Shop

Flow: product detail/add to bag → editable bag → delivery and checkout summary → demo order confirmation.

- Show product photos, price, stock, materials, dimensions where relevant, care, delivery estimate and approved return terms.
- Allow quantity changes and removal; persist the bag in the same browser.
- Explain unavailable or archived items in an existing bag rather than silently dropping them.
- Validate stock and calculate price, shipping and total on the server.
- Capture name, contact, complete delivery address and PIN.
- Show any shipping charge before placing the order; demo free delivery must be identified as a placeholder until approved.
- Clear the bag only after a successful order save.
- Shop is the only shared cart; classes, retreats and corporate enquiries must not enter it.

## 6. Owner workspace

- Restrict access to authenticated users with a server-issued admin claim.
- Provide a documented privileged procedure for initial owner access. Browser users cannot assign themselves an admin role.
- Show request counts, upcoming sessions, pending reservations, waitlist and new corporate enquiries.
- Search/filter by type, status, date and customer/reference.
- Create/edit/publish/archive offerings and update prices, descriptions, photos, dates, room options, deposits, capacity and stock.
- Clearly distinguish total capacity, allocated places and remaining availability.
- Prevent reducing capacity below active allocations without a deliberate resolution workflow.
- Preserve booking history when archiving an offering.
- Manage teacher schedules, recurring sessions, blocked dates and overlapping assignments in Stage B.
- Record who changed important booking states and when.
- Keep the dashboard usable on mobile without exposing customer details publicly.

## 7. Booking lifecycle and inventory

| Record | Intended lifecycle | Inventory effect |
| --- | --- | --- |
| Session | Requested → confirmed → completed; cancellation/expiry paths | Active requests and confirmations allocate places; cancellation/expiry releases once |
| Retreat | Demo reserved; future real flow: held → deposit paid → confirmed | Active reservation allocates the selected room places |
| Waitlist | Waiting → contacted → invited/closed | No allocation until a separate reservation succeeds |
| Corporate lead | New → contacted → proposal sent → won/lost | No allocation |
| Shop order | Demo order; future paid → processing → fulfilled | Stock allocation occurs once; valid cancellation releases once |

These are target domain states; the pilot currently uses a smaller set including `requested`, `test_reserved`, `test_order`, `new`, `contacted`, `waitlist`, `confirmed`, `fulfilled` and `cancelled`.

- Use server transactions for capacity checks and allocation.
- Require an idempotency key for create operations and payment/notification event handling.
- Reject invalid transitions, negative quantities, expired offerings and mismatched offering types.
- Never release stock twice when a cancellation is retried.
- Keep payment status separate from booking status.
- Configure hold duration with the owner. Expiry processing must be repeatable and safe under concurrent confirmations.
- Reschedule requests keep the original booking until a replacement is accepted. Move capacity atomically on approval; reject unavailable replacements without losing the original slot.
- Private customer access must use verified identity or an expiring, unguessable token. A reference number alone is not authorization.

## 8. Firebase technical direction

Proposed architecture, subject to implementation validation:

- Firebase Hosting: public assets and website routes.
- Cloud Firestore: published catalogue, requests, orders, inventory and audit history.
- Firebase Authentication: owner login and optional verified customer access.
- Cloud Functions: trusted validation, totals, transactions, status updates and expiry processing.
- Firebase Storage: CMS media uploads if required; restrict write access and validate file types/sizes.
- Firebase Emulator Suite: local development and integration tests.

Suggested entities: teachers, offerings, retreat room inventory, products, booking requests, corporate leads, shop orders, change requests, public settings and audit events. Exact collection structure should follow transaction and access requirements rather than exposing the entire internal database to clients.

Store monetary values as integer minor units with currency, dates as timestamps with explicit display timezone, and booking details as immutable commercial snapshots. Customer contact data belongs in private records, never in public catalogue documents.

Firestore rules deny by default. Anonymous readers access published catalogue fields only. Trusted functions validate guest submissions and inventory mutations; owner operations verify admin authorization. Add appropriate abuse protection and App Check where suitable, with documented emulator behaviour.

Keep service-account credentials and server secrets out of frontend code and Git. Firebase browser configuration is distinct from privileged credentials. Confirm project, region, service availability and billing requirements during implementation; this PRD makes no promise of free hosting or function execution.

## 9. Migration and deployment

- Inspect the existing Firebase project before changing its configuration or hosted content.
- Provide a repeatable SQLite-to-Firestore migration with dry-run output and stable identifiers.
- Import catalogue data by default. Exclude current QA bookings/orders unless explicitly requested.
- Preserve original SQLite data and document rollback/recovery.
- Add Hosting configuration, Firestore rules/indexes, Functions configuration and environment examples.
- Verify locally before requesting public deployment approval.
- Report the target project, changes, test results and billing implications before enabling paid services or deploying.
- Work on a `codex/` feature branch and preserve unrelated assets and changes.

## 10. Notifications

Define events for new request, confirmation, cancellation, reschedule outcome, retreat balance reminder and corporate enquiry. Keep delivery separate from the booking transaction, with retries and duplicate protection.

The demo must not send real messages. Actual provider choice, sender identity, consent wording, templates and delivery channels remain configuration decisions. A failed notification must not lose an otherwise successful booking. Do not tell a visitor that a message was delivered unless delivery is verified.

## 11. Acceptance criteria

1. All six public pages retain the current brand design and link to Sound.
2. Each CTA opens its correct flow; corporate sound-bath links preselect the right enquiry program.
3. Published CMS-created offerings appear on the relevant page without an HTML edit.
4. A successful request survives reload and appears in the owner dashboard with the same reference and commercial details.
5. Two concurrent attempts for the last place cannot both allocate it.
6. Retrying a successful submission returns the original result without a duplicate record or allocation.
7. Manipulating frontend price/deposit values cannot alter server-calculated totals.
8. Two ₹42,000 guests with an ₹8,000 deposit each produce ₹84,000 total and ₹16,000 simulated deposit.
9. Waitlist and corporate submissions do not reserve inventory or initiate payment.
10. An authorized cancellation releases capacity once; unauthorized status changes fail.
11. Public/guest users cannot read customer records, edit offerings or grant admin privileges.
12. Unpublished, expired and full offerings cannot be booked; network and validation errors preserve usable form state.
13. Bag quantity/removal and checkout totals remain correct across reloads; failed orders keep the bag.
14. Mobile booking is usable at 390px width without horizontal scrolling; keyboard and reduced-motion checks pass.
15. Emulator tests cover rules, admin authorization, concurrency, idempotency, totals and cancellation inventory release.
16. Stage B additionally verifies private status access, hold expiry, teacher conflicts and atomic rescheduling.

## 12. Success measures

After launch and appropriate analytics consent, measure completed requests per flow, drop-off by step, WhatsApp handoff clicks, owner response time, slot utilisation, retreat reservation completion and booking/order errors. Do not treat WhatsApp clicks as confirmed leads. Establish a baseline before assigning conversion targets; do not fabricate traffic or performance claims.

## 13. Owner inputs and unresolved decisions

- Firebase project ID, deployment region, account access and billing approval.
- Owner login identity and actual WhatsApp/business contact number.
- Approved teacher names, biographies, qualifications and photographs.
- Real schedules, locations, durations, availability and recurring-session rules.
- Retreat room inventory, occupancy model, dates, inclusions, deposit/balance rules and cancellation policies.
- Product photography, prices, shipping regions/charges, returns and fulfilment process.
- Booking hold durations, rescheduling notice periods and confirmation commitments.
- Privacy notice, retention/deletion policy and notification consent.
- Notification provider and whether any real payment integration belongs in a later release.

Unresolved items should use clearly identified demo placeholders. They must not become invented production promises.
