import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { leaksVendorTalk } from "./public-copy.ts"
import { exampleHasLimitCopy, exampleSearchResponse, runWebsiteSearch } from "./search-limit.ts"
import { searchBusiness } from "./search.ts"
import { reloadStoreFromDisk, resetStoreForTests } from "./store.ts"

const emptyKeys = {
  scrappeyKey: "",
  dataforseoLogin: "",
  dataforseoPassword: "",
  enrichWithScrappey: false,
}

describe("runWebsiteSearch", () => {
  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("returns the sample listing on a visitor's second search without limit copy", async () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-search-ip-")))
    const ip = "203.0.113.18"
    const first = await runWebsiteSearch({
      query: { name: "Joe's Pizza", city: "New York", state: "NY", keyword: "pizza" },
      search: (query) => searchBusiness(query, emptyKeys),
      signedIn: false,
      ip,
    })
    assert.equal(first.best?.title, "Joe's Pizza")
    const second = await runWebsiteSearch({
      query: { name: "Some Other Place", city: "Dallas", state: "TX", keyword: "tacos" },
      search: (query) => searchBusiness(query, emptyKeys),
      signedIn: false,
      ip,
    })
    assert.equal(second.best?.title, "Franklin Barbecue")
    assert.equal(second.mode, "sample")
    const text = `${second.warning || ""} ${second.error || ""}`
    assert.equal(exampleHasLimitCopy(text), false)
    assert.equal(leaksVendorTalk(text), false)
    assert.match(text, /example/i)
    assert.equal(/ip|fingerprint|limit|logged/i.test(text), false)
  })

  it("does not cap signed-in searches", async () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-search-user-")))
    const ip = "203.0.113.18"
    await runWebsiteSearch({
      query: { name: "Joe's Pizza", city: "New York", state: "NY", keyword: "pizza" },
      search: (query) => searchBusiness(query, emptyKeys),
      signedIn: true,
      ip,
    })
    const second = await runWebsiteSearch({
      query: { name: "Pike Place Fish", city: "Seattle", state: "WA", keyword: "fish" },
      search: (query) => searchBusiness(query, emptyKeys),
      signedIn: true,
      ip,
    })
    assert.equal(second.best?.title, "Pike Place Fish Market")
  })
})

describe("exampleSearchResponse", () => {
  it("looks like a normal listing, not a limit error", () => {
    const result = exampleSearchResponse({ name: "Anything", city: "Dallas", state: "TX", keyword: "tacos" })
    assert.ok(result.best)
    assert.equal(result.best?.title, "Franklin Barbecue")
    assert.equal(exampleHasLimitCopy(result.warning || ""), false)
  })
})
