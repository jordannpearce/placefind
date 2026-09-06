import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { createListing } from "./listings.ts"
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

  it("extracts facts and writes listing copy from crawled pages", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-crawl-")))
    const listing = createListing(
      { name: "Harbor & Oak Bakery", city: "Portland", state: "ME", category: "Bakery", website: "https://harbor.example" },
      "user-1",
    )
    const result = runCrawlFromPages(listing, [
      "# Harbor & Oak\nEstablished in 2014. License #BAK-4418.\nWe specialize in naturally leavened bread.",
    ], true)
    assert.equal(result.sitemapFound, true)
    assert.equal(result.pagesCrawled, 1)
    assert.equal(result.facts.licenseInfo, "License BAK-4418")
    assert.match(result.article, /Harbor & Oak/)
    assert.match(result.article, /Portland/)
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
