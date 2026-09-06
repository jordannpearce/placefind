import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { RANK_MATCH_THRESHOLD, rankFromMapsItems, rankOfBusiness, type MapsSerpItem } from "./rank.ts"

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

const mapsFixture: MapsSerpItem[] = [
  {
    type: "maps_paid_item",
    rank_group: 1,
    rank_absolute: 1,
    title: "Sponsored Car Rental",
    place_id: "paid-1",
    address: "1 Ad Ave, New York, NY",
    domain: "ads.example.com",
    rating: { value: 4.1, votes_count: 12 },
  },
  {
    type: "maps_search",
    rank_group: 1,
    rank_absolute: 2,
    title: "Enterprise Rent-A-Car",
    place_id: "ChIJ-enterprise",
    address: "100 Water St, New York, NY",
    domain: "enterprise.com",
    rating: { value: 4.3, votes_count: 210 },
  },
  {
    type: "maps_search",
    rank_group: 2,
    rank_absolute: 3,
    title: "Hertz",
    place_id: "ChIJ-hertz",
    address: "200 Water St, New York, NY",
    domain: "hertz.com",
    rating: { value: 4.0, votes_count: 88 },
  },
  {
    type: "maps_search",
    rank_group: 3,
    rank_absolute: 4,
    title: "Statue of Liberty Car Rental",
    place_id: "ChIJd8BlQ2BZwokRAFUEcm_qrcA",
    address: "Liberty Island, New York, NY",
    domain: "libertycars.example",
    rating: { value: 4.8, votes_count: 1543 },
  },
]

describe("rankFromMapsItems", () => {
  it("returns the 1-based organic position when place_id matches", () => {
    const hit = rankFromMapsItems(mapsFixture, {
      name: "Statue of Liberty Car Rental",
      placeId: "ChIJd8BlQ2BZwokRAFUEcm_qrcA",
      city: "New York",
      state: "NY",
    })
    assert.equal(hit.rank, 3)
    assert.equal(hit.listing?.place_id, "ChIJd8BlQ2BZwokRAFUEcm_qrcA")
    assert.equal(hit.listing?.domain, "libertycars.example")
    assert.equal(hit.listing?.rating?.votes_count, 1543)
  })

  it("matches by business name when place_id is absent", () => {
    const hit = rankFromMapsItems(mapsFixture, { name: "Hertz", city: "New York", state: "NY" })
    assert.equal(hit.rank, 2)
    assert.equal(hit.listing?.title, "Hertz")
  })

  it("does not count paid listings as organic rank", () => {
    const hit = rankFromMapsItems(mapsFixture, { name: "Sponsored Car Rental", placeId: "paid-1" })
    assert.equal(hit.rank, null)
    assert.equal(hit.listing, null)
  })

  it("matches by CID then exact title when place_id is absent", () => {
    const byCid = rankFromMapsItems(
      [
        { type: "maps_search", rank_group: 1, title: "Other BBQ", place_id: "x", cid: "999" },
        { type: "maps_search", rank_group: 4, title: "Franklin Barbecue", place_id: "y", cid: "555" },
      ],
      { name: "Franklin Barbecue", cid: "555" },
    )
    assert.equal(byCid.rank, 4)
    const byTitle = rankFromMapsItems(
      [{ type: "maps_search", rank_group: 2, title: "Franklin Barbecue", place_id: "other" }],
      { name: "Franklin Barbecue", placeId: "ChIJ-missing" },
    )
    assert.equal(byTitle.rank, 2)
  })

  it("returns not found when the business is missing from that coordinate's items", () => {
    const hit = rankFromMapsItems(mapsFixture, {
      name: "Avis",
      placeId: "ChIJ-missing",
      city: "New York",
      state: "NY",
    })
    assert.equal(hit.rank, null)
    assert.equal(hit.listing, null)
  })
})
