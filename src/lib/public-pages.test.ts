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
  "components/ListingDetailPage.tsx",
  "components/ListingFormPage.tsx",
  "components/AuthPage.tsx",
  "components/AccountPage.tsx",
  "components/CrawlDashboard.tsx",
  "components/UsageCard.tsx",
  "lib/legal.ts",
  "lib/nav.ts",
]

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

  it("does not advertise a used-search or IP limit", () => {
    const home = readFileSync(path.join(root, "components/HomePage.tsx"), "utf8")
    assert.equal(/already in use|you('ve| have) used|ip limit|logged your ip/i.test(home), false)
  })

  it("keeps Google Maps off the homepage and prices a listing at $150 per month", () => {
    const home = readFileSync(path.join(root, "components/HomePage.tsx"), "utf8")
    assert.equal(/google maps/i.test(home), false)
    assert.match(home, /LISTING_PRICE_LABEL|listingPriceCopy|\$150/)
    assert.match(home, /business directory/i)
    assert.match(home, /No listings yet/)
    assert.match(home, /does not ship with sample shops/)
    assert.equal(/sample listings you can open today/i.test(home), false)
    const directory = readFileSync(path.join(root, "components/DirectoryPage.tsx"), "utf8")
    assert.match(directory, /No listings yet/)
    assert.match(directory, /no sample shops/)
    assert.equal(/Harbor & Oak/.test(directory), false)
    const pricing = readFileSync(path.join(root, "lib/pricing.ts"), "utf8")
    assert.match(pricing, /\$150 per month/)
  })

  it("does not mention download, Windows, or license keys on the public site", () => {
    const banned = /download for windows|windows desktop|windows app|setup\.exe|license key|keygen|activation code/i
    for (const rel of PUBLIC_FILES) {
      const text = readFileSync(path.join(root, rel), "utf8")
      assert.equal(banned.test(text), false, rel)
    }
  })
})
