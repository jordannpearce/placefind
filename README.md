# PlaceFind

Web directory for local businesses, with a Google Maps cross-check.

- UI: Vite + React + Tailwind in `src/`
- APIs: Express in `server/`
- Dev server: `npm run dev` on port 43141

## For visitors

The public homepage explains how PlaceFind helps people find businesses, and helps businesses list themselves and confirm a matching Google Maps place.

- Home: [http://127.0.0.1:43141/](http://127.0.0.1:43141/)
- Directory: [http://127.0.0.1:43141/directory](http://127.0.0.1:43141/directory)
- Join: [http://127.0.0.1:43141/join](http://127.0.0.1:43141/join)
- Create listing (signed-in): [http://127.0.0.1:43141/listings/new](http://127.0.0.1:43141/listings/new)
- Internal test scan (signed-in): [http://127.0.0.1:43141/try](http://127.0.0.1:43141/try)
- Legal: `/terms` · `/policy` (`/privacy`) · `/email-policy` · `/data-policy` · `/refund`

Visitors can browse the directory and try one sample Maps lookup. Extra public lookups ask them to create an account. Live test scans live on `/try` after sign-in.

## How a business lists itself

1. Create an account at `/join`.
2. Open **Create listing** and enter name, city, state, category, keywords, and optional phone, website, and hours.
3. Click **Check Google Maps**. PlaceFind searches that name in that city.
4. Confirm the matching place, or mark it as not found.
5. The public profile at `/listings/:id` shows the PlaceFind listing plus Maps status (found, not found, or pending).

## Run it locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43141](http://127.0.0.1:43141).

## Admin

Admin is hidden from regular visitors. `/admin` shows a sign-in form only until an admin session exists.

- The first account created on this machine becomes admin.
- Any later signup whose email matches `ADMIN_EMAIL` (comma-separated in `.env`) also becomes admin. Do not put passwords in source.
- After an admin signs in, **Admin** appears in the nav. Public visitors never see Admin.
- Signed-in admins use **/admin** to create, edit, delete, or suspend users, and to manage directory listings. Suspended accounts cannot sign in.
- `canManage` is the admin role only.

Create or sign in at [http://127.0.0.1:43141/admin](http://127.0.0.1:43141/admin).

App data (users, sessions, listings, campaigns) lives in Postgres when `DATABASE_URL` is set. Locally, if Postgres is not available, PlaceFind keeps using `.data/*.json` so `npm run dev` still works.

## Railway and Postgres

Production start is `npm run start` (`NODE_ENV=production` + the built Express server). Do not use `npm run dev` on Railway.

On boot the app creates users, sessions, listings, campaigns, and related tables if they are missing (`server/schema.sql`). To re-apply that schema when `DATABASE_URL` can reach the database:

```bash
npm run db:migrate
```

Set `NODE_ENV=production` and `ADMIN_EMAIL` to your admin inbox.

Rank scans and live Maps search need these service variables (same names as local `.env`):

- `DATAFORSEO_LOGIN`
- `DATAFORSEO_PASSWORD`
- `SCRAPPEY_API_KEY`

The public site boots without them, but Track rank scans return “Maps search is not configured”. Health check: `/api/health`.

## Track Maps ranks

Signed-in customers can still open **Track** to watch how a confirmed business appears across an area.

1. Open **Track**.
2. Create a campaign with a name, the business to watch, its city and state, then add keywords people would type on Google Maps.
3. Confirm the Maps listing, then scan.
4. Saved scans stay on the campaign (Postgres `scan_runs`, or `.data/scan-runs.json` when Postgres is not set).

## Sample directory listings

The directory seeds a few local profiles so it is not empty: Harbor & Oak Bakery (Portland, ME), Red Mesa Dental (Santa Fe, NM), Northside Bike Works (Minneapolis, MN), Citrus & Salt Seafood (Tampa, FL), Copper Bell Books (Asheville, NC), and Lamppost Hardware (Boise, ID).
