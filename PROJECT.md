# Pantry Owl

A Progressive Web App (PWA) for a food pantry. Clients browse items, build a shopping list, and generate a QR code. Cashiers scan the code at pickup. Stockers keep availability current. Admins manage accounts and see data.

- **Repo:** https://github.com/KevinB6766/pantry_owl.git
- **Stack:** Next.js + React + TypeScript (frontend), FastAPI (backend), Supabase (Postgres + Auth), Open Food Facts (product metadata), USDA FoodData Central (nutrition), Render (hosting). See [CURRENT_STATE.md](CURRENT_STATE.md) for what is built.
- **Related files:** [DELIVERABLES.md](DELIVERABLES.md) · [CURRENT_STATE.md](CURRENT_STATE.md)

---

## 1. Roles

| Role | Can do |
|---|---|
| **User** | Browse items, build/save a shopping list, and generate a pickup QR code. Stars/pings, recipe lookup, live chat, and issue reports are planned extras. |
| **Cashier** | Scan QR code, add/drop items, undo previous action, manually enter items, change item availability |
| **Stocker** | Add items, update availability when restocked |
| **Admin** | Control accounts (create, change permissions, remove cashiers), view dashboard, manage splash/emergency notices |

All roles can log in.

---

## 2. Data Model

### Items
| Field | Notes |
|---|---|
| Item ID | Unchangeable |
| Barcode | UPC used to look up and identify packaged products |
| Name | |
| Price | |
| Image URL | Supports carousel (multiple images) |
| Tags | vegan, vegetarian, halal, kosher, canned, fruit, veggie, grain, pasta, etc.; replaces categories |
| Points cost | Shared default points cost per unit; a location may override it |
| Nutrition label image | |
| Weight | |
| Ingredients text | |
| Amount | Moved to per-location stock (see Locations) |
| Combos | Related/frequently bought together items |
| Out of stock | Moved to per-location availability (see Locations) |
| Added date | Drives "newly added" homepage splash |

### Locations
Each pantry (campus) is a location with its own details, rules, stock and staff.

| Field | Notes |
|---|---|
| Location ID | Unchangeable |
| Name | Display name, e.g. "Main Campus Pantry" |
| Campus | Campus name |
| Building / room | Where on campus |
| Street address, city, state, ZIP | For maps and directions |
| Latitude / longitude | Map pin and nearest-location lookup |
| Directions note | How to find the entrance, landmarks |
| Accessibility note | Entrances, elevators, parking |
| Phone / contact email | Public contact |
| Photo | Storage image of the entrance or space |
| Timezone | Decides when a week starts and whether the pantry is open now |
| Weekly points | Default 16. This is also the cap; no carryover |
| Week start day | Day the weekly allotment resets |
| Active | Hide a location without deleting its history |

### Location hours
Regular weekly schedule. A day can have several rows (for example, a lunch window and an evening window) or none (closed).

| Field | Notes |
|---|---|
| Location ID | |
| Day of week | 0 to 6 |
| Opens / closes | Local time at the location's timezone |

### Location closures and special hours
One-off changes: holidays, breaks, weather, emergencies.

| Field | Notes |
|---|---|
| Location ID | |
| Start / end date-time | |
| Closed or special hours | Closed all period, or replacement open/close times |
| Reason / message | Shown to users; can feed the homepage closing/emergency splash |

"Open now" and "next opening" are computed from the weekly hours, then overridden by any closure, using the location's timezone.

### Location items (per-location stock and rules)
| Field | Notes |
|---|---|
| Location ID + Item ID | Together identify the row |
| Amount | Quantity in stock at this location |
| Available | Manual override (out of stock) |
| Limit per person | Nullable integer per week. `null` = no limit. Example: toiletries = 2 at this pantry |
| Points cost override | Nullable integer; overrides the shared item cost at this location |

The item catalog (name, tags, images, nutrition, points cost) is shared. Stock, availability and limits are per location.

### Accounts
| Field | Notes |
|---|---|
| Account ID | Unchangeable |
| Account permissions | user / cashier / stocker / admin |
| Email | |
| Password | Store hashed only |

### Other tables
- Orders and order items (transactions; feed the dashboard and promotions)
- Splash notices (location-specific announcements)
- Starred items / ping subscriptions
- Reports (bugs, issues, suggestions)
- Chat messages

## 2a. Business Rules and Architecture Decisions

**Rules belong to a location.** Each pantry has its own weekly points, week start, per-item limits and stock. The same item can have a different limit at each campus.

**Points (per location)**
- Default is **16 points per person per week**, set per location.
- Balance can never exceed the location's weekly points.
- Unspent points **do not carry over**; every week starts full.
- Checkout cannot spend more points than remain this week.
- Each location has a separate weekly balance for a person.
- Balance is derived: weekly points minus points spent in orders at this location this week.

**Per-person item limits (per location)**
- Stored on the location item as `limit_per_person` (for example, toiletries = 2).
- Reset with the location's weekly points period; tracked per Temple ID, location and item.
- Shown and enforced in the user's shopping list and again on the cashier screen.

**Identity (for now)**
- A person is identified by their **Temple ID**. No client account or email is required.
- The database stores a trimmed Temple ID in plaintext because cashier entry and weekly checks need a stable key. Only the trusted backend/service role and authorized staff can read orders; never include Temple IDs in public responses or logs. The public points-preview endpoint accepts a Temple ID and returns derived eligibility/balance information, so protect it against abuse before production use.
- The Temple ID and the **location ID** are included in the QR code and stored on each order.
- Weekly points and limits are tracked per Temple ID per location.

**Staff scope**
- Cashiers and stockers belong to one location and can only act on that location's stock and orders. Admins are global.

**Access model**
- Users have **read-only** access to the database (public key plus RLS `select` only).
- The shopping list is saved **locally on the device**, scoped to the chosen location.
- At checkout the user shows a **QR code containing the list**.
- The **cashier scans it, verifies the physical items**, edits if needed, and confirms.
- All writes (checkout, stock, items, accounts) go through the backend by staff roles.
- Checkout runs as one atomic database function that checks stock, limits and points for that location, records the order, and rejects a QR that was already redeemed.
- The QR includes a unique nonce, and checkout rejects any nonce already recorded in an order.

---

## 3. Features

### Core
- Location picker showing campus, address, hours and open-now status; directions link
- PWA (installable, offline-capable shopping list)
- Responsive item browsing with search, tag filters, item images, and a detail-page image carousel
- Product details include barcode, ingredients, package size, and nutrition when data is available
- Add to a location-scoped shopping list; multiple items per item allowed
- Quick-add stocked items from the catalog; show local availability and points
- Local list storage without requiring a client account
- QR code generated from the list with Temple ID, location ID, and a one-time nonce
- Weekly points and per-item limit preview; checkout eligibility is rechecked atomically
- Availability check: every time the items page opens, a read request goes to the DB
- Icon-led navigation for locations, shopping list, and sign-in; staff links are role-gated

### Splash / Promotion
- Homepage splash for newly added items
- "Frequently bought together" bottom splash
- Splash options for closings or emergencies

### Cashier tools
- Scan or paste a QR code; reject codes for a different location
- Review points/limits, add or drop items, undo, or enter items manually
- Attest to checking the physical Temple ID; checkout is blocked while closed

### Admin tools
- Location-filtered dashboard: bought items, items left, most popular
- Control account roles and revoke cashier access
- Publish location notices and schedule closures

### Stocker tools
- Add items
- Update availability on restock

### User extras
- Pings when starred items become available
- Recipe lookup
- Live chat for questions
- Bug / issue / suggestion box

These user extras are planned and are not implemented in the current app.

---

## 4. Database Interactions

| Role | Reads | Writes |
|---|---|---|
| User | Items, availability | Ping subscriptions (stars), reports |
| Cashier | Items, shopping lists | Item availability, transactions |
| Stocker | Items | New items, availability |
| Admin | Everything | Accounts and permissions, splash notices |

---

## 5. Open Questions
- Render free tier sleeps; upgrade or keep-alive?
- Public checkout-preview abuse controls (the current flow has no client account)
- Verified HSC location details and hours
- What point costs and stock should be assigned to the eight UPC-identified catalog items?
- Email and account login for clients remain out of scope; revisit for pings, reports and chat
- How are push pings delivered (web push, email)?
- Live chat: real-time staff chat or a bot?
- Recipe lookup: external API or built in?

## 6. Frontend Quality
- The catalog uses responsive product cards, search and category chips, availability labels, quick-add actions, new-item highlights, and empty/loading/error states.
- Shopping-list, location, staff, and admin workflows retain their pantry-specific behavior; the storefront is not a general checkout/e-commerce flow.
- Run `npm test` from `frontend/` for the frontend unit tests. Run `npm run build` there to verify the production build.
- Detailed implementation and verification status is tracked in [CURRENT_STATE.md](CURRENT_STATE.md) and [DELIVERABLES.md](DELIVERABLES.md).
