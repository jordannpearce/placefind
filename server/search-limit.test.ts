import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { leaksVendorTalk, sampleSearchUsedMessage } from "./public-copy.ts"
import { runWebsiteSearch, VisitorSearchUsedError } from "./search-limit.ts"
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

  it("lets a visitor run one search, then returns the generic used copy", async () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-search-ip-")))
    const ip = "203.0.113.18"
    const first = await runWebsiteSearch({
      query: { name: "Joe's Pizza", city: "New York", state: "NY", keyword: "pizza" },
      search: (query) => searchBusiness(query, emptyKeys),
      signedIn: false,
      ip,
    })
    assert.equal(first.best?.title, "Joe's Pizza")
    await assert.rejects(
      () =>
        runWebsiteSearch({
          query: { name: "Some Other Place", city: "Dallas", state: "TX", keyword: "tacos" },
          search: (query) => searchBusiness(query, emptyKeys),
          signedIn: false,
          ip,
        }),
      (error: unknown) => {
        assert.ok(error instanceof VisitorSearchUsedError)
        assert.equal(error.message, sampleSearchUsedMessage())
        assert.equal(leaksVendorTalk(error.message), false)
        assert.equal(/\bip\b|rate limit|tracking|log your|fingerprint/i.test(error.message), false)
        return true
      },
    )
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
