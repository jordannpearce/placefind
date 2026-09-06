import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  listingLocation,
  listingPath,
  listingRedirectPath,
  listingSlugFromParts,
  mapsCategory,
  mapsStatusDetail,
  mapsStatusLabel,
} from "./listings.ts"

describe("listing copy", () => {
  it("explains Maps verification without vendor or desktop talk", () => {
    assert.equal(mapsStatusLabel("found"), "Found on Google Maps")
    assert.equal(mapsStatusLabel("not_found"), "Not found on Google Maps")
    assert.equal(mapsStatusLabel("pending"), "Maps check pending")
    assert.match(mapsStatusDetail({ mapsStatus: "pending", mapsTitle: "", mapsAddress: "" }), /not been cross-checked/)
    assert.equal(listingLocation({ city: "Tampa", state: "FL" }), "Tampa, FL")
    assert.equal(
      listingLocation({ street: "907 N Franklin St", city: "Tampa", state: "FL", zip: "33602" }),
      "907 N Franklin St, Tampa, FL 33602",
    )
    assert.equal(
      listingLocation({ city: "Portland", state: "ME", mapsAddress: "18 Exchange St, Portland, ME 04101" }),
      "18 Exchange St, Portland, ME 04101",
    )
    const text = [mapsStatusLabel("found"), mapsStatusDetail({ mapsStatus: "found", mapsTitle: "Harbor & Oak", mapsAddress: "18 Exchange St" })].join(" ")
    assert.equal(/download|windows|desktop|license key|setup\.exe/i.test(text), false)
  })

  it("uses the Maps category or the first categories item", () => {
    assert.equal(mapsCategory({ category: "Bakery", categories: ["Restaurant"] }), "Bakery")
    assert.equal(mapsCategory({ category: "", categories: ["Bakery", "Cafe"] }), "Bakery")
    assert.equal(mapsCategory({ categories: ["  Dentist  "] }), "Dentist")
    assert.equal(mapsCategory({ category: null, categories: [] }), "")
  })

  it("builds a brand-and-category listing slug and keeps the old id path as a redirect", () => {
    assert.equal(listingSlugFromParts({ brand: "Harbor & Oak", name: "Harbor & Oak Bakery", category: "Bakery" }), "harbor-oak-bakery")
    assert.equal(listingSlugFromParts({ name: "Harbor & Oak Bakery", category: "Bakery" }), "harbor-oak-bakery")
    assert.equal(listingPath({ id: "seed-1", slug: "harbor-oak-bakery" }), "/listings/harbor-oak-bakery")
    assert.equal(listingPath("seed-1"), "/listings/seed-1")
    assert.equal(listingRedirectPath("seed-1", { id: "seed-1", slug: "harbor-oak-bakery" }), "/listings/harbor-oak-bakery")
    assert.equal(listingRedirectPath("harbor-oak-bakery", { id: "seed-1", slug: "harbor-oak-bakery" }), null)
  })
})
