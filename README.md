# SpotnSend Admin Dashboard

Admin web console for the SpotnSend schema. The React (Vite) app talks to Supabase on the client for reads and uses a small Express service (with the Supabase service role key) for privileged writes.

## Requirements
- Node.js 18+
- Supabase project with PostGIS enabled
- Buckets: `report-media`, `identity-docs`, `public-assets`
- Sentry DSNs (optional, but recommended)

## Database bootstrap
1. Install extensions, views, policies, RPCs:
   ```sh
   psql < migration.sql
   ```
2. Seed core lookup tables:
   ```sh
   psql < seeds.sql
   ```
3. Regenerate typed client helpers when the schema changes:
   ```sh
   npx supabase gen types typescript \
     --project-id <project-id> --schema public \
     > src/types/supabase.ts
   ```

## Environment variables
Copy `.env.local.example` to `.env.local` and fill in real values. Key entries:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` – browser client
- `SUPABASE_SERVICE_ROLE_KEY` – **server only**; never expose to the browser
- `VITE_API_BASE` – base URL that the browser uses for privileged API calls (defaults to `http://localhost:4000` during local dev)
- `MAPTILER_KEY` – map tiles + geolocation support
- `SENTRY_DSN` / `SENTRY_DSN_SERVER` – front-end and Express crash reporting
- `VITE_PLAUSIBLE_DOMAIN` or `VITE_GA_MEASUREMENT_ID` – optional analytics
- `VITE_BYPASS_AUTH` – set to `1` only in automated tests to skip Supabase auth

> Geolocation requires HTTPS in production. The map component renders a warning overlay when the app is served over plain HTTP on a non-localhost host.

## Running locally
1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the privileged API (loads `.env.local`):
   ```sh
   npm run server
   ```
3. In another shell start Vite:
   ```sh
   npm run dev
   ```
   By default the app expects the API at `http://localhost:4000`. Change `VITE_API_BASE` if you proxy through a different origin.

### Monitoring & analytics
- Sentry initialises automatically when `VITE_SENTRY_DSN` (client) or `SENTRY_DSN_SERVER` (server) is present.
- Plausible: set `VITE_PLAUSIBLE_DOMAIN` (and an optional `VITE_PLAUSIBLE_SCRIPT`).
- GA4: set `VITE_GA_MEASUREMENT_ID`.

## Cypress smoke tests
The suite expects the dashboard to auto-authenticate via `VITE_BYPASS_AUTH=1`.

1. In one terminal start Vite with the bypass flag:
   ```sh
   VITE_BYPASS_AUTH=1 npm run dev
   ```
2. In another terminal run the tests (they stub network calls):
   ```sh
   npm run test:e2e
   ```
   Use `npm run cy:open` for interactive debugging.

The smoke set covers:
- Map screen rendering and legend
- Realtime event bridge updating the incidents table
- Assign action issuing a privileged `/api/reports/:id` PATCH

## Deployment (Vercel example)
A `vercel.json` is provided:
- Static build of the Vite app (`npm run build` -> `dist`)
- Serverless function wrapping `server/index.js`
- `/api/*` routes forwarded to the Express handler

Set the following environment variables in Vercel (Preview + Production):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_API_BASE` (usually the deployed serverless endpoint)
- `MAPTILER_KEY`
- Monitoring/analytics keys as needed

Redeploy when the SQL layer changes or when regenerating Supabase types.

## Notes
- All `POST /api/*` endpoints require a Supabase admin session token; the middleware verifies the JWT and role via `users.role = 'admin'`.
- Privileged writes attempt to log into `audit_events`. If the table is absent the API degrades gracefully.
- `VITE_BYPASS_AUTH` and `VITE_BYPASS_AUTH=1` must never be enabled in real deployments.

