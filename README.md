# Pantry Owl (FastAPI + Next.js + Supabase, deployed on Render)

Project docs: [PROJECT.md](PROJECT.md) · [DELIVERABLES.md](DELIVERABLES.md) · [CURRENT_STATE.md](CURRENT_STATE.md)

## 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor → paste and run `supabase/schema.sql` (idempotent schema/migration, RLS and generic item seed data). Existing category slugs are migrated to tags and the old categories table is removed. No real pantry location is seeded; add verified location details and hours before launch.
3. Project Settings → API Keys: use the `sb_secret_...` key for backend `SUPABASE_SERVICE_KEY` and the `sb_publishable_...` key for frontend `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Keep the secret key server-side.
4. (Optional for dev) Authentication → Providers → Email → turn off "Confirm email".
5. To enable admin item tools, sign in once with the intended admin account, then promote that profile in the SQL Editor with `update public.profiles set role = 'admin' where email = 'admin@example.com';`. Admins can look up 12- or 13-digit barcodes in Open Food Facts, review the imported details, assign tags and point cost, and save the item to the shared catalog.

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

## 4. Deploy on Render
1. Push this folder to a GitHub repo.
2. Render → New → Blueprint → select the repo (uses `render.yaml`).
3. Fill in the env vars for both services.
   - Backend `FRONTEND_ORIGIN` = the frontend's Render URL (no trailing slash).
   - Frontend `NEXT_PUBLIC_API_URL` = the backend's Render URL.
   - `NEXT_PUBLIC_*` vars are baked in at build time: redeploy the frontend after changing them.
4. Supabase → Authentication → URL Configuration: set Site URL to the frontend's Render URL.

Note: Render free web services sleep when idle, so the first request can be slow.
