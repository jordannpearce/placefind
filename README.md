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
3. Connect [Keygen.sh](https://keygen.sh): paste your account ID, PlaceFind product ID, policy ID, and an admin or product token, then click **Save Keygen**.
4. After a sale, issue a key from **Admin** (emails the buyer) or **Sell** (copy the key).
5. Set the price you charge (shown on Buy and Download).
6. Download `PlaceFind-Setup-1.0.0.exe`, or copy it from `/workspace/release/`.
7. Buyers can also sign up at **/buy**, pay, and receive the key on their account page.

The Keygen admin token never goes into the installer. Buyer copies only get your public account and product IDs so they can validate a key. The seller copy on this machine does not ask for a customer license.

## License store and admin

Open [http://127.0.0.1:43141/buy](http://127.0.0.1:43141/buy) for customer signup and purchase. The first account created on this machine is an admin. Admins use **/admin** to issue Keygen keys and **/sell** to build the Windows setup.

Paste a [Resend](https://resend.com) API key on **Admin** to send:

- a welcome email after signup
- a license email with the Keygen key and download steps after a purchase or a manual issue

Until Resend is connected, those messages stay in the Admin outbox on this computer. Use `onboarding@resend.dev` as the from address while you test. Card charges are recorded locally in this preview; Stripe can be added later.

The Keygen admin token never goes into the installer. Buyer copies only get your public account and product IDs so they can validate a key. The seller copy on this machine does not ask for a customer license.

Keys are encrypted on disk and inside the Windows setup. Buyers never see the values in Settings, and the installed copy has no Sell page. A determined person who unpacks the app could still recover them, so treat this as hiding keys from customers, not as a vault.

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

If you saved keys on **Sell**, buyers never see a key form. If you also connected Keygen, they unlock the app with the license key you assigned.

Optional Keygen defaults for the seller machine:

```bash
KEYGEN_ACCOUNT_ID=
KEYGEN_PRODUCT_ID=
KEYGEN_POLICY_ID=
KEYGEN_TOKEN=
```

## How a search works

1. Type a business name, city, and state.
2. DataForSEO searches Google Maps for that name in that city.
3. PlaceFind scores the results and picks the best listing match.
4. If Scrappey is enabled, it opens that listing page and merges missing details.

## Sample searches (no keys)

- Franklin Barbecue — Austin, TX
- Joe's Pizza — New York, NY
- Pike Place Fish — Seattle, WA
