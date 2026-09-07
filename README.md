# PlaceFind

A web directory for local businesses. A shop can publish a listing for **$150 per month**, request a website crawl, and collect reviews on a public profile.

- UI: Vite + React + Tailwind in `src/`
- APIs: Express in `server/`
- Dev server: `npm run dev` on port 43141

## For visitors

- Home: [http://127.0.0.1:43141/](http://127.0.0.1:43141/)
- Directory: [http://127.0.0.1:43141/directory](http://127.0.0.1:43141/directory)
- Pricing: [http://127.0.0.1:43141/pricing](http://127.0.0.1:43141/pricing)
- Join free to review: [http://127.0.0.1:43141/join](http://127.0.0.1:43141/join)
- Create a Profile to list a business: [http://127.0.0.1:43141/create-profile](http://127.0.0.1:43141/create-profile)
- Legal: `/terms` · `/policy` (`/privacy`) · `/email-policy` · `/data-policy` · `/refund`
- Crawlers: `/robots.txt` and `/sitemap.xml` are open, including scrappey.com

## Account types

- **Business** — $150 per month for an active listing, dashboard crawl, rank tracker, and traffic.
- **Neighbor** — free. Leave reviews and request quotes. Not billed $150.

## For businesses

1. Create a business owner account at `/create-profile`.
2. Publish a listing for $150 per month (name, city, state, category, website).
3. On **Edit listing**, write the public article, H1–H6 headings, custom HTML, page title, meta description, header tags, and schema. **Crawl Website** can draft an article from the shop site. It does not change the listing form, and it does not replace a profile you already customized.
Public login and password-reset links use **https://placefind.to**.
4. Signed-in owners also have **Rank tracker** and **Traffic** on the dashboard, Account, and `/track`. Those tools are not advertised on the public homepage or directory.
5. The public profile at `/listings/:id` shows that owner-written profile and visitor reviews.

## Run it locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43141](http://127.0.0.1:43141).
