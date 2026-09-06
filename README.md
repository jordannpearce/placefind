# PlaceFind

Windows desktop software that looks up a Google Maps listing from a business name, city, and state.

It uses two keys you already have:

- **DataForSEO** — live Google Maps search (`serp/google/maps/live/advanced`). This returns structured name, address, phone, rating, hours, place ID, and CID.
- **Scrappey** — opens the Maps listing page in a real browser session and fills in extra details DataForSEO missed.

Without keys, PlaceFind still runs in sample mode so you can try the workflow.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43141](http://127.0.0.1:43141).

On Windows, after `npm install`:

```bash
npm run desktop
```

That starts the local server and opens the Electron window.

## Build a Windows installer

On a Windows machine with Node 20+:

```bash
npm run dist:win
```

`release/` will contain an NSIS installer and a portable `.exe`.

## Add your keys

Open **Settings** in the app:

1. Paste your Scrappey API key from [scrappey.com](https://scrappey.com).
2. Paste your DataForSEO dashboard login and **API password** (not the website password).
3. Click **Test connection**, then search.

Keys are stored only on that computer (`localStorage` in the desktop window). You can also put defaults in a `.env` file:

```bash
cp .env.example .env
```

## How a search works

1. You type a business name, city, and state.
2. DataForSEO searches Google Maps for that name in that city.
3. PlaceFind scores the results and picks the best listing match.
4. If Scrappey is enabled, it opens that listing page and merges phone, website, hours, and claim status when they were missing.

## Sample searches (no keys)

- Franklin Barbecue — Austin, TX
- Joe's Pizza — New York, NY
- Pike Place Fish — Seattle, WA
