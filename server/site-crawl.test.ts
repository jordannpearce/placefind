import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { applyListingProfile, createListing, getListing } from "./listings.ts"
import {
  crawlWebsitePages,
  MAX_PAGES,
  pickCrawlUrls,
  runCrawlFromPages,
} from "./site-crawl.ts"
import { reloadStoreFromDisk, resetStoreForTests } from "./store.ts"

describe("website crawl writing", () => {
  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("extracts facts for the crawl job and writes a profile article without changing listing fields", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-crawl-")))
    const listing = createListing(
      {
        name: "Harbor & Oak Bakery",
        street: "18 Exchange St",
        city: "Portland",
        state: "ME",
        zip: "04101",
        category: "Bakery",
        keywords: "pastry, coffee, sourdough",
        phone: "(207) 555-0142",
        website: "https://harbor.example",
        hours: "Tue–Sun 7:00 AM–3:00 PM",
      },
      "user-1",
    )
    const before = getListing(listing.id)
    const result = runCrawlFromPages(listing, [
      "# Harbor & Oak\nEstablished in 2014. License #BAK-4418.\nWe specialize in naturally leavened bread.",
    ], true)
    assert.equal(result.sitemapFound, true)
    assert.equal(result.pagesCrawled, 1)
    assert.equal(result.facts.licenseInfo, "License BAK-4418")
    assert.equal(result.facts.yearsInBusiness, "Since 2014")
    assert.match(result.facts.specialty, /naturally leavened bread/)
    assert.match(result.article, /Harbor & Oak Bakery/)
    assert.match(result.article, /pastry/)
    assert.match(result.article, /coffee/)
    assert.match(result.article, /sourdough/)
    assert.match(result.article, /Portland/)
    assert.match(result.article, /BAK-4418/)
    assert.equal(/lorem ipsum/i.test(result.article), false)

    const applied = applyListingProfile(listing.id, {
      profileContent: result.article,
      crawlStatus: "ok",
      lastCrawledAt: "2026-09-06T14:00:00.000Z",
    })
    assert.equal(applied.profileContent, result.article)
    assert.equal(applied.crawlStatus, "ok")
    assert.equal(applied.name, before.name)
    assert.equal(applied.street, before.street)
    assert.equal(applied.city, before.city)
    assert.equal(applied.state, before.state)
    assert.equal(applied.zip, before.zip)
    assert.equal(applied.phone, before.phone)
    assert.equal(applied.website, before.website)
    assert.equal(applied.hours, before.hours)
    assert.equal(applied.category, before.category)
    assert.deepEqual(applied.keywords, before.keywords)
    assert.equal(applied.placeId, before.placeId)
    assert.equal(applied.cid, before.cid)
    assert.equal(applied.brand, before.brand)
    assert.equal(applied.licenseInfo, before.licenseInfo)
    assert.equal(applied.yearsInBusiness, before.yearsInBusiness)
    assert.equal(applied.specialty, before.specialty)
    assert.equal(applied.brand, "")
    assert.equal(applied.licenseInfo, "")
  })

  it("prefers sitemap urls, then discovered same-origin links, and caps unique pages", () => {
    const urls = pickCrawlUrls(
      "https://shop.example/",
      ["https://shop.example/about", "https://shop.example/menu", "https://other.example/nope"],
      ["https://shop.example/contact", "https://shop.example/about", "https://shop.example/logo.png"],
      3,
    )
    assert.deepEqual(urls, ["https://shop.example/", "https://shop.example/about", "https://shop.example/menu"])
    const many = pickCrawlUrls(
      "https://shop.example/",
      Array.from({ length: 200 }, (_, index) => `https://shop.example/p/${index}`),
      [],
      MAX_PAGES,
    )
    assert.equal(many.length, MAX_PAGES)
  })

  it("crawls nested sitemap urls and then same-origin links with per-page results", async () => {
    const bodies = new Map<string, string>([
      [
        "https://shop.example/sitemap_index.xml",
        `<sitemapindex><sitemap><loc>https://shop.example/sitemap-pages.xml</loc></sitemap></sitemapindex>`,
      ],
      [
        "https://shop.example/sitemap-pages.xml",
        `<urlset><url><loc>https://shop.example/about</loc></url><url><loc>https://shop.example/menu</loc></url></urlset>`,
      ],
      ["https://shop.example/", "# Harbor & Oak\n<a href=\"https://shop.example/contact\">Contact</a>"],
      ["https://shop.example/about", "# About\nEstablished in 2014."],
      ["https://shop.example/menu", "# Menu\nWe specialize in naturally leavened bread."],
      ["https://shop.example/contact", "# Contact\nLicense #BAK-4418."],
    ])
    const result = await crawlWebsitePages("https://shop.example/", async (url) => {
      const text = bodies.get(url) ?? bodies.get(url.replace(/\/$/, "")) ?? ""
      return { text, error: text ? null : "missing" }
    })
    assert.equal(result.sitemapFound, true)
    const urls = result.pages.map((page) => page.url)
    assert.ok(urls.some((url) => url.includes("/about")))
    assert.ok(urls.some((url) => url.includes("/menu")))
    assert.ok(urls.some((url) => url.includes("/contact")))
    assert.ok(result.pages.every((page) => !page.url.includes("other.example")))
    const contact = result.pages.find((page) => page.url.includes("/contact"))
    assert.equal(contact?.status, "ok")
    assert.equal(contact?.title, "Contact")
    assert.match(contact?.licenseInfo ?? "", /BAK-4418/)
    const about = result.pages.find((page) => page.url.includes("/about"))
    assert.equal(about?.yearsInBusiness, "Since 2014")
  })
})
