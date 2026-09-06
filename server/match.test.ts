import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { namesMatch, scoreListing, titlesMatchExactly } from "./match.ts"

describe("namesMatch", () => {
  it("matches exact and partial business names", () => {
    assert.equal(namesMatch("Franklin Barbecue", "Franklin Barbecue"), true)
    assert.equal(namesMatch("Franklin Barbecue", "Franklin BBQ"), false)
    assert.equal(namesMatch("Joe's Pizza", "Joes Pizza"), true)
    assert.equal(namesMatch("Blue Bottle Coffee", "Blue Bottle"), true)
  })
})

describe("titlesMatchExactly", () => {
  it("matches normalized titles and rejects substring hits", () => {
    assert.equal(titlesMatchExactly("Joe's Pizza", "Joes Pizza"), true)
    assert.equal(titlesMatchExactly("Franklin Barbecue", "Franklin Barbecue"), true)
    assert.equal(titlesMatchExactly("Barbecue", "Franklin Barbecue"), false)
    assert.equal(titlesMatchExactly("Austin Barbecue", "Franklin Barbecue"), false)
  })
})

describe("scoreListing", () => {
  it("scores a city and state match higher than name-only", () => {
    const query = { name: "Joe's Pizza", city: "New York", state: "NY" }
    const local = scoreListing(
      { title: "Joe's Pizza", address: "7 Carmine St, New York, NY", city: "New York", state: "NY" },
      query,
    )
    const elsewhere = scoreListing(
      { title: "Joe's Pizza", address: "100 Main St, Chicago, IL", city: "Chicago", state: "IL" },
      query,
    )
    assert.ok(local > elsewhere)
    assert.ok(local >= 100)
  })
})
