import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { leaksVendorTalk } from "./public-copy.ts"
import { searchBusiness } from "./search.ts"

describe("searchBusiness public copy", () => {
  it("does not name vendors or API keys in the listing response", async () => {
    const result = await searchBusiness(
      { name: "Franklin Barbecue", city: "Austin", state: "TX" },
      { scrappeyKey: "", dataforseoLogin: "", dataforseoPassword: "", enrichWithScrappey: false },
    )
    if (result.best) {
      assert.ok(result.best.title.length > 0)
    }
    assert.equal(leaksVendorTalk(result.warning || ""), false)
    assert.equal(leaksVendorTalk(result.error || ""), false)
  })
})
