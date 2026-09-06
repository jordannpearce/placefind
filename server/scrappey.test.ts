import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseMapsMarkdown } from "./scrappey.ts"

describe("parseMapsMarkdown", () => {
  it("reads a listing block from Maps markdown", () => {
    const markdown = `
# Franklin Barbecue
4.7 (8,412)
Barbecue restaurant
900 E 11th St, Austin, TX 78702
(512) 653-1187
https://franklinbarbecue.com
Wednesday 11:00 AM–3:00 PM
Claimed
`
    const hits = parseMapsMarkdown(markdown, { name: "Franklin Barbecue", city: "Austin", state: "TX" }, "https://maps.google.com")
    assert.ok(hits.length >= 1)
    assert.equal(hits[0].title, "Franklin Barbecue")
    assert.match(hits[0].address, /11th/)
    assert.equal(hits[0].phone, "(512) 653-1187")
    assert.equal(hits[0].website, "https://franklinbarbecue.com")
    assert.equal(hits[0].rating, 4.7)
    assert.equal(hits[0].reviewCount, 8412)
  })
})
