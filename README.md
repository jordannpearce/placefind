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
- After an admin signs in, **Admin** and **Sell** appear in the nav.
- `canManage` is the admin role only. Local/dev mode does not make every visitor an admin.

Create or sign in at [http://127.0.0.1:43141/admin](http://127.0.0.1:43141/admin).

App data (users, sessions, orders, issued licenses, mail outbox, rank campaigns) lives in Postgres when `DATABASE_URL` is set. Locally, if Postgres is not available, PlaceFind keeps using `.data/*.json` so `npm run dev` still works. Secret files (`hosted-keys.json`, license-admin config, mail API key) stay out of git.

## Railway and Postgres

Production start is `npm run start` (`NODE_ENV=production` + the built Express server). Do not use `npm run dev` on Railway.

1. Create a GitHub repo you own and push this branch.
2. Create a Railway project, add a **Postgres** plugin, and deploy this web service.
3. Railway injects `DATABASE_URL`. Set `NODE_ENV=production` and `ADMIN_EMAIL` to your admin inbox.
4. Copy seller tokens from local `.env` into Railway only if you need them; they are not required for the public site to boot.

`railway.toml` and `Dockerfile` are in the repo. Health check: `/api/health`.

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

Keys are encrypted on disk and inside the Windows setup. Buyers never see the values in Settings, and the installed copy has no Sell page. A determined person who unpacks the app could still recover them, so treat this as hiding keys from customers, not as a vault.

You can also build from a terminal:

```bash
# Linux (this project): needs the nsis package so makensis can write Setup.exe
sudo apt-get install -y nsis
npm run dist:win
```

That writes `/workspace/release/PlaceFind-Setup-1.0.0.exe` — a Windows installer with a license page, folder picker, desktop shortcut, Start menu shortcut, and uninstaller. On this computer the folder is `/workspace/release`. Copy that `.exe` to a Windows PC to test the installer. This Cloud machine is Linux, so the Setup file will not install here.

The setup file is unsigned unless you add your own Windows code-signing certificate. Windows may show SmartScreen the first time; buyers choose **More info → Run anyway**.

## Add your keys

On the seller machine, open **Sell** (or **Settings** on a copy that is not the public store):

1. Paste your Scrappey API key from [scrappey.com](https://scrappey.com).
2. Paste your DataForSEO dashboard login and **API password**.
3. Click **Test connection**, then search.

If you saved keys on **Sell**, buyers never see a key form. If you also connected Keygen, they unlock the app with the license key you assigned.

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
4. The results table shows keyword, rank (or not found), listing title, rating, address, Maps URL, and when it was scanned. The latest scan stays on the campaign, with recent runs underneath.

Rank scans use the same Maps search as the test scan. If Maps search is not set up, the scan returns an error instead of inventing ranks.

Keygen and Resend on **Admin** / **Sell** are separate: they issue and email Windows licenses. They are not required to create a campaign.

## Sample searches

- Franklin Barbecue — Austin, TX
- Joe's Pizza — New York, NY
- Pike Place Fish — Seattle, WA
