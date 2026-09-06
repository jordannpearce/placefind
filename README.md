# PlaceFind

Windows desktop software that looks up a Google Maps listing from a business name, city, and state, and can track where that listing ranks.

## For visitors

Open the site and run a **test scan**. Enter a business name, city, and state to see the same listing result PlaceFind shows on Windows: name, address, phone, rating, and a Maps link.

- Test scan: [http://127.0.0.1:43141/](http://127.0.0.1:43141/)
- Buy: [http://127.0.0.1:43141/buy](http://127.0.0.1:43141/buy)
- Download: [http://127.0.0.1:43141/download](http://127.0.0.1:43141/download)

The public site does not ask visitors for setup details. Buy a license, download the Windows setup, and unlock the desktop app with the key from your account page. Admin and seller tools are not in the public navigation.

## Run it locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43141](http://127.0.0.1:43141).

On Windows, after `npm install`:

```bash
npm run desktop
```

## Admin login

Admin is hidden from regular visitors. `/admin` shows a sign-in form only — no customer lists, keys, or seller chrome — until an admin session exists.

- The first account created on this machine becomes admin.
- Any later signup whose email matches `ADMIN_EMAIL` (comma-separated in `.env`) also becomes admin. Do not put passwords in source.
- After an admin signs in, **Admin** and **Sell** appear in the nav. Public visitors never see Admin.
- Signed-in admins use **/admin** to create, edit, delete, or suspend users. Suspended accounts cannot sign in on the website or desktop app.
- `canManage` is the admin role only. Local/dev mode does not make every visitor an admin.

Create or sign in at [http://127.0.0.1:43141/admin](http://127.0.0.1:43141/admin).

App data (users, sessions, orders, issued licenses, mail outbox, rank campaigns) lives in Postgres when `DATABASE_URL` is set. Locally, if Postgres is not available, PlaceFind keeps using `.data/*.json` so `npm run dev` still works. Secret files (`hosted-keys.json`, license-admin config, mail API key) stay out of git.

## Railway and Postgres

Production start is `npm run start` (`NODE_ENV=production` + the built Express server). Do not use `npm run dev` on Railway.

The Railway project **placefind** already has a **Postgres** service. It is linked to the **placefind** web service, so Railway injects `DATABASE_URL`. You do not need to create another database. To look at it: Railway dashboard → **placefind** → **Postgres**.

On boot the app creates users, sessions, orders, issued licenses, mail outbox, campaigns, and hosted_keys if they are missing (`server/schema.sql`). To re-apply that schema when `DATABASE_URL` can reach the database:

```bash
npm run db:migrate
```

Set `NODE_ENV=production` and `ADMIN_EMAIL` to your admin inbox.

Rank scans and live Maps search on Railway need these service variables (same names as local `.env`):

- `DATAFORSEO_LOGIN`
- `DATAFORSEO_PASSWORD`
- `SCRAPPEY_API_KEY`

The public site boots without them, but Track rank scans return “Maps search is not configured”. Saving keys on **Admin** writes the sealed file and, when `DATABASE_URL` is set, a `hosted_keys` row. Railway disk is not durable, so keep the three variables on the **placefind** service as well. Do not commit the values.

`railway.toml` and `Dockerfile` are in the repo. Health check: `/api/health`.

## City GPS backup

`data/uscities.csv` is the US city GPS point file (about 2 MB, ~31k cities). On boot PlaceFind streams that file into the city GPS backup — it is not loaded as one JSON blob. Track can place a regular grid around the confirmed listing, or use the nearest N CSV points for that city/state (same-state cities when the file has one row per city).

Admin → **City GPS backup** shows the imported point count and accepts a re-upload. Railway disk is not durable; if the bundled file is missing after a redeploy, upload the same CSV there (or click **Load US cities file**). When `DATABASE_URL` is set, imported points are also stored in Postgres (`geo_points` / `geo_imports`).

The file’s headers are `city`, `state abbreviation`, `state name`, `latitude`, `longitude`, `population`, `military`, `incorporated`, `zips`. PlaceFind maps city, the 2-letter state, lat, lng, zips, and population from those names.

## Sell it and create a Windows setup

1. Open **Sell**.
2. Paste your Scrappey key and DataForSEO login + API password, then click **Save keys into the setup**.
3. Connect [Keygen.sh](https://keygen.sh): paste your account ID, PlaceFind product ID, policy ID, and an admin or product token, then click **Save Keygen**.
4. After a sale, issue a key from **Admin** (emails the buyer) or **Sell** (copy the key).
5. Set the price you charge (shown on Buy and Download).
6. Download `PlaceFind-Setup-1.0.0.exe`, or copy it from `/workspace/release/`.
7. Buyers can also sign up at **/buy**, pay, and receive the key on their account page.

The Keygen admin token never goes into the installer. Buyer copies only get your public account and product IDs so they can validate a key. The seller copy on this machine does not ask for a customer license.

## License store and admin

Open [http://127.0.0.1:43141/buy](http://127.0.0.1:43141/buy) for customer signup and purchase. The first account created on this machine is an admin. Admins use **/admin** to issue Keygen keys and **/sell** to build the Windows setup.

Paste a [Resend](https://resend.com) API key on **Admin** to send:

- a welcome email after signup
- a license email with the license key and download steps after a purchase or a manual issue

Until Resend is connected, those messages stay in the Admin outbox on this computer. Use `onboarding@resend.dev` as the from address while you test. Card charges are recorded locally in this preview; Stripe can be added later.

The Keygen admin token never goes into the installer. Buyer copies only get your public account and product IDs so they can validate a key. The seller copy on this machine does not ask for a customer license.

Keys are encrypted on disk and inside the Windows setup. Buyers never see the values, and the public Test scan has no Settings or API-key form. The installed copy has no Sell page. A determined person who unpacks the app could still recover them, so treat this as hiding keys from customers, not as a vault.

You can also build from a terminal:

```bash
# Linux (this project): needs the nsis package so makensis can write Setup.exe
sudo apt-get install -y nsis
npm run dist:win
```

That writes `/workspace/release/PlaceFind-Setup-1.0.0.exe` — a Windows installer with a license page, folder picker, desktop shortcut, Start menu shortcut, and uninstaller. On this computer the folder is `/workspace/release`. Copy that `.exe` to a Windows PC to test the installer. This Cloud machine is Linux, so the Setup file will not install here.

The setup file is unsigned unless you add your own Windows code-signing certificate. Windows may show SmartScreen the first time; buyers choose **More info → Run anyway**.

## Add your keys

On the seller machine, open **Admin** (Maps search / Scan services). **Sell** can still bake the same keys into the Windows setup:

1. Paste your Scrappey API key from [scrappey.com](https://scrappey.com).
2. Paste your DataForSEO dashboard login and **API password**.
3. Save. The public Test scan uses those keys and never shows the values.

If you saved keys on **Admin**, visitors never see a key form. If you also connected Keygen, they unlock the app with the license key you assigned.

Optional Keygen defaults for the seller machine:

```bash
KEYGEN_ACCOUNT_ID=
KEYGEN_PRODUCT_ID=
KEYGEN_POLICY_ID=
KEYGEN_TOKEN=
```

## How a search works

1. Type a business name, city, and state.
2. Search Google Maps in that city.
3. PlaceFind scores the results and picks the best listing match.
4. Open the listing page for extra details.

## Track Maps ranks

1. Open **Track**.
2. Create a campaign with a name, the business to watch, its city and state, then add up to 20 keywords people would type on Google Maps.
3. Click **Scan keywords** (or **Scan** on one keyword). Search Google Maps in that city and record the rank of the listing that matches your business name.
4. The results table shows keyword, rank (or not found), listing title, rating, address, Maps URL, and when it was scanned. Every finished grid scan is saved on the campaign (Postgres `scan_runs` table, or `.data/scan-runs.json` when Postgres is not set).
5. **Scan history** lists those snapshots. **Rerun** runs the same keyword, grid, and center again. **Compare** two saved scans (or latest vs previous) to see per-pin rank change: improved, worse, same, new, or lost.
6. **Schedules** can run scans and traffic daily or weekly at a local or UTC time. The Express server checks once a minute. It will not start a second scan or traffic job if one is already running. Stop still cancels an in-progress traffic job.

On Railway, keep a **single web replica**. Multiple copies would each fire the same scheduled scan or traffic job.

Rank scans use the same Maps search as the test scan. If Maps search is not set up, the scan returns an error instead of inventing ranks.

Grid cells call DataForSEO Maps with `location_coordinate` as `latitude,longitude,zoom` (max 7 decimals; zoom 3–21). One task per pin, batched up to 100 per `task_post`. DataForSEO applies **17z** when zoom is omitted — that is street-level “search this area,” so a 1-mile neighbor often omits the listing. PlaceFind uses **14z** for 1-mile cells (~2–3 mile viewport; 13z when spacing is 1.5+ miles, 15z at 0.5 mile). Every finished pin is rank, not found (red), or error — never left blank.

A US city GPS CSV is a **backup of coordinates only**. It does not replace rank results. After you confirm a listing on Track, choose **Grid around listing** (the usual 3×3 / 5×5 / 7×7) or **City GPS backup** (nearest imported city points around that listing, still 3 / 5 / 7). If a cell has no nearby city point, PlaceFind keeps the computed coordinate. Upload the full file on **Admin → City GPS backup**. A small sample lives at `data/us-cities-sample.csv`. Points are stored in Postgres `geo_points` when `DATABASE_URL` is set, or in `.data/geo-points.json` locally.

Keygen and Resend on **Admin** / **Sell** are separate: they issue and email Windows licenses. They are not required to create a campaign.

## Sample searches

- Franklin Barbecue — Austin, TX
- Joe's Pizza — New York, NY
- Pike Place Fish — Seattle, WA
