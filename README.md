# GridPin

A Google Maps grid rank tracker. Drop a keyword and a business on a map, sample an N×N lattice of GPS points, and color each square by where that business ranks in the local Maps SERP.

GridPin talks to the [DataForSEO Google Maps SERP API](https://docs.dataforseo.com/v3/serp/google/maps/live/advanced/) using `location_coordinate` (`latitude,longitude,zoom`). Without credentials it runs a realistic Austin coffee demo so you can use the product immediately.

## What you can do

- Save your own DataForSEO login in Settings (or use `.env.local` / demo data)
- Look up a listing by business name, city, and state, then confirm it on Google Maps
- Create a campaign per brand and location
- Choose grid size (3×3 through 13×13) and a scan radius in miles
- Schedule daily or weekly ranking checks (due campaigns light up when you open GridPin)
- Watch pins fill in as each coordinate returns
- See ATR, local-pack share, coverage, competitors, review counts, and city/state names in listings

## Run it locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

### Live DataForSEO scans

Use **Settings** in the app to enter your DataForSEO API login and password (from [app.dataforseo.com](https://app.dataforseo.com/api-access)). Keys stay in this browser. You can also put them in `.env.local`:

```bash
DATAFORSEO_LOGIN=your_login
DATAFORSEO_PASSWORD=your_password
```

3. Restart the dev server. The header badge switches from **Demo data** to **DataForSEO live**.
4. Uncheck **Use demo data** and run a scan.

Each pin is one live Maps task. DataForSEO bills per task (about $0.002). A 7×7 scan is 49 tasks. Live calls allow one task per POST; GridPin fires them concurrently (4 at a time) to stay under the 2,000 calls/minute cap.

## How the grid works

1. Build a square lattice around the center. A 7×7 scan is 49 coordinates.
2. For each pin, POST to `https://api.dataforseo.com/v3/serp/google/maps/live/advanced` with the same keyword and a unique `location_coordinate`.
3. Read organic `maps_search` items. Match your business by name or Place ID and take `rank_group`.
4. Paint the square: green for the local pack (1–3), through yellow and red, gray if the listing is missing.

The standard `task_post` endpoint can batch up to 100 tasks per POST. This app uses the **live** endpoint so the map can update pin-by-pin without polling.

## Project layout

- `src/lib/grid.ts` — GPS lattice, mile-to-degree math, coordinate formatting
- `src/lib/dataforseo.ts` — live Maps client and business matching
- `src/lib/mock-scan.ts` — demo engine used when credentials are missing
- `src/app/api/scan-point/route.ts` — one coordinate per request
- `src/app/api/geocode/route.ts` — Nominatim search / reverse geocode
- `src/components/tracker-app.tsx` — scan orchestration and layout

## Notes

- Nominatim (OpenStreetMap) geocodes the center. No Google Maps JavaScript key is required.
- Demo rankings are geographically biased around real Austin coffee shops so the heatmap looks like a live scan.
- Do not commit `.env.local`.
