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
- [~] Items table (exists; missing most spec fields)
- [ ] Immutable Item ID enforced (trigger)
- [ ] Locations table (immutable Location ID, name, campus, building/room, street address, lat/long, directions and accessibility notes, phone/email, photo, timezone, weekly points default 16, week start day, active)
- [ ] Location hours table (weekly schedule, multiple windows per day)
- [ ] Location closures / special hours table (holidays, emergencies, with user-facing message)
- [ ] Seed one or two sample locations with hours
- [ ] Location items table: per-location amount, availability override, `limit_per_person` (nullable)
- [ ] Item catalog fields (shared): tags, points cost, nutrition label image, weight, ingredients, combos, added date, extra images
- [ ] Staff profiles tied to a location (cashier, stocker); admin scope decided
- [ ] Weekly points per location (default 16, cap = weekly points, no carryover; balance derived from this week's spend at that location)
- [ ] Orders and order_items, keyed by Temple ID and location ID (store points and quantity per line; used for weekly points, limits and dashboard)
- [ ] Atomic checkout function (stock, limits, points, duplicate-QR rejection)
- [ ] RLS: read-only for users, no public writes
- [ ] Profiles table (immutable Acct ID, permissions, email)
- [~] Shopping lists (exists, server-side)
- [ ] Transactions, stars/pings, splash notices, reports, chat tables
- [~] Seed data (7 generic items; replace with pantry items)

## D3. Auth and Roles
- [~] Login for all roles (email/password works; no roles)
- [ ] User / Cashier / Stocker / Admin permissions enforced in API
- [ ] Admin account control, including removing cashiers
- [ ] Staff limited to their own location

## D4. Item Browsing
- [~] Item list, search, category filter, detail page
- [ ] Tag filtering
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
