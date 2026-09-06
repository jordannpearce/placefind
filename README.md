# PlaceFind

Windows desktop software that looks up a Google Maps listing from a business name, city, and state.

It uses DataForSEO for live Google Maps search and Scrappey to open the listing page. You can bake your keys into the Windows installer so buyers search without pasting keys. Your API accounts are billed for those searches.

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
2. Paste your Scrappey key and DataForSEO login + API password, then click **Save keys into the setup**.
3. Set the price you charge (shown on the customer download page).
4. Download `PlaceFind-Setup-1.0.0.exe`, or copy it from `/workspace/release/`.
5. Send buyers the Setup file after they pay.

Keys stay in `.data/hosted-keys.json` on this machine (not committed) and are copied into the Windows app.

You can also build from a terminal:

```bash
# Linux (this project): needs the nsis package so makensis can write Setup.exe
sudo apt-get install -y nsis
npm run dist:win
```

That writes `/workspace/release/PlaceFind-Setup-1.0.0.exe` — a Windows installer with a license page, folder picker, desktop shortcut, Start menu shortcut, and uninstaller. On this computer the folder is `/workspace/release`. Copy that `.exe` to a Windows PC to test the installer. This Cloud machine is Linux, so the Setup file will not install here.

The setup file is unsigned unless you add your own Windows code-signing certificate. Windows may show SmartScreen the first time; buyers choose **More info → Run anyway**.

## Add your keys

Open **Settings** in the app:

1. Paste your Scrappey API key from [scrappey.com](https://scrappey.com).
2. Paste your DataForSEO dashboard login and **API password**.
3. Click **Test connection**, then search.

If you saved keys on **Sell**, buyers can skip this step.

## How a search works

1. Type a business name, city, and state.
2. DataForSEO searches Google Maps for that name in that city.
3. PlaceFind scores the results and picks the best listing match.
4. If Scrappey is enabled, it opens that listing page and merges missing details.

## Sample searches (no keys)

- Franklin Barbecue — Austin, TX
- Joe's Pizza — New York, NY
- Pike Place Fish — Seattle, WA
