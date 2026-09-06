# PlaceFind

A web directory for local businesses. A shop can publish a listing for **$150 per month**, request a website crawl, and collect reviews on a public profile.

- UI: Vite + React + Tailwind in `src/`
- APIs: Express in `server/`
- Dev server: `npm run dev` on port 43141

## For visitors

- Home: [http://127.0.0.1:43141/](http://127.0.0.1:43141/)
- Directory: [http://127.0.0.1:43141/directory](http://127.0.0.1:43141/directory)
- Join to list a business: [http://127.0.0.1:43141/join](http://127.0.0.1:43141/join)
- Join free to review or request a quote: [http://127.0.0.1:43141/join?for=review](http://127.0.0.1:43141/join?for=review)
- Legal: `/terms` · `/policy` (`/privacy`) · `/email-policy` · `/data-policy` · `/refund`
- Crawlers: `/robots.txt` and `/sitemap.xml` are open, including scrappey.com

## Account types

- **Business** — $150 per month for an active listing, dashboard crawl, rank tracker, and traffic.
- **Neighbor** — free. Leave reviews and request quotes. Not billed $150.

## For businesses

1. Create a business account at `/join`.
2. Publish a listing for $150 per month (name, city, state, category, website).
3. Open **Dashboard** after you sign in. Press **Crawl Website** to write a public profile article. It does not change the listing form.
4. Signed-in owners also have **Rank tracker** and **Traffic** on the dashboard, Account, and `/track`. Those tools are not advertised on the public homepage or directory.
5. The public profile at `/listings/:id` shows that article and visitor reviews.

## Run it locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43141](http://127.0.0.1:43141).
