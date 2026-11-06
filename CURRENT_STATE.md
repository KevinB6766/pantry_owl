# Pantry Owl: Current State

**Last updated:** 2026-11-05 (after D1)
**Repo:** https://github.com/KevinB6766/pantry_owl.git
**Last commit reviewed:** `32a15e3` "Move Pantry Owl project to repository root" (2026-11-04). D1 changes are uncommitted until you push them.

## How to use this file
1. **Before starting a deliverable:** read its section here and its checklist in [DELIVERABLES.md](DELIVERABLES.md). Confirm repo state against it.
2. **While working:** set the deliverable status to In Progress and note blockers.
3. **After finishing:** update the deliverable's section (status, what exists, gaps, commit), tick items in DELIVERABLES.md, adjust Decisions, and add a Session Log line.

Status key: Not started · In progress · Done

---

## Overall Snapshot
A working prototype: a Next.js frontend and FastAPI backend on Supabase, with browse, search, item detail with USDA nutrition, email login, and a server-side shopping list. After D1 it is branded Pantry Owl and is an installable PWA with an offline page. It has no roles, no stock tracking, no QR, no dashboard yet.

## Stack (decided, from repo)
| Layer | Choice |
|---|---|
| Frontend | Next.js (`^16.4.5`, builds fine with React 18) + React 18 + TypeScript, App Router |
| Backend | FastAPI 0.115 + Uvicorn, Supabase Python client |
| Database / Auth | Supabase (Postgres, Supabase Auth email/password, RLS on) |
| External data | USDA FoodData Central (nutrition per 100 g, in-memory cache) |
| Hosting | Render via `render.yaml` (services `grocery-api`, `grocery-web`; free tier sleeps when idle) |

## What exists in the repo
- `supabase/schema.sql`: tables `categories`, `items`, `shopping_list`; RLS policies; 4 categories and 7 seed items
- `backend/app/`: `main.py` (routes), `auth.py` (validates Supabase token), `db.py`, `nutrition.py`
- API routes: `GET /health`, `/categories`, `/items` (filter by category, search by name), `/items/{id}`, `/items/{id}/nutrition`, `GET/POST/DELETE /list` (auth required)
- `frontend/src/`: pages for home (search and category chips), item detail (add to list, nutrition table), my list, login/sign-up; `NavBar`; `lib/api.ts`, `lib/supabase.ts`
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

### D2. Database: Not started (partial groundwork)
- **Exists:** `items` (id, name, description, price, image_url, category_id, nutrition_query), `categories`, `shopping_list`
- **Missing from spec:** immutable Item ID enforcement (id is `serial` but not locked), tags, points cost, nutrition label image, weight, ingredients text, amount, limits, combos, out-of-stock flag, added date, extra image URLs for carousel; profiles/roles table; transactions; stars/pings; splash notices; reports; chat
- **Note:** `categories` is not in the spec; decide whether it stays alongside tags

### D3. Auth and Roles: Not started (partial groundwork)
- **Exists:** Supabase email/password sign in and sign up; backend token validation via `current_user_id`
- **Missing:** profiles with roles (user/cashier/stocker/admin), permission checks on routes, admin account control, immutable Account ID

### D4. Item Browsing: Not started (partial groundwork)
- **Exists:** item grid, search, category filter, detail page, USDA nutrition table
- **Missing:** tag filters, image carousel, nutrition label image, ingredients, weight, out-of-stock state, availability read on open (items are read from DB but have no availability field)

### D5. Shopping List and QR: Not started (partial groundwork)
- **Exists:** server-side list (add, remove, quantity capped at 99), requires login
- **Missing:** local save and guest use, item limits, qty editing, QR generation

### D6. Cashier Tools: Not started
### D7. Stocker Tools: Not started
### D8. Admin Dashboard: Not started
### D9. Splash and Promotion: Not started
### D10. User Extras: Not started
### D11. Quality and Launch: Not started
- Deploy config exists; no tests in repo

## Decisions Made
- Stack: Next.js + FastAPI + Supabase on Render
- Service worker never caches API calls (availability must be fresh)
- Four roles: user, cashier, stocker, admin
- Item ID and Account ID are immutable
- Nutrition currently comes from USDA lookup (spec also wants an uploaded label image and ingredient text)

## Decisions Pending
- Keep or replace `categories` (spec uses tags)
- Points vs price model
- Push ping method (web push vs email)
- Live chat approach
- Recipe lookup source
- Whether guests can build and save a list without an account
- Upgrade Render plan or add a keep-alive so the API doesn't sleep
- Rename Render services (grocery-* to pantry-owl-*)

## Blockers
None.

## Next Up
D2 Database. Decide first: keep `categories` or switch to tags, and points vs price.

## Session Log
- 2026-11-05: Created PROJECT.md, DELIVERABLES.md, CURRENT_STATE.md from feature checklist.
- 2026-11-05: Reviewed repo (commit `32a15e3`), found existing stack and prototype, rewrote all three files to match.
- 2026-11-05: D1 completed. Rebranded, verified build, added PWA shell and docs. Render rename deferred.
