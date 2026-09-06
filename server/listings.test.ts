import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { parseStreetAddress } from "../src/lib/address.ts"
import {
  confirmListingMatch,
  createListing,
  deleteListing,
  getListing,
  listPublicListings,
  listingsForUser,
  seedDirectoryListings,
  updateListing,
  verifyListingOnMaps,
} from "./listings.ts"
import { searchBusiness } from "./search.ts"
import { reloadStoreFromDisk, resetStoreForTests } from "./store.ts"

const emptyKeys = {
  scrappeyKey: "",
  dataforseoLogin: "",
  dataforseoPassword: "",
  enrichWithScrappey: false,
}

describe("directory listings", () => {
  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("seeds local businesses and filters by city, state, and keyword", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-listings-")))
    const seeded = seedDirectoryListings()
    assert.ok(seeded.length >= 6)
    assert.ok(seeded.some((row) => row.name === "Harbor & Oak Bakery"))
    assert.equal(listPublicListings({ city: "Tampa", state: "FL" })[0]?.name, "Citrus & Salt Seafood")
    assert.equal(listPublicListings({ keyword: "bookstore" })[0]?.name, "Copper Bell Books")
    assert.equal(listPublicListings({ name: "bike" })[0]?.name, "Northside Bike Works")
  })

  it("lets a signed-in owner create, edit, confirm, and delete a listing", async () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-listing-crud-")))
    const created = createListing(
      {
        name: "Joe's Pizza",
        city: "New York",
        state: "NY",
        category: "Pizza restaurant",
        keywords: "pizza, slices",
        phone: "(212) 555-0100",
        website: "https://joespizza.example",
        hours: "Daily 11:00 AM–11:00 PM",
      },
      "user-1",
    )
    assert.equal(created.mapsStatus, "pending")
    assert.equal(created.ownerUserId, "user-1")
    assert.deepEqual(listingsForUser("user-1").map((row) => row.id), [created.id])

    const renamed = updateListing(created.id, { name: "Joe's Pizza", city: "New York", state: "NY", category: "Pizza" }, "user-1")
    assert.equal(renamed.category, "Pizza")

    const verified = await verifyListingOnMaps(created.id, "user-1", false, (query) => searchBusiness(query, emptyKeys))
    assert.ok(verified.candidates.length > 0)
    assert.equal(verified.candidates[0]?.title, "Joe's Pizza")

    const candidate = verified.candidates[0]
    const confirmed = confirmListingMatch(created.id, "user-1", false, {
      placeId: candidate?.placeId ?? "sample-joes",
      cid: candidate?.cid ?? "",
      title: candidate?.title,
      address: candidate?.address,
      phone: candidate?.phone ?? undefined,
      website: candidate?.website ?? undefined,
      hours: candidate?.hours ?? undefined,
      category: candidate?.category ?? undefined,
    })
    const parsed = parseStreetAddress(candidate?.address ?? "", { city: "New York", state: "NY" })
    assert.equal(confirmed.mapsStatus, "found")
    assert.ok(confirmed.placeId)
    assert.equal(confirmed.street, parsed.street)
    assert.equal(confirmed.city, parsed.city || "New York")
    assert.equal(confirmed.state, parsed.state || "NY")
    assert.equal(confirmed.zip, parsed.zip)
    if (candidate?.phone) assert.equal(confirmed.phone, candidate.phone)
    assert.ok(confirmed.mapsAddress)

    const missing = await verifyListingOnMaps(
      createListing({ name: "No Such Shoppe", city: "Austin", state: "TX" }, "user-1").id,
      "user-1",
      false,
      async () => ({
        query: { name: "No Such Shoppe", city: "Austin", state: "TX" },
        best: null,
        others: [],
        mode: "live",
        sources: { dataforseo: false, scrappey: false },
        elapsedMs: 1,
      }),
    )
    assert.equal(missing.listing.mapsStatus, "not_found")

    deleteListing(created.id, "user-1")
    assert.throws(() => getListing(created.id), /not in the directory/)
  })

  it("parses a pasted Maps address into street, city, state, and zip", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-listing-address-")))
    const created = createListing(
      {
        name: "Franklin Barbecue",
        street: "900 E 11th St, Austin, TX 78702",
        city: "",
        state: "",
      },
      "user-1",
    )
    assert.equal(created.street, "900 E 11th St")
    assert.equal(created.city, "Austin")
    assert.equal(created.state, "TX")
    assert.equal(created.zip, "78702")
  })

  it("blocks another customer from editing a listing", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-listing-auth-")))
    const created = createListing({ name: "Harbor Street Cafe", city: "Portland", state: "OR" }, "owner")
    assert.throws(() => updateListing(created.id, { name: "Stolen Cafe", city: "Portland", state: "OR" }, "other"), /only change/)
    const adminEdit = updateListing(created.id, { name: "Harbor Street Cafe", city: "Portland", state: "OR", category: "Cafe" }, "admin", true)
    assert.equal(adminEdit.category, "Cafe")
  })
})
