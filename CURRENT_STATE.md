# Pantry Owl: Current State

**Last updated:** 2026-11-06 (UPC catalog and USDA lookup updates; migrations pending push)
**Repo:** https://github.com/KevinB6766/pantry_owl.git
**Last commit reviewed:** `791274d` "Implement admin barcode item entry workflow and update related documentation" (2026-11-06). The D2 schema migration and Supabase project config are in this working tree.

## How to use this file
1. **Before starting a deliverable:** read its section here and its checklist in [DELIVERABLES.md](DELIVERABLES.md). Confirm repo state against it.
2. **While working:** set the deliverable status to In Progress and note blockers.
3. **Tests:** run `pytest tests/` after any change to these docs or the schema. `tests/test_patch2_docs.py` checks that the three docs agree with each other and with the decided rules.
4. **After finishing:** update the deliverable's section (status, what exists, gaps, commit), tick items in DELIVERABLES.md, adjust Decisions, and add a Session Log line.

Status key: Not started · In progress · Done

---

## Overall Snapshot
A working prototype: a Next.js frontend and FastAPI backend on Supabase, with browsing, staff roles, location-scoped local lists and QR pickup. D3-D9 code and the follow-up migrations are implemented locally. Only the D2 migration has been pushed to Supabase; workflow, permission, and UPC catalog migrations remain pending and are not live-verified.

## Stack (decided, from repo)
| Layer | Choice |
|---|---|
| Frontend | Next.js (`^16.4.5`, builds fine with React 18) + React 18 + TypeScript, App Router |
| Backend | FastAPI 0.115 + Uvicorn, Supabase Python client |
| Database / Auth | Supabase (Postgres, Supabase Auth email/password, RLS on) |
| External data | USDA FoodData Central (generic nutrition per 100 g, branded UPCs per serving, in-memory cache) |
| Hosting | Render via `render.yaml` (services `grocery-api`, `grocery-web`; free tier sleeps when idle) |

## What exists in the repo
- `supabase/schema.sql`: idempotent full schema for SQL Editor setup; includes D2 and D3-D9 objects, RLS, and 8 UPC-identified catalog items
- `supabase/migrations/`: D2 foundation is pushed; workflow, service-role grant, and UPC catalog migrations are pending push
- `backend/app/`: `main.py`, `auth.py`, `security.py`, `workflows.py`, `db.py`, `nutrition.py`
- API includes catalog browsing, role checks, checkout preview and atomic cashier checkout, location/stock/dashboard/admin workflows, notices, and promotions
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

### D2. Database: In Progress (schema foundation implemented and pushed)
- **Exists:** immutable catalog IDs, tags (migrated from old categories), shared points cost with location override, nutrition/weight/ingredients/images/combos, location details/hours/closures, per-location stock and weekly limits, staff profiles, orders, order snapshots, atomic checkout, and read-only RLS
- **Migration behavior:** `supabase/schema.sql` is idempotent for existing projects, migrates category slugs into tags, then removes the obsolete category table/column. Item point costs remain unset until configured; checkout rejects an item whose effective points cost is unset.
- **Applied:** migration `20261106031500_d2_database_foundation.sql` was pushed to the linked production Supabase project on 2026-11-06; a subsequent remote dry run confirmed it is up to date.
- **Still needed:** assign point costs and stock real pantry items; exercise checkout behavior against the live database; D3-D9 migration and workflows are not live yet; D10 extras remain out of scope

### D3. Auth and Roles: Implemented locally; pending live verification
- Staff role and location authorization; admin role management and cashier demotion

### D4. Item Browsing: Implemented locally
- Location-scoped item availability, image carousel, nutrition labels, ingredients, and weight

### D5. Shopping List and QR: Implemented locally
- Guest local lists, Temple ID preview, weekly points/`limit_per_person` checks, and QR generation

### D6. Cashier Tools: Implemented locally; pending live verification
- Camera/paste QR checkout, physical Temple ID attestation, manual line edits/undo, availability updates, and closed-hours enforcement

### D7. Stocker Tools: Implemented locally; pending live verification
- Add catalog items to location inventory; update stock, availability, weekly limits, and points overrides

### D8. Admin Dashboard: Implemented locally; pending live verification
- Location dashboard, account role management, cashier demotion, catalog tools, notices, and closures

### D9. Splash and Promotion: Implemented locally
- Location pages, newly stocked item splash, and order-derived frequently bought together
- **Main Campus seed:** Main Campus Cherry Pantry, 1755 N 13th St, Philadelphia, PA 19122; wheelchair accessible; 16 weekly points; Monday-Friday hours supplied for Fall 2026; timezone `America/New_York`
- **Not seeded:** HSC location (complete verified address/hours not provided); catalog inventory and generic item point costs remain unconfigured
- **Migration:** `20261106033000_d3_d9_workflows.sql` is local and pending user push; no D3-D9 production verification has occurred
### D10. User Extras: Not started
### D11. Quality and Launch: In Progress
- Deploy config and documentation tests exist; workflow integration/live database tests, accessibility/mobile review, and production deployment remain

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
- Cashier must attest to checking the physical Temple ID; checkout is blocked outside location hours; no cashier overrides
- Main Campus uses `America/New_York` (not fixed `EST`) to handle daylight-saving changes
- The D3-D9 migration is prepared but will not be pushed until the user applies/reviews it
- Stack: Next.js + FastAPI + Supabase on Render
- Service worker never caches API calls (availability must be fresh)
- Four roles: user, cashier, stocker, admin
- Item ID and Account ID are immutable
- Nutrition data comes from USDA lookup; optional nutrition label images, ingredients, and package weight are supported in the catalog

## Decisions Pending
- Point costs and real inventory for the generic sample items
- Verified HSC location details and hours
- Public checkout preview exposes derived points/limit eligibility to anyone who knows a Temple ID; decide whether to add client authentication or an abuse-control mechanism before production use
- Client accounts remain out of scope for D5; revisit for pings, reports and chat
- Push ping method (web push vs email), live chat approach, and recipe lookup source
- Upgrade Render plan or add a keep-alive so the API doesn't sleep; rename Render services when redeploying
- Push ping method (web push vs email)
- Live chat approach
- Recipe lookup source
- Upgrade Render plan or add a keep-alive so the API doesn't sleep
- Rename Render services (grocery-* to pantry-owl-*)

## Blockers
None.

## Next Up
User applies the D3-D9 migration, then verify the database workflows and assign real pantry inventory/point costs before launch.

## Session Log
- 2026-11-05: Created PROJECT.md, DELIVERABLES.md, CURRENT_STATE.md from feature checklist.
- 2026-11-05: Reviewed repo (commit `32a15e3`), found existing stack and prototype, rewrote all three files to match.
- 2026-11-05: D1 completed. Rebranded, verified build, added PWA shell and docs. Render rename deferred.
- 2026-11-05: Recorded points rule (16/week, no carryover), per-person limits, and read-only/QR architecture in all three files.
- 2026-11-05: Identity set to Temple ID only; email and accounts deferred.
- 2026-11-05: Moved rules, stock and limits to a per-location model; added location details, weekly hours and closures.
- 2026-11-06: Started an admin-only Open Food Facts barcode item-entry workflow; full role management and dashboard remain out of scope.
- 2026-11-06: Implemented the D2 schema migration (tags, locations, stock, roles, orders, atomic checkout and RLS); moved browse/admin catalog surfaces from categories to tags.
- 2026-11-06: Implemented D3-D9 workflows, UI, and Main Campus location seed. Frontend build and Python compilation pass; migration is pending user push and live database verification.
- 2026-11-06: Replaced generic catalog seed items with eight products found from supplied UPCs; added exact USDA Branded Foods UPC lookup. Two UPCs had no catalog matches and were omitted as requested.
