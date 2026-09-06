# PlaceFind

Windows desktop software that looks up a Google Maps listing from a business name, city, and state.

It uses two keys the buyer already has:

- **DataForSEO** — live Google Maps search (`serp/google/maps/live/advanced`).
- **Scrappey** — opens the Maps listing page and fills in extra details.

Without keys, PlaceFind still runs in sample mode.

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

## Sell it and create a Windows setup

1. Open **Sell**.
2. Set the price you charge (shown on the customer download page).
3. Click **Create Windows setup**.
4. When the build finishes, download `PlaceFind-Setup-1.0.0.exe`.
5. Send buyers to **Download**, or attach the Setup file after they pay you.

You can also build from a terminal:

```bash
npm run dist:win
```

That writes:

- `release/PlaceFind-Setup-1.0.0.exe` — installer with a folder picker, desktop shortcut, and uninstaller
- `release/PlaceFind-Portable-1.0.0.exe` — single-file app, no install

The setup file is unsigned unless you add your own Windows code-signing certificate. Windows may show SmartScreen the first time; buyers choose **More info → Run anyway**.

## Add your keys

Open **Settings** in the app:

1. Paste your Scrappey API key from [scrappey.com](https://scrappey.com).
2. Paste your DataForSEO dashboard login and **API password**.
3. Click **Test connection**, then search.

Keys stay on that computer. Buyers use their own keys.

## How a search works

1. Type a business name, city, and state.
2. DataForSEO searches Google Maps for that name in that city.
3. PlaceFind scores the results and picks the best listing match.
4. If Scrappey is enabled, it opens that listing page and merges missing details.

## Sample searches (no keys)

- Franklin Barbecue — Austin, TX
- Joe's Pizza — New York, NY
- Pike Place Fish — Seattle, WA
