import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  listingFormFromPlace,
  listingLocation,
  listingMapsMatchFromPlace,
  listingPath,
  listingRedirectPath,
  listingSlugFromParts,
  mapsCategory,
  mapsSearchCandidates,
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

  it("fills listing fields from a Maps place and keeps placeId for confirm", () => {
    const filled = listingFormFromPlace(
      {
        title: "Maple Oven",
        address: "10 Congress St, Portland, ME 04101",
        phone: "(207) 555-0100",
        website: "https://mapleoven.example",
        hours: "Tue–Sun 7:00 AM–3:00 PM",
        category: "",
        categories: ["Bakery", "Cafe"],
      },
      { name: "Maple Oven", city: "Portland", state: "ME", email: "hello@mapleoven.example", keywords: "sourdough" },
    )
    assert.equal(filled.street, "10 Congress St")
    assert.equal(filled.city, "Portland")
    assert.equal(filled.state, "ME")
    assert.equal(filled.zip, "04101")
    assert.equal(filled.category, "Bakery")
    assert.equal(filled.phone, "(207) 555-0100")
    assert.equal(filled.website, "https://mapleoven.example")
    assert.equal(filled.hours, "Tue–Sun 7:00 AM–3:00 PM")
    assert.equal(filled.email, "hello@mapleoven.example")
    assert.equal(filled.keywords, "sourdough")

    const noStreet = listingFormFromPlace(
      { title: "Downtown Cart", address: "Austin, TX 78702", categories: ["Food truck"] },
      { name: "Downtown Cart", city: "Austin", state: "TX" },
    )
    assert.equal(noStreet.street, "")
    assert.equal(noStreet.city, "Austin")
    assert.equal(noStreet.state, "TX")
    assert.equal(noStreet.zip, "78702")
    assert.equal(noStreet.category, "Food truck")

    const fromDetail = listingFormFromPlace({
      title: "Night Kitchen",
      address: "Austin, TX",
      hoursDetail: [
        { day: "Mon", hours: "Closed" },
        { day: "Tue", hours: "11:00 AM–8:00 PM" },
      ],
    })
    assert.equal(fromDetail.hours, "Mon Closed; Tue 11:00 AM–8:00 PM")

    const match = listingMapsMatchFromPlace({
      title: "Maple Oven",
      address: "10 Congress St, Portland, ME 04101",
      placeId: "sample-maple",
      cid: "cid-maple",
      categories: ["Bakery"],
      lat: 43.6575,
      lng: -70.258,
      mapsUrl: "",
      source: "sample",
      matchScore: 100,
      isBestMatch: true,
    })
    assert.equal(match.placeId, "sample-maple")
    assert.equal(match.cid, "cid-maple")
    assert.equal(match.category, "Bakery")
    assert.equal(match.lat, 43.6575)
    assert.equal(match.lng, -70.258)
    assert.deepEqual(
      mapsSearchCandidates({
        best: {
          title: "Best",
          address: "1 Main",
          mapsUrl: "",
          source: "sample",
          matchScore: 100,
          isBestMatch: true,
        },
        others: [
          {
            title: "Other",
            address: "2 Main",
            mapsUrl: "",
            source: "sample",
            matchScore: 40,
            isBestMatch: false,
          },
        ],
      }).map((row) => row.title),
      ["Best", "Other"],
    )
  })

  it("builds a brand-and-category listing slug and keeps the old id path as a redirect", () => {
    assert.equal(listingSlugFromParts({ brand: "Harbor & Oak", name: "Harbor & Oak Bakery", category: "Bakery" }), "harbor-oak-bakery")
    assert.equal(listingSlugFromParts({ name: "Harbor & Oak Bakery", category: "Bakery" }), "harbor-oak-bakery")
    assert.equal(listingSlugFromParts({ name: "Joe's Pizza", category: "Pizza restaurant" }), "joes-pizza-pizza-restaurant")
    assert.equal(listingPath({ id: "seed-1", slug: "harbor-oak-bakery" }), "/listings/harbor-oak-bakery")
    assert.equal(listingPath("seed-1"), "/listings/seed-1")
    assert.equal(listingRedirectPath("seed-1", { id: "seed-1", slug: "harbor-oak-bakery" }), "/listings/harbor-oak-bakery")
    assert.equal(listingRedirectPath("harbor-oak-bakery", { id: "seed-1", slug: "harbor-oak-bakery" }), null)
  })
})
