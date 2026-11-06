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
- [~] Items table, migrated from categories to tags; points costs still need to be assigned
- [x] Immutable Item ID enforced (trigger)
- [x] Locations table (immutable ID, contact/address fields, timezone, weekly points default 16, Monday week start, active)
- [x] Location hours table (weekly schedule, multiple windows per day)
- [x] Location closures / special hours table (message and replacement hours)
- [ ] Seed one or two real locations with hours (waiting for verified pantry details)
- [x] Location items table: per-location amount, availability, `limit_per_person` (nullable), points-cost override
- [x] Item catalog fields: tags, points cost, nutrition label image, weight, ingredients, combos, added date, extra images
- [x] Staff profiles tied to a location (cashier/stocker); admins are global
- [x] Weekly points per location (default 16, cap = weekly points, no carryover; balance derived from this week's spend)
- [x] Orders and order_items, keyed by Temple ID and location ID (snapshot points and quantities)
- [~] Atomic checkout function (stock, weekly limits, points, duplicate-QR nonce rejection; live database verification pending)
- [x] RLS: public reads for catalog/location data; no direct public writes
- [x] Profiles table (immutable account ID, role, email)
- [~] Shopping lists (exists, server-side)
- [ ] Transactions, stars/pings, splash notices, reports, chat tables
- [~] Seed data (7 generic items; configure point costs and replace with pantry items)

## D3. Auth and Roles
- [~] Login for staff roles (email/password works; role profiles exist)
- [~] User / Cashier / Stocker / Admin permissions enforced in API (admin catalog and checkout checks exist; remaining routes pending)
- [ ] Admin account control, including removing cashiers
- [~] Staff limited to their own location (checkout checks exist; stocker routes pending)

## D4. Item Browsing
- [~] Item list, search, tag filter, detail page
- [x] Tag filtering
- [ ] Image carousel
- [~] Nutrition (USDA table exists; label image and ingredients missing)
- [ ] Weight display
- [ ] Availability read on every page open
- [ ] Out-of-stock state

## D5. Shopping List and QR
- [~] Add to list, quantities (login required)
- [ ] Choose location (shows address, hours, open now); list is scoped to it
- [ ] Ask for Temple ID in the list; include Temple ID and location ID in the QR
- [ ] Show points remaining (of the location's weekly points) and block adding past the weekly balance
- [ ] Enforce the location's `limit_per_person` in the list UI (for example, "2 max")
- [ ] Save list locally
- [ ] QR code generation from list

## D6. Cashier Tools
- [ ] QR scan (rejects a QR for a different location)
- [ ] Review screen shows points total, remaining balance, and per-person limit warnings
- [ ] Add / drop / undo / manual entry menu
- [ ] Change item availability

## D7. Stocker Tools
- [ ] Add items
- [ ] Update availability on restock

## D8. Admin Dashboard
- [x] Admin item creation from a reviewed 12- or 13-digit barcode lookup (Open Food Facts)
- [ ] Bought items
- [ ] Items left
- [ ] Most popular
- [ ] Filter dashboard by location

## D9. Splash and Promotion
- [ ] Homepage splash for new items
- [ ] Frequently bought together splash
- [ ] Closing / emergency notices (per location, linked to closures table)
- [ ] Location info page: address, map/directions link, hours, closures, contact

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
