# PlaceFind

A web directory for local businesses. A shop can publish a listing for **$150 per month**, request a website crawl, and collect reviews on a public profile.

- UI: Vite + React + Tailwind in `src/`
- APIs: Express in `server/`
- Dev server: `npm run dev` on port 43141

## For visitors

- Home: [http://127.0.0.1:43141/](http://127.0.0.1:43141/)
- Directory: [http://127.0.0.1:43141/directory](http://127.0.0.1:43141/directory)
- Join: [http://127.0.0.1:43141/join](http://127.0.0.1:43141/join)
- Legal: `/terms` · `/policy` (`/privacy`) · `/email-policy` · `/data-policy` · `/refund`
- Crawlers: `/robots.txt` and `/sitemap.xml` are open, including scrappey.com

## For businesses

1. Create an account at `/join`.
2. Publish a listing for $150 per month (name, city, state, category, website).
3. Open **Crawl** in the dashboard and press **Crawl Website**. PlaceFind reads the site and sitemap, looks for license info and company facts, and writes a profile article. It does not change the listing form.
4. The public profile at `/listings/:id` shows that article and visitor reviews.

## Run it locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43141](http://127.0.0.1:43141).
