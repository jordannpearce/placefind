import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { LEGAL_PAGES, legalNavLinks } from "./legal.ts"
import { isPublicVendorLeak } from "./public-copy.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const PUBLIC_FILES = [
  "App.tsx",
  "components/HomePage.tsx",
  "components/LegalPage.tsx",
  "components/SiteFooter.tsx",
  "components/SearchForm.tsx",
  "components/ResultPanel.tsx",
  "components/DirectoryPage.tsx",
  "components/PricingPage.tsx",
  "components/ListingDetailPage.tsx",
  "components/ListingFormPage.tsx",
  "components/BusinessUpgradeCard.tsx",
  "components/AuthPage.tsx",
  "components/JoinPage.tsx",
  "components/CreateProfilePage.tsx",
  "components/AccountPage.tsx",
  "components/CrawlDashboard.tsx",
  "components/UsageCard.tsx",
  "components/OwnerDeskTools.tsx",
  "lib/legal.ts",
  "lib/nav.ts",
]

const PUBLIC_MARKETING_FILES = [
  "components/HomePage.tsx",
  "components/DirectoryPage.tsx",
  "components/PricingPage.tsx",
  "components/SiteFooter.tsx",
  "components/AuthPage.tsx",
  "components/JoinPage.tsx",
  "components/CreateProfilePage.tsx",
  "components/ListingDetailPage.tsx",
  "components/LegalPage.tsx",
  "lib/legal.ts",
]

const RANK_TRAFFIC_MARKETING =
  /rank tracker|traffic generator|start traffic|grid tracker|\/track|#traffic/i

describe("public website copy", () => {
  it("has footer legal links without vendor names", () => {
    const labels = legalNavLinks().map((link) => link.label)
    assert.deepEqual(labels, ["Terms", "Policy", "Email policy", "Data policy", "Refunds"])
    for (const page of LEGAL_PAGES) {
      assert.equal(isPublicVendorLeak(page.title + page.intro), false, page.title)
      for (const section of page.sections) {
        assert.equal(isPublicVendorLeak(section.heading), false, section.heading)
        for (const paragraph of section.body) {
          assert.equal(isPublicVendorLeak(paragraph), false, paragraph.slice(0, 80))
          assert.equal(/\bip address\b|per ip|we log your|rate limit/i.test(paragraph), false, paragraph.slice(0, 80))
        }
      }
    }
  })

  it("keeps public UI files free of vendor names", () => {
    for (const rel of PUBLIC_FILES) {
      const text = readFileSync(path.join(root, rel), "utf8")
      assert.equal(isPublicVendorLeak(text), false, rel)
      assert.equal(/cloro/i.test(text), false, rel)
    }
  })

  it("always offers the quote form and never mentions a missing listing email", () => {
    const page = readFileSync(path.join(root, "components/ListingDetailPage.tsx"), "utf8")
    assert.match(page, /Request a quote/)
    assert.match(page, /Anyone can request a quote/)
    assert.match(page, /Sent\. The shop can write you at the email you left\./)
    assert.equal(/has not published a contact email/i.test(page), false)
    assert.equal(/owner can add one when they edit/i.test(page), false)
    assert.equal(/hasQuoteEmail === false/.test(page), false)
  })

  it("keeps Join and Create a Profile as separate public forms", () => {
    const join = readFileSync(path.join(root, "components/JoinPage.tsx"), "utf8")
    const profile = readFileSync(path.join(root, "components/CreateProfilePage.tsx"), "utf8")
    const auth = readFileSync(path.join(root, "components/AuthPage.tsx"), "utf8")
    assert.match(join, /Join PlaceFind/)
    assert.match(join, /Neighbor account/)
    assert.match(join, /signup\(/)
    assert.equal(/signupBusiness/.test(join), false)
    assert.equal(/\$150/.test(join), false)
    assert.equal(/list your business/i.test(join), false)
    assert.match(profile, /Create a Profile/)
    assert.match(profile, /Business owner/)
    assert.match(profile, /signupBusiness/)
    assert.match(profile, /LISTING_PRICE_LABEL/)
    assert.equal(/free neighbor account/i.test(profile), false)
    assert.equal(/kind:/.test(join), false)
    assert.equal(/kind:/.test(profile), false)
    assert.equal(/signup\(/.test(auth), false)
  })

  it("does not advertise a used-search or IP limit", () => {
    const home = readFileSync(path.join(root, "components/HomePage.tsx"), "utf8")
    assert.equal(/already in use|you('ve| have) used|ip limit|logged your ip/i.test(home), false)
  })

  it("keeps Google Maps off the homepage and prices a listing at $150 per month", () => {
    const home = readFileSync(path.join(root, "components/HomePage.tsx"), "utf8")
    const listingForm = readFileSync(path.join(root, "components/ListingFormPage.tsx"), "utf8")
    assert.equal(/google maps/i.test(home), false)
    assert.match(listingForm, /Search Google Maps/)
    assert.match(listingForm, /Add listing manually/)
    assert.match(home, /LISTING_PRICE_LABEL|listingPriceCopy|\$150/)
    assert.match(home, /business directory/i)
    assert.match(home, /No listings yet/)
    assert.match(home, /does not ship with sample shops/)
    assert.match(home, /free account/)
    assert.match(home, /not billed/)
    assert.equal(/sample listings you can open today/i.test(home), false)
    const directory = readFileSync(path.join(root, "components/DirectoryPage.tsx"), "utf8")
    assert.match(directory, /No listings yet/)
    assert.match(directory, /no sample shops/)
    assert.equal(/Harbor & Oak/.test(directory), false)
    const pricing = readFileSync(path.join(root, "lib/pricing.ts"), "utf8")
    assert.match(pricing, /\$150 per month/)
    const pricingPage = readFileSync(path.join(root, "components/PricingPage.tsx"), "utf8")
    assert.match(pricingPage, /LISTING_PRICE_LABEL|\$150/)
    assert.match(pricingPage, /Neighbor/)
    assert.match(pricingPage, /free/i)
    assert.match(pricingPage, /not bill/)
  })

  it("keeps Track, Traffic, and rank-generator copy off public marketing pages", () => {
    for (const rel of PUBLIC_MARKETING_FILES) {
      const text = readFileSync(path.join(root, rel), "utf8")
      assert.equal(RANK_TRAFFIC_MARKETING.test(text), false, rel)
    }
  })

  it("exposes Rank tracker and Traffic on signed-in owner pages", () => {
    const account = readFileSync(path.join(root, "components/AccountPage.tsx"), "utf8")
    const dashboard = readFileSync(path.join(root, "components/CrawlDashboard.tsx"), "utf8")
    const desk = readFileSync(path.join(root, "components/OwnerDeskTools.tsx"), "utf8")
    const nav = readFileSync(path.join(root, "lib/nav.ts"), "utf8")
    for (const [rel, text] of [
      ["AccountPage", account],
      ["CrawlDashboard", dashboard],
      ["OwnerDeskTools", desk],
      ["nav", nav],
    ] as const) {
      assert.match(text, /Rank tracker/, rel)
      assert.match(text, /Traffic/, rel)
    }
    assert.match(desk, /\/track/)
    assert.match(account, /\/track/)
    assert.match(nav, /\/track/)
    assert.match(dashboard, /OwnerDeskTools/)
  })

  it("loads the Google measurement tag once, immediately after the site head", () => {
    const html = readFileSync(path.resolve(root, "..", "index.html"), "utf8")
    assert.match(html, /<head>\s*<!-- Google tag \(gtag\.js\) -->/)
    assert.equal((html.match(/googletagmanager\.com\/gtag\/js\?id=G-K9S9SHZMSF/g) ?? []).length, 1)
    assert.equal((html.match(/gtag\('config', 'G-K9S9SHZMSF'\)/g) ?? []).length, 1)
    assert.equal((html.match(/googletagmanager\.com\/gtag\/js/g) ?? []).length, 1)
  })

  it("does not mention download, Windows, or license keys on the public site", () => {
    const banned = /download for windows|windows desktop|windows app|setup\.exe|license key|keygen|activation code/i
    for (const rel of PUBLIC_FILES) {
      const text = readFileSync(path.join(root, rel), "utf8")
      assert.equal(banned.test(text), false, rel)
    }
  })
})
