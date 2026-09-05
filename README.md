# GridPins

SaaS Google Maps grid rank tracker. Agencies and brands create a workspace, confirm a listing, and scan an N×N GPS lattice through the DataForSEO Maps SERP API.

The marketing site, login, dashboard, and admin live in this same Next.js app. Without DataForSEO or Resend keys it still runs: accounts with access can use sample Austin coffee rankings, and emails land in a local inbox.

## Run it locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

### Seeded accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | tmrapp1995@gmail.com | (the password you set when the project was created) |

There is no public demo account. Self-serve signups stay unpaid with no tracker access until they subscribe. To let someone try the product, create them in Admin and set a trial length (hours or days). That stores `trial_ends_at` on the user. When it expires and they have no active Paddle subscription, they get the same paywall as unpaid accounts.

Without `DATABASE_URL`, accounts live in `.data/gridpin.json` (gitignored). Delete that file to reseed.

With `DATABASE_URL` (Railway Postgres), the same seed runs on the first empty database.

### Resend emails

Paste a Resend API key and from-address in **Admin → Emails**, or set `RESEND_API_KEY` and `RESEND_FROM`. If those are empty, GridPins writes the HTML to the outbox. Sign-up shows **Open the activation email**, and admins can browse every message under **Admin → Emails**.

From Admin you can:

- Add users and agencies by hand, including a trial timer for testers
- Open a user’s workspace as if you were them
- Check which accounts receive marketing, product updates, and notifications

### Live DataForSEO scans

Starter ($20) includes 5 live Maps scans each calendar month on the admin DataForSEO key — that account never enters or sees a key. Extra scans are $5 each on Account.

Pro and Advanced paste their own DataForSEO login in **Account** or the tracker Settings gear. Admin can also put keys in `.env.local` for hosted Starter scans and the admin account:

```bash
DATAFORSEO_LOGIN=your_login
DATAFORSEO_PASSWORD=your_password
```

Optional extra-scan catalog overrides (otherwise GridPins can create the $5 product in Paddle):

```bash
PADDLE_EXTRA_SCAN_PRICE_ID=
PADDLE_EXTRA_SCAN_PRODUCT_ID=
```

Each pin is one live Maps task (~$0.002). A 7×7 scan is 49 tasks per keyword. Never send hosted API keys to the Starter client.

## Product

- Marketing site, pricing, contact form, and Get found opt-in
- Email/password accounts with activation
- Dashboard of campaigns per brand and location
- Tracker with multiple keywords, grid size, radius, and schedules
- Account billing via Paddle (overlay checkout, webhooks, customer portal): Starter $20 (1 campaign, 5 hosted live scans/month, extra scans $5), Pro $50 (5 campaigns, extra slots $5 each up to 10, own DataForSEO key), Advanced $250 (50 campaigns, own DataForSEO key). Set the Paddle default payment link to `https://gridpins.com/pricing`. Railway: `PADDLE_API_KEY`, `PADDLE_ENVIRONMENT=production`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_PRICE_*`.
- Admin: users, agencies, impersonation, Resend, targeted mail

## How a grid scan works

1. Build a square lattice around the listing. A 7×7 scan is 49 coordinates.
2. POST each pin to `https://api.dataforseo.com/v3/serp/google/maps/live/advanced` with `location_coordinate` as `latitude,longitude,zoom`.
3. Match the business in organic `maps_search` items and take `rank_group`.
4. Color the pin from green (local pack) through red.

## Notes

- Nominatim geocodes the center. No Google Maps JavaScript key is required.
- Do not commit `.env.local` or `.data/`.
