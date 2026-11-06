# Pantry Owl (FastAPI + Next.js + Supabase, deployed on Render)

Project docs: [PROJECT.md](PROJECT.md) · [DELIVERABLES.md](DELIVERABLES.md) · [CURRENT_STATE.md](CURRENT_STATE.md)

## 1. Supabase
1. Create a project at supabase.com.
2. From the repository root, run `npx supabase login`, `npx supabase link --project-ref <project-ref>`, then `npx supabase db push --remote` to apply the ordered migrations in `supabase/migrations/` to the linked project. This is the recommended setup for both new and existing projects. The linked project in this workspace already has D2; the D3-D9 migration is prepared but has not been pushed.
3. Alternatively, `supabase/schema.sql` is an idempotent full-schema script for the SQL Editor. Do not apply it and the CLI migrations as separate histories to the same project.
4. Existing category slugs are migrated to tags and the obsolete categories table is removed. The migration seeds Main Campus Cherry Pantry at 1755 N 13th St, Philadelphia, PA 19122, with the supplied Fall 2026 hours and `America/New_York` timezone. HSC details and real item stock/point costs still need verification.
5. Project Settings → API Keys: use the `sb_secret_...` key for backend `SUPABASE_SERVICE_KEY` and the `sb_publishable_...` key for frontend `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Keep the secret key server-side.
   The migrations grant the backend service role access to the application tables and sequences. If the database was set up before this grant migration, run `npx supabase db push --remote` again.
6. (Optional for dev) Authentication → Providers → Email → turn off "Confirm email".
7. To enable admin item tools, sign in once with the intended admin account, then promote that profile in the SQL Editor with `update public.profiles set role = 'admin' where email = 'admin@example.com';`. Admins can look up 12- or 13-digit barcodes in Open Food Facts, review the imported details, assign tags and point cost, and save the item to the shared catalog.

Shopping lists are stored locally by location. Temple IDs are encoded in pickup QR codes and stored in completed orders. The public points-preview endpoint accepts a Temple ID, so add an abuse-control mechanism before production use.

## 2. USDA key
Get a free key at https://fdc.nal.usda.gov/api-key-signup.html

## 3. Run locally
Backend:
    cd backend
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env   # fill in values
    uvicorn app.main:app --reload      # http://localhost:8000/docs

Frontend:
    cd frontend
    cp .env.example .env.local   # fill in values
    npm install
    npm run dev                  # http://localhost:3000
    npm test                     # frontend unit tests

## 4. Deploy on Render
1. Push this folder to a GitHub repo.
2. Render → New → Blueprint → select the repo (uses `render.yaml`).
3. Fill in the env vars for both services.
   - Backend `FRONTEND_ORIGIN` = the frontend's Render URL (no trailing slash).
   - Frontend `NEXT_PUBLIC_API_URL` = the backend's Render URL.
   - `NEXT_PUBLIC_*` vars are baked in at build time: redeploy the frontend after changing them.
4. Supabase → Authentication → URL Configuration: set Site URL to the frontend's Render URL.

Note: Render free web services sleep when idle, so the first request can be slow.
