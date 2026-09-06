import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { createListing } from "./listings.ts"
import { runCrawlFromPages } from "./site-crawl.ts"
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
})
