# Pantry Owl: Current State

**Last updated:** 2026-11-06 (D2 schema implemented; location data pending)
**Repo:** https://github.com/KevinB6766/pantry_owl.git
**Last commit reviewed:** `791274d` "Implement admin barcode item entry workflow and update related documentation" (2026-11-06). The D2 schema and tag UI changes in this working tree are uncommitted.

## How to use this file
1. **Before starting a deliverable:** read its section here and its checklist in [DELIVERABLES.md](DELIVERABLES.md). Confirm repo state against it.
2. **While working:** set the deliverable status to In Progress and note blockers.
3. **Tests:** run `pytest tests/` after any change to these docs or the schema. `tests/test_patch2_docs.py` checks that the three docs agree with each other and with the decided rules.
4. **After finishing:** update the deliverable's section (status, what exists, gaps, commit), tick items in DELIVERABLES.md, adjust Decisions, and add a Session Log line.

Status key: Not started · In progress · Done

---

## Overall Snapshot
A working prototype: a Next.js frontend and FastAPI backend on Supabase, with browse, search, item detail with USDA nutrition, email login, and a server-side shopping list. After D1 it is branded Pantry Owl and is an installable PWA with an offline page. Admin barcode item entry is implemented. The D2 schema now defines locations, stock, weekly points, staff profiles, orders and atomic checkout; no real location is seeded yet, and cashier/stocker checkout routes are not implemented.

## Stack (decided, from repo)
| Layer | Choice |
|---|---|
| Frontend | Next.js (`^16.4.5`, builds fine with React 18) + React 18 + TypeScript, App Router |
| Backend | FastAPI 0.115 + Uvicorn, Supabase Python client |
| Database / Auth | Supabase (Postgres, Supabase Auth email/password, RLS on) |
| External data | USDA FoodData Central (nutrition per 100 g, in-memory cache) |
| Hosting | Render via `render.yaml` (services `grocery-api`, `grocery-web`; free tier sleeps when idle) |

## What exists in the repo
- `supabase/schema.sql`: rerunnable migration from categories to item tags; catalog, profiles, locations/hours/closures, location stock, combos, orders and atomic checkout; RLS; 7 generic seed items
- `backend/app/`: `main.py` (routes), `auth.py` (validates Supabase token), `db.py`, `nutrition.py`
- API routes: `GET /health`, `/tags`, `/items` (filter by tag, search by name), `/items/{id}`, `/items/{id}/nutrition`, `GET/POST/DELETE /list` (auth required)
- `frontend/src/`: pages for home (search and tag chips), item detail (add to list, nutrition table), my list, login/sign-up; `NavBar`; `lib/api.ts`, `lib/supabase.ts`
- `README.md`: Supabase setup, USDA key, local run, Render deploy
- `.env.example` files for both apps

## Deliverable State

### D1. Foundation: DONE (2026-11-05)
- **Done:** stack chosen; repo structure; README and deploy steps; `render.yaml`; env examples; rebrand to Pantry Owl; verified `npm ci` and `npm run build` succeed; PWA shell; project docs added to repo
- **PWA shell contents:** `src/app/manifest.ts` (standalone, theme `#1f4d3a`), `public/sw.js`, `src/components/ServiceWorkerRegister.tsx` (production only), `src/app/offline/page.tsx`, owl icons in `public/icons/` and `src/app/icon.png`, `/sw.js` no-cache headers in `next.config.js`
- **Caching rule (important for later deliverables):** the service worker caches the app shell and static assets only. It never caches cross-origin requests, so API reads for item availability always hit the database
- **Verified:** production build passes; manifest, icons, offline page and `sw.js` headers all serve correctly; head tags present
- **Not verified:** installing on a real phone, Lighthouse PWA audit, and the offline fallback in a browser (tested by serving files only, not with a browser)
- **Deferred on purpose:** Render service names are still `grocery-api` / `grocery-web`. Renaming them in a Blueprint creates new services with new URLs, so do it only when you are ready to redeploy and update `FRONTEND_ORIGIN`, `NEXT_PUBLIC_API_URL` and the Supabase Site URL
- **Placeholder:** the owl icon is a generated placeholder; swap in real artwork any time (keep the same filenames and sizes)
- **Open risk carried forward:** Render free tier sleeps when idle, which slows the first availability read (see Decisions Pending)

### D2. Database: In Progress (schema foundation implemented)
- **Exists:** immutable catalog IDs, tags (migrated from old categories), shared points cost with location override, nutrition/weight/ingredients/images/combos, location details/hours/closures, per-location stock and weekly limits, staff profiles, orders, order snapshots, atomic checkout, read-only RLS and the existing shopping-list table (read-only policy)
- **Migration behavior:** `supabase/schema.sql` is idempotent for existing projects, migrates category slugs into tags, then removes the obsolete category table/column. Item point costs remain unset until configured; checkout rejects an item whose effective points cost is unset.
- **Still needed:** verified location records and hours, real pantry seed data and point costs; exercise the migration and checkout against a Supabase/Postgres project; staff-management and cashier/stocking API routes; non-database D2 features (stars/pings, splash notices, reports, chat)

### D3. Auth and Roles: In Progress (profile schema implemented)
- **Exists:** Supabase email/password sign in and sign up; backend token validation via `current_user_id`
- **Also exists:** profiles with immutable IDs, roles and optional location assignment; checkout function checks cashier/admin location authorization
- **Missing:** cashier/stocker permission checks on future routes and admin account control

### D4. Item Browsing: In Progress (partial groundwork)
- **Exists:** item grid, search, tag filter, detail page, USDA nutrition table
- **Missing:** image carousel, nutrition label image display, ingredients/weight display, out-of-stock state, location-specific availability

### D5. Shopping List and QR: Not started (partial groundwork)
- **Exists:** server-side list (add, remove, quantity capped at 99), requires login
- **Missing:** local save and guest use, item limits, qty editing, QR generation

### D6. Cashier Tools: Not started
### D7. Stocker Tools: Not started
### D8. Admin Dashboard: In Progress (barcode item entry implemented)
- **Exists:** Admin-only barcode lookup and catalog entry; global admin role
- **Missing:** bought-item, stock, and popularity dashboards; location filtering; general account and permission management
### D9. Splash and Promotion: Not started
### D10. User Extras: Not started
### D11. Quality and Launch: Not started
- Deploy config exists; no tests in repo

## Decisions Made
- Identity for now is the normalized Temple ID only (no client account or email); it is stored as plaintext on orders, included in the QR, and restricted to trusted backend/staff access
- Users are read-only on the database; shopping list is stored locally; checkout is a QR code the cashier scans and verifies
- Rules are assigned to a **location** (multiple pantries on different campuses): weekly points (default 16, cap, no carryover), weekly per-item limits, stock and staff are all per location
- Each location also stores address, coordinates, contact info, notes, timezone, a weekly hours schedule and one-off closures; open-now is computed, not stored
- Item catalog is shared; stock, availability and `limit_per_person` live on a per-location item row
- Item points costs are shared by default, with an optional per-location override; category slugs migrate to tags
- Week start defaults to Monday; each location must provide its timezone
- Admins are global; cashiers and stockers require one assigned location
- Weekly balance is derived from this week's orders at that location, so no reset job is needed
- QR carries Temple ID, location ID and the list
- Stack: Next.js + FastAPI + Supabase on Render
- Service worker never caches API calls (availability must be fresh)
- Four roles: user, cashier, stocker, admin
- Item ID and Account ID are immutable
- Nutrition currently comes from USDA lookup (spec also wants an uploaded label image and ingredient text)

## Decisions Pending
- Whether the cashier verifies the Temple ID against a physical ID
- Client email/accounts set aside; revisit for pings, reports and chat
- Whether checkout is blocked outside operating hours
- How a user chooses a location
- Whether cashiers can override limits or the points cap
- Verified details/hours for the initial location records
- Point costs for the existing sample items
- Push ping method (web push vs email)
- Live chat approach
- Recipe lookup source
- Upgrade Render plan or add a keep-alive so the API doesn't sleep
- Rename Render services (grocery-* to pantry-owl-*)

## Blockers
None.

## Next Up
Add verified location data and point costs, then validate the D2 schema and checkout on Supabase/Postgres before building the cashier/stocker routes.

## Session Log
- 2026-11-05: Created PROJECT.md, DELIVERABLES.md, CURRENT_STATE.md from feature checklist.
- 2026-11-05: Reviewed repo (commit `32a15e3`), found existing stack and prototype, rewrote all three files to match.
- 2026-11-05: D1 completed. Rebranded, verified build, added PWA shell and docs. Render rename deferred.
- 2026-11-05: Recorded points rule (16/week, no carryover), per-person limits, and read-only/QR architecture in all three files.
- 2026-11-05: Identity set to Temple ID only; email and accounts deferred.
- 2026-11-05: Moved rules, stock and limits to a per-location model; added location details, weekly hours and closures.
- 2026-11-06: Started an admin-only Open Food Facts barcode item-entry workflow; full role management and dashboard remain out of scope.
- 2026-11-06: Implemented the D2 schema migration (tags, locations, stock, roles, orders, atomic checkout and RLS); moved browse/admin catalog surfaces from categories to tags.
