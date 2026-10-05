# Shikhram Yoga — Practitioner Directory Guide

This guide defines the standardized architecture, privacy standards, and step-by-step procedures for adding any new guide, teacher, nutritionist, or specialist to the Shikhram Yoga practitioner directory.

---

## 1. Strict Privacy & Contact Policy

> **CRITICAL RULE**: **First Names Only & Never Publish Direct Contact Details.**
> - **First Name Only**: Profiles display first names only (**Aniket**, **Deepak**, **Kavita**, **Preeti**). No surnames are displayed in any profile or public listing, ensuring complete personal anonymity and parity across guides.
> - **No Direct Contact Info**: Do **NOT** publish personal mobile numbers, personal WhatsApp numbers, or personal email addresses anywhere in the client-facing UI.
> - **Central Concierge Model**: All client inquiries, consultations, and bookings must route through Shikhram Yoga's central booking flows (`#book` modal, `#nutrition-enquiry`, or official business WhatsApp: `+91 79773 81156`).
> - This protects practitioner privacy, prevents unauthorized solicitation, and guarantees all leads are tracked and handled professionally by the Shikhram concierge team.

---

## 2. Directory Architecture & Integration Points

When adding any new person to the Shikhram Yoga directory, update the following standard locations:

```
├── assets/
│   └── [first-name]-portrait.png (or .jpg) # High-res portrait (transparent or warm studio)
├── teachers.html                           # Master Directory: Listing card with filter tags
├── index.html                              # Homepage: Roster card in "The Guides" grid
├── [domain].html (e.g. nutrition.html)     # Domain Page: Detailed bio, tiers, & customized plans
├── styles.css                              # CSS: Portrait alignment (object-position)
└── assets/seed-catalog.json                # Booking Engine: Session registration
```

---

## 3. Step-by-Step Implementation Template

### Step A: Portrait Asset Preparation
- **Format**: PNG with clean background or high-res JPG with warm neutral tones.
- **Recommended dimensions**: 768 × 1024 px (portrait 3:4) or 1024 × 1024 px (square).
- **Location**: Save to `assets/[first-name]-portrait.png`.
- **CSS Tuning (`styles.css`)**:
  ```css
  .teacher-portrait img[src*="[first-name]"],
  .listing-card-visual img[src*="[first-name]"] {
    object-position: center 20%;
    background: #dcd0bd;
  }
  ```

---

### Step B: Master Directory Card (`teachers.html`)
Add a new `<article>` inside `<section class="page-grid" id="teachers-list">`:

```html
<article class="listing-card filter-item" data-tags="online pune [specialty-tags]" id="[first-name]">
  <div class="listing-card-visual">
    <img src="assets/[first-name]-portrait.png" alt="[First Name] — [Title / Specialization]" loading="lazy">
  </div>
  <div class="listing-card-content">
    <p class="eyebrow">[Credentials / Specialization] · Available this week</p>
    <h2>[First Name]</h2>
    <p>[Concise professional bio emphasizing transformation, clinical rigor, or traditional lineage.]</p>
    <div class="listing-meta">
      <span>[Tag 1]</span>
      <span>[Tag 2]</span>
      <span>[Tag 3]</span>
      <span>Online &amp; Pune</span>
    </div>
    <!-- Pricing summary (if applicable) -->
    <div style="margin-top:1.1rem;padding-top:.9rem;border-top:1px solid var(--line);font-size:.78rem;color:var(--muted)">
      <strong style="color:var(--ink);font-weight:600">Plans from ₹[Price] / month</strong> · [Key inclusions]
    </div>
    <div class="card-actions">
      <!-- ALWAYS link to central booking or inquiry flow — NO PERSONAL NUMBERS -->
      <a class="button" href="[domain].html#plans">Explore plans</a>
      <a class="text-link" href="[domain].html#enquiry">Book consultation →</a>
    </div>
  </div>
</article>
```

#### Search & Filter Tags Taxonomy:
- Location tags: `online`, `pune`
- Tradition / Discipline tags: `hatha`, `ashtanga`, `meditation`, `breathwork`, `sound`, `nutrition`, `diet`, `sports`, `maternity`, `kids`, `keto`, `fat-loss`, `weight-gain`, `pcos`, `thyroid`, `diabetes`
- If introducing a new category, add a filter button to `.tool-filter-chips`:
  ```html
  <button class="filter-button" data-filter="[category]">[Label]</button>
  ```

---

### Step C: Homepage Showcase (`index.html`)
Add a card to `<div class="teacher-grid">` in `<section class="teachers-section" id="teachers">`:

```html
<article class="teacher-card">
  <div class="teacher-portrait">
    <img src="assets/[first-name]-portrait.png" alt="[First Name] — [Title]" width="600" height="600" loading="lazy">
  </div>
  <div>
    <small>[Category · Specialty]</small>
    <h3>[First Name]</h3>
    <p>Pune &amp; Online · [Primary Offering]</p>
    <p class="availability">● Available this week</p>
    <a href="teachers.html#[first-name]">View profile ↗</a>
  </div>
</article>
```

---

### Step D: Domain Landing Page (e.g., `nutrition.html`)
Feature the practitioner with comprehensive offerings and pricing:
1. **Guide Card**: High-resolution image, bio, credentials, package inclusions.
2. **Transparent Pricing Tiers**: 1-Month, 2-Months, 3-Months, and special condition add-ons.
3. **Form Integration**: Ensure all "Select Plan" or "Select Guide" buttons scroll to `#enquiry` and populate the form dropdown.

---

### Step E: Booking Engine & Catalog (`assets/seed-catalog.json` & `server.py`)
Register session offerings in `assets/seed-catalog.json`:

```json
{
  "id": "[first-name]-session",
  "kind": "session",
  "group": "[first-name]",
  "title": "[First Name] · [Service Name]",
  "price": 3000,
  "capacity": 1,
  "start": "2026-09-28T10:00:00+05:30",
  "includes": "[Includes description] · Online & Pune",
  "active": true
}
```

---

## 4. Current Directory Roster (First Names Only)

| Practitioner | Role / Discipline | Profile ID | Privacy Status |
| :--- | :--- | :--- | :--- |
| **Aniket** | Founder & Lead Guide (Hatha, Breathwork) | `#shikhram` | ✅ Central Concierge Protected |
| **Deepak** | Certified Yoga Guide & Meditation Coach | `#deepak` | ✅ Central Concierge Protected |
| **Kavita** | Sports, Maternity & Child Nutritionist | `#kavita` | ✅ Central Concierge Protected |
| **Preeti** | Dietitian · Lifestyle & Weight Management | `#preeti` | ✅ Central Concierge Protected |
