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
- [ ] Item fields: tags, points cost, nutrition label image, weight, ingredients, amount, limits, combos, out-of-stock, added date, extra images
- [ ] Profiles table (immutable Acct ID, permissions, email)
- [~] Shopping lists (exists, server-side)
- [ ] Transactions, stars/pings, splash notices, reports, chat tables
- [~] Seed data (7 generic items; replace with pantry items)

## D3. Auth and Roles
- [~] Login for all roles (email/password works; no roles)
- [ ] User / Cashier / Stocker / Admin permissions enforced in API
- [ ] Admin account control, including removing cashiers

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
- [ ] Enforce item limits
- [ ] Save list locally
- [ ] QR code generation from list

## D6. Cashier Tools
- [ ] QR scan
- [ ] Add / drop / undo / manual entry menu
- [ ] Change item availability

## D7. Stocker Tools
- [ ] Add items
- [ ] Update availability on restock

## D8. Admin Dashboard
- [ ] Bought items
- [ ] Items left
- [ ] Most popular

## D9. Splash and Promotion
- [ ] Homepage splash for new items
- [ ] Frequently bought together splash
- [ ] Closing / emergency notices

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
