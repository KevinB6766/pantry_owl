# Pantry Owl: Deliverables

Status key: `[ ]` not started · `[~]` partly in repo · `[x]` done
**Always read and update [CURRENT_STATE.md](CURRENT_STATE.md) before and after each deliverable.** Context in [PROJECT.md](PROJECT.md).

## D1. Foundation: DONE (2026-11-05)
- [x] Choose tech stack (Next.js, FastAPI, Supabase, Render)
- [x] Repo structure, README, setup and deploy instructions
- [x] Rebrand "Grocery" to Pantry Owl (titles, navbar, API title, package name). Render service names deliberately unchanged; see CURRENT_STATE.md
- [x] Verify clean install and build (Next 16 with React 18 builds fine)
- [x] PWA shell (manifest, icons, service worker, offline page)
- [x] Add PROJECT / DELIVERABLES / CURRENT_STATE to repo

## D2. Database
- [x] Items table, migrated from categories to tags; catalog point costs still need configuration
- [x] Immutable Item ID enforced (trigger)
- [x] Locations table (immutable ID, contact/address fields, timezone, weekly points default 16, Monday week start, active)
- [x] Location hours table (weekly schedule, multiple windows per day)
- [x] Location closures / special hours table (message and replacement hours)
- [x] Seed Main Campus Cherry Pantry with verified hours; HSC details are still needed
- [x] Location items table: per-location amount, availability, `limit_per_person` (nullable), points-cost override
- [x] Item catalog fields: tags, points cost, nutrition label image, weight, ingredients, combos, added date, extra images
- [x] Staff profiles tied to a location (cashier/stocker); admins are global
- [x] Weekly points per location (default 16, cap = weekly points, no carryover; balance derived from this week's spend)
- [x] Orders and order_items, keyed by Temple ID and location ID (snapshot points and quantities)
- [~] Atomic checkout function (stock, weekly limits, points, duplicate-QR nonce rejection; D3-D9 live migration verification pending)
- [x] RLS: public reads for catalog/location data; no direct public writes
- [x] Profiles table (immutable account ID, role, email)
- [x] Shopping lists are stored locally by location; no client account is needed
- [x] Transaction/order tables and splash notices
- [ ] Stars/pings, reports, and chat tables
- [~] Seed data (8 UPC-identified items; configure point costs)

## D3. Auth and Roles
- [x] Staff login uses Supabase email/password profiles
- [x] User / Cashier / Stocker / Admin permissions and location scope enforced in API
- [x] Admin role assignment and cashier access revocation

## D4. Item Browsing
- [x] Item list, search, tag filter, detail page
- [x] Tag filtering
- [x] Image carousel
- [x] Nutrition table, label image, and ingredients
- [x] Weight display
- [x] Location-specific availability read on page open
- [x] Out-of-stock state

## D5. Shopping List and QR
- [x] Add to list and edit quantities without a client login
- [x] Choose location (address, hours, open-now status); lists are location-scoped
- [x] Ask for Temple ID; QR contains Temple ID, location ID, list, and a one-time nonce
- [x] Show remaining weekly points and enforce `limit_per_person`; block an ineligible QR
- [x] Save list locally
- [x] Generate pickup QR

## D6. Cashier Tools
- [x] Camera scan or paste a QR; reject a QR for a different location
- [x] Review points total, remaining balance, and per-person limit warnings
- [x] Add / drop / undo / manual entry
- [x] Change item availability and stock; physical Temple ID attestation required
- [x] Checkout blocked while the location is closed; cashier overrides are not allowed

## D7. Stocker Tools
- [x] Add catalog items to a location's inventory
- [x] Update quantity, availability, weekly limit, and points override

## D8. Admin Dashboard
- [x] Admin item creation from a reviewed 12- or 13-digit barcode lookup (Open Food Facts)
- [x] Bought items
- [x] Items left
- [x] Most popular
- [x] Filter dashboard by location
- [x] Manage user roles and remove cashier access

## D9. Splash and Promotion
- [x] Homepage splash for newly stocked items
- [x] Frequently bought together based on completed orders
- [x] Per-location notices and closing / emergency notices
- [x] Location info page: address, map/directions link, hours, closures, accessibility, contact

## D10. User Extras
- [ ] Star items and availability pings
- [ ] Recipe lookup
- [ ] Live chat
- [ ] Bug / issue / suggestion box

## D11. Quality and Launch
- [ ] Testing (roles, QR flow, offline)
- [ ] Accessibility and mobile pass
- [ ] Production deployment (API wake-up issue resolved)
- [ ] User and admin documentation
