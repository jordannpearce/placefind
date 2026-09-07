import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { ACCOUNT_HAS_LISTING_MESSAGE } from "../src/lib/account.ts"
import { parseStreetAddress } from "../src/lib/address.ts"
import { approveUser, signup } from "./auth.ts"
import {
  applyListingProfile,
  confirmListingMatch,
  createListing,
  deleteListing,
  getListing,
  ListingError,
  listingIsApprovedForDirectory,
  listingLimitDenied,
  listPublicListings,
  listingsForUser,
  publicListing,
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

  it("does not seed the public directory from an empty store", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-listings-empty-")))
    assert.deepEqual(listPublicListings(), [])
    assert.equal(listPublicListings({ city: "Portland" }).length, 0)
  })

  it("refuses to write seed listings into the live .data store", () => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
    const before = listPublicListings().map((row) => row.id).sort()
    const after = seedDirectoryListings(true).map((row) => row.id).sort()
    assert.deepEqual(after, before)
  })

  it("seeds local businesses and filters by city, state, and keyword", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-listings-")))
    const seeded = seedDirectoryListings()
    assert.ok(seeded.length >= 6)
    assert.ok(seeded.some((row) => row.name === "Harbor & Oak Bakery"))
    const harbor = seeded.find((row) => row.name === "Harbor & Oak Bakery")
    assert.equal(harbor?.email, "hello@harborandoak.example")
    assert.equal(seeded.find((row) => row.name === "Copper Bell Books")?.email, "")
    assert.equal(harbor?.slug, "harbor-oak-bakery")
    assert.equal(getListing("harbor-oak-bakery").id, harbor?.id)
    assert.equal(getListing("seed-1").slug, "harbor-oak-bakery")
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
    assert.equal(created.email, "")
    assert.deepEqual(listingsForUser("user-1").map((row) => row.id), [created.id])

    const renamed = updateListing(created.id, { name: "Joe's Pizza", city: "New York", state: "NY", category: "Pizza", email: "hello@joespizza.example" }, "user-1")
    assert.equal(renamed.category, "Pizza")
    assert.equal(renamed.email, "hello@joespizza.example")
    const visible = publicListing(renamed, true)
    const hidden = publicListing(renamed, false)
    assert.equal(visible.email, "hello@joespizza.example")
    assert.equal(visible.hasQuoteEmail, true)
    assert.equal("email" in hidden, false)
    assert.equal(hidden.hasQuoteEmail, true)

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
      categories: candidate?.categories,
      lat: candidate?.lat,
      lng: candidate?.lng,
    })
    const parsed = parseStreetAddress(candidate?.address ?? "", { city: "New York", state: "NY" })
    assert.equal(confirmed.mapsStatus, "found")
    assert.ok(confirmed.placeId)
    if (candidate?.lat != null) assert.equal(confirmed.lat, candidate.lat)
    if (candidate?.lng != null) assert.equal(confirmed.lng, candidate.lng)
    assert.equal(confirmed.street, parsed.street)
    assert.equal(confirmed.city, parsed.city || "New York")
    assert.equal(confirmed.state, parsed.state || "NY")
    assert.equal(confirmed.zip, parsed.zip)
    if (candidate?.phone) assert.equal(confirmed.phone, candidate.phone)
    assert.ok(confirmed.mapsAddress)

    const missing = await verifyListingOnMaps(
      createListing({ name: "No Such Shoppe", city: "Austin", state: "TX" }, "user-2").id,
      "user-2",
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

    assert.match(confirmed.slug, /pizza/)

    const bakery = createListing({ name: "Maple Oven", city: "Portland", state: "ME" }, "user-3")
    const fromCategories = confirmListingMatch(bakery.id, "user-3", false, {
      placeId: "sample-maple-oven",
      title: "Maple Oven",
      address: "10 Congress St, Portland, ME 04101",
      categories: ["Bakery", "Cafe"],
      lat: 43.6575,
      lng: -70.258,
    })
    assert.equal(fromCategories.category, "Bakery")
    assert.equal(fromCategories.slug, "maple-oven-bakery")
    assert.equal(fromCategories.lat, 43.6575)
    assert.equal(fromCategories.lng, -70.258)
    assert.equal(publicListing(fromCategories).lat, 43.6575)
    assert.equal(publicListing(fromCategories).lng, -70.258)
    assert.equal(getListing("maple-oven-bakery").id, bakery.id)
    assert.equal(getListing(bakery.id).lat, 43.6575)

    deleteListing(created.id, "user-1")
    assert.throws(() => getListing(created.id), /not in the directory/)
    deleteListing(bakery.id, "admin", true)
    assert.throws(() => getListing(bakery.id), /not in the directory/)
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

  it("saves a custom profile and does not let a crawl overwrite it", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-listing-profile-")))
    const created = createListing(
      {
        name: "Harbor Street Cafe",
        city: "Portland",
        state: "OR",
        profileH1: "Coffee by the harbor",
        profileH2: "Coffee on the waterfront",
        profileH3: "Weekend hours",
        profilePageTitle: "Harbor Street Cafe · Portland",
        profileMetaDescription: "Coffee and breakfast on Harbor Street.",
        profileHeadHtml: '<meta name="robots" content="index,follow"><script>alert(1)</script>',
        profileSchema: '{"@type":"CafeOrCoffeeShop","name":"Harbor Street Cafe"}',
        profileHtml: "<h3>Weekend hours</h3><script>alert(1)</script><p>Saturday 8 to 2.</p>",
        profileContent:
          "We roast on Harbor Street.\n\nThis article was written from the listing the owner published and facts found on the business website. Reviews from visitors appear below.",
      },
      "user-1",
    )
    assert.equal(created.profileCustomized, true)
    assert.equal(created.name, "Harbor Street Cafe")
    assert.equal(created.profileH1, "Coffee by the harbor")
    assert.equal(created.profileH2, "Coffee on the waterfront")
    assert.equal(created.profileH3, "Weekend hours")
    assert.equal(created.profilePageTitle, "Harbor Street Cafe · Portland")
    assert.equal(created.profileContent, "We roast on Harbor Street.")
    assert.doesNotMatch(created.profileHeadHtml, /script/i)
    assert.match(created.profileHeadHtml, /robots/)
    assert.doesNotMatch(created.profileHtml, /script/i)
    assert.match(created.profileHtml, /Weekend hours/)
    const published = publicListing(created)
    assert.equal(published.name, "Harbor Street Cafe")
    assert.equal(published.profileH1, "Coffee by the harbor")
    assert.equal(published.profilePageTitle, "Harbor Street Cafe · Portland")
    assert.equal(published.profileHtml.includes("Weekend hours"), true)
    assert.equal(published.profileCustomized, true)

    const crawled = applyListingProfile(created.id, {
      profileContent: "Crawl draft that should stay off the public profile.",
      crawlStatus: "ok",
      lastCrawledAt: "2026-09-07T14:00:00.000Z",
    })
    assert.equal(crawled.profileContent, "We roast on Harbor Street.")
    assert.equal(crawled.profileCustomized, true)
    assert.equal(crawled.crawlStatus, "ok")

    const phoneOnly = updateListing(created.id, { name: "Harbor Street Cafe", city: "Portland", state: "OR", phone: "(503) 555-0100" }, "user-1")
    assert.equal(phoneOnly.phone, "(503) 555-0100")
    assert.equal(phoneOnly.profileContent, "We roast on Harbor Street.")
    assert.equal(phoneOnly.profileCustomized, true)

    const headingOnly = updateListing(
      created.id,
      { name: "Harbor Street Cafe", city: "Portland", state: "OR", profileH1: "A different H1" },
      "user-1",
    )
    assert.equal(headingOnly.name, "Harbor Street Cafe")
    assert.equal(headingOnly.profileH1, "A different H1")

    const blank = createListing({ name: "Plain Oven", city: "Portland", state: "OR" }, "user-2")
    assert.equal(blank.profileCustomized, false)
    const drafted = applyListingProfile(blank.id, { profileContent: "Draft from the shop website.", crawlStatus: "ok" })
    assert.equal(drafted.profileContent, "Draft from the shop website.")
    assert.equal(drafted.profileCustomized, false)
  })

  it("hides listings owned by a pending account from the public directory", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-listing-pending-")))
    signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const owner = signup({ name: "Pat Owner", email: "pat-pending@example.com", password: "password12" })
    assert.equal(owner.user?.status, "pending")
    const created = createListing({ name: "Pending Oven", city: "Portland", state: "OR" }, owner.user!.id)
    assert.equal(listingIsApprovedForDirectory(created), false)
    assert.equal(listPublicListings().some((row) => row.id === created.id), false)
    assert.equal(listPublicListings({}, { includePendingOwners: true }).some((row) => row.id === created.id), true)
    approveUser(owner.user!.id)
    assert.equal(listingIsApprovedForDirectory(created), true)
    assert.equal(listPublicListings().some((row) => row.id === created.id), true)
  })

  it("lets a business create one listing and blocks a second", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-listing-one-")))
    const first = createListing({ name: "Harbor Street Cafe", city: "Portland", state: "OR" }, "owner-1")
    assert.equal(first.ownerUserId, "owner-1")
    assert.equal(listingsForUser("owner-1").length, 1)
    assert.throws(
      () => createListing({ name: "Second Oven", city: "Portland", state: "OR" }, "owner-1"),
      (error: unknown) => {
        assert.ok(error instanceof ListingError)
        assert.equal(error.status, 400)
        assert.equal(error.message, ACCOUNT_HAS_LISTING_MESSAGE)
        return true
      },
    )
    assert.equal(listingsForUser("owner-1").length, 1)
    const extra = createListing({ name: "Admin Extra Shop", city: "Portland", state: "OR" }, "admin-1", {
      allowMultiple: true,
    })
    assert.equal(extra.ownerUserId, "admin-1")
    const secondAdmin = createListing({ name: "Admin Support Shop", city: "Austin", state: "TX" }, "admin-1", {
      allowMultiple: true,
    })
    assert.equal(listingsForUser("admin-1").length, 2)
    assert.equal(secondAdmin.name, "Admin Support Shop")
    assert.equal(listingLimitDenied({ id: "owner-1", role: "customer" }), ACCOUNT_HAS_LISTING_MESSAGE)
    assert.equal(listingLimitDenied({ id: "admin-1", role: "admin" }), null)
  })

  it("blocks another customer from editing a listing", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-listing-auth-")))
    const created = createListing({ name: "Harbor Street Cafe", city: "Portland", state: "OR" }, "owner")
    assert.throws(() => updateListing(created.id, { name: "Stolen Cafe", city: "Portland", state: "OR" }, "other"), /only change/)
    const adminEdit = updateListing(created.id, { name: "Harbor Street Cafe", city: "Portland", state: "OR", category: "Cafe" }, "admin", true)
    assert.equal(adminEdit.category, "Cafe")
  })
})
