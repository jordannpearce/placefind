# GridPins

SaaS Google Maps grid rank tracker. Agencies and brands create a workspace, confirm a listing, and scan an N×N GPS lattice. An optional AI Visibility add-on ($199/month per brand) runs up to 10 prompts a month against ChatGPT, Perplexity, Gemini, Copilot, Google AI Mode, and Grok.

The marketing site, login, dashboard, and admin live in this same Next.js app. Without Maps API or Resend keys it still runs: accounts with access can use sample Austin coffee rankings, and emails land in a local inbox. Without a Cloro key, AI prompt scans use sample answers.

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

### Live Maps scans

Starter ($20) includes 5 live Maps scans each calendar month on the hosted admin key — that account never enters or sees a key. Extra scans are $5 each on Account.

Pro and Advanced paste their own Maps API login in **Account** or the tracker Settings gear. Admin can also put keys in `.env.local` for hosted Starter scans and the admin account:

```bash
DATAFORSEO_LOGIN=your_login
DATAFORSEO_PASSWORD=your_password
```

Optional extra-scan catalog overrides (otherwise GridPins can create the $5 product in Paddle):

```bash
PADDLE_EXTRA_SCAN_PRICE_ID=
PADDLE_EXTRA_SCAN_PRODUCT_ID=
```

Each pin is one live Maps task. A 7×7 scan is 49 tasks per keyword. Never send hosted API keys to the Starter client.

### AI Visibility add-on

$199 per month per brand, on every plan. Ten prompt scans per month. Paste the Cloro API key in **Admin** (or `CLORO_API_KEY`). Customers never see the key. Optional Paddle IDs:

```bash
CLORO_API_KEY=
PADDLE_AI_VISIBILITY_PRICE_ID=
PADDLE_AI_VISIBILITY_PRODUCT_ID=
```

If those Paddle IDs are empty, GridPins can create the $199/month product. Without a Cloro key, the workspace still shows sample model answers. Adding a brand asks for company name, address, phone, and website — each prompt scan checks whether those facts appear in the answers.

## Product

- Marketing site, pricing, contact form, and Get found opt-in
- Email/password accounts with activation
- Dashboard of campaigns per brand and location
- Tracker with multiple keywords, grid size, radius, and schedules
- Account billing via Paddle (overlay checkout, webhooks, customer portal): Starter $20 (1 campaign, 5 hosted live scans/month, extra scans $5), Pro $50 (5 campaigns, extra slots $5 each up to 10, own Maps API key), Advanced $250 (50 campaigns, own Maps API key). Optional AI Visibility $199/month per brand (10 prompt scans). Set the Paddle default payment link to `https://gridpins.com/pricing`. Railway: `PADDLE_API_KEY`, `PADDLE_ENVIRONMENT=production`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_PRICE_*`.
- Admin: users, agencies, impersonation, Resend, Cloro API key, targeted mail. Admins can create AI Visibility brands (company name, address, phone, website) and assign them to a user account or every account in an agency.
- Agency accounts have a Leads page for Get Found leads that were assigned and emailed to the agency.
- Public homepage ships an interactive sample map beside the hero so visitors can click pins without signing in

## How a grid scan works

1. Build a square lattice around the listing. A 7×7 scan is 49 coordinates.
2. POST one Maps task per pin with the searcher’s `location_coordinate` as `latitude,longitude,zoom`.
3. Match the business in the organic Maps results and take its rank.
4. Color the pin from green (local pack) through red.

## Notes

- Nominatim geocodes the center. No Google Maps JavaScript key is required.
- Do not commit `.env.local` or `.data/`.
