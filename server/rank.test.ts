import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { RANK_MATCH_THRESHOLD, rankOfBusiness } from "./rank.ts"

function listing(title: string, city = "Austin", state = "TX") {
  return {
    title,
    address: `100 Main St, ${city}, ${state}`,
    city,
    state,
  }
}

describe("rankOfBusiness", () => {
  it("returns a 1-based Maps position for the best matching listing", () => {
    const listings = [
      listing("Salt Lick BBQ"),
      listing("La Barbecue"),
      listing("Franklin Barbecue"),
      listing("Terry Black's Barbecue"),
    ]
    const hit = rankOfBusiness(listings, "Franklin Barbecue", "Austin", "TX")
    assert.equal(hit.rank, 3)
    assert.equal(hit.listing?.title, "Franklin Barbecue")
    assert.ok(hit.matchScore >= RANK_MATCH_THRESHOLD)
  })

  it("returns null when the business is not in the Maps results", () => {
    const listings = [listing("Salt Lick"), listing("Micklethwait Craft Meats")]
    const hit = rankOfBusiness(listings, "Franklin Barbecue", "Austin", "TX")
    assert.equal(hit.rank, null)
    assert.equal(hit.listing, null)
  })

  it("keeps the earlier Maps position when two listings score the same", () => {
    const listings = [listing("Joe's Pizza"), listing("Joe's Pizza")]
    const hit = rankOfBusiness(listings, "Joe's Pizza", "New York", "NY")
    assert.equal(hit.rank, 1)
  })

  it("prefers a stronger name match over an earlier weak listing", () => {
    const listings = [listing("Blue"), listing("Blue Bottle Coffee")]
    const hit = rankOfBusiness(listings, "Blue Bottle Coffee", "Austin", "TX")
    assert.equal(hit.rank, 2)
    assert.equal(hit.listing?.title, "Blue Bottle Coffee")
  })

  it("ignores a weak token overlap below the match threshold", () => {
    const listings = [listing("House of Pizza")]
    const hit = rankOfBusiness(listings, "Franklin Barbecue", "Austin", "TX")
    assert.equal(hit.rank, null)
    assert.ok(hit.matchScore < RANK_MATCH_THRESHOLD)
  })
})
