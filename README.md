# GridPins

SaaS Google Maps grid rank tracker. Agencies and brands create a workspace, confirm a listing, and scan an N×N GPS lattice through the DataForSEO Maps SERP API.

The marketing site, login, dashboard, and admin live in this same Next.js app. Without DataForSEO or Resend keys it still runs: rankings use the Austin coffee demo, and emails land in a local inbox.

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
| Demo user | demo@gridpin.app | demo1234 |
| Admin | tmrapp1995@gmail.com | (the password you set when the project was created) |

Without `DATABASE_URL`, accounts live in `.data/gridpin.json` (gitignored). Delete that file to reseed.

With `DATABASE_URL` (Railway Postgres), the same seed runs on the first empty database.

### Resend emails

Paste a Resend API key and from-address in **Admin → Emails**, or set `RESEND_API_KEY` and `RESEND_FROM`. If those are empty, GridPins writes the HTML to the outbox. Sign-up shows **Open the activation email**, and admins can browse every message under **Admin → Emails**.

From Admin you can:

- Add users and agencies by hand
- Open a user’s workspace as if you were them
- Check which accounts receive marketing, product updates, and notifications

### Live DataForSEO scans

Paste a DataForSEO login in **Account** or the tracker Settings gear, or put it in `.env.local`:

```bash
DATAFORSEO_LOGIN=your_login
DATAFORSEO_PASSWORD=your_password
```

Each pin is one live Maps task (~$0.002). A 7×7 scan is 49 tasks per keyword.

## Product

- Marketing site and pricing
- Email/password accounts with activation
- Dashboard of campaigns per brand and location
- Tracker with multiple keywords, grid size, radius, and schedules
- Account billing plans (emails, no Stripe checkout yet): Entry $20 (1 campaign), Growth $50 (5 campaigns, extra slots $5 each up to 10), Agency $250 (50 campaigns)
- Admin: users, agencies, impersonation, Resend, targeted mail

## How a grid scan works

1. Build a square lattice around the listing. A 7×7 scan is 49 coordinates.
2. POST each pin to `https://api.dataforseo.com/v3/serp/google/maps/live/advanced` with `location_coordinate` as `latitude,longitude,zoom`.
3. Match the business in organic `maps_search` items and take `rank_group`.
4. Color the pin from green (local pack) through red.

## Notes

- Nominatim geocodes the center. No Google Maps JavaScript key is required.
- Do not commit `.env.local` or `.data/`.
