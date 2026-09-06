import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mapsKeywordFromQuery, readSearchQuery } from "./search-query.ts"

describe("readSearchQuery", () => {
  it("forwards an optional keyword on a valid search", () => {
    const parsed = readSearchQuery({
      name: "Franklin Barbecue",
      city: "Austin",
      state: "TX",
      keyword: "  barbecue ",
    })
    assert.equal(parsed.error, undefined)
    assert.equal(parsed.query.keyword, "barbecue")
    assert.equal(parsed.query.name, "Franklin Barbecue")
  })

  it("accepts a keyword without a business name", () => {
    const parsed = readSearchQuery({ name: "", city: "Austin", state: "TX", keyword: "barbecue" })
    assert.equal(parsed.error, undefined)
    assert.equal(parsed.query.keyword, "barbecue")
    assert.equal(parsed.query.name, "")
  })

  it("omits a blank keyword", () => {
    const parsed = readSearchQuery({ name: "Joe's Pizza", city: "New York", state: "NY", keyword: "   " })
    assert.equal(parsed.error, undefined)
    assert.equal(parsed.query.keyword, undefined)
  })

  it("forwards a keyword-only search when the business name is blank", () => {
    const parsed = readSearchQuery({ name: "", city: "Austin", state: "TX", keyword: "barbecue" })
    assert.equal(parsed.error, undefined)
    assert.equal(parsed.query.keyword, "barbecue")
  })
})

describe("mapsKeywordFromQuery", () => {
  it("builds a Maps query from name plus keyword in that city", () => {
    assert.equal(
      mapsKeywordFromQuery({ name: "Franklin Barbecue", city: "Austin", state: "TX", keyword: "barbecue" }),
      "Franklin Barbecue barbecue Austin Texas",
    )
  })

  it("uses name and city when no keyword is sent", () => {
    assert.equal(
      mapsKeywordFromQuery({ name: "Joe's Pizza", city: "New York", state: "NY" }),
      "Joe's Pizza New York New York",
    )
  })
})
