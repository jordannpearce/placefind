import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BUSINESS_NEED_LISTING_MESSAGE,
  BUSINESS_ONE_TRACK_MESSAGE,
  BUSINESS_ONE_TRAFFIC_MESSAGE,
  BUSINESS_OTHER_LISTING_MESSAGE,
  businessCampaignCreateDenied,
  businessCampaignUpdateDenied,
  businessTrafficDenied,
  campaignMatchesOwnedListing,
  inputMatchesOwnedListing,
  isCappedBusinessAccount,
  mapsPlaceAllowedForOwnedListing,
  showBusinessNewCampaign,
  showSearchOtherBusiness,
  stampOwnedListingOnCampaign,
} from "./business-track.ts"
import type { AuthUser, DirectoryListing } from "./types.ts"

const business: AuthUser = {
  id: "b1",
  name: "Pat",
  email: "pat@example.com",
  role: "customer",
  accountKind: "business",
  status: "active",
  createdAt: "2026-09-06T00:00:00.000Z",
}

const admin: AuthUser = { ...business, id: "a1", role: "admin", email: "ada@example.com" }
const neighbor: AuthUser = { ...business, id: "m1", accountKind: "member", email: "maya@example.com" }

const harbor: Pick<DirectoryListing, "id" | "name" | "city" | "state" | "placeId"> = {
  id: "listing-harbor",
  name: "Harbor Street Cafe",
  city: "Portland",
  state: "OR",
  placeId: "place-harbor",
}

const franklin = {
  id: "listing-franklin",
  name: "Franklin Barbecue",
  city: "Austin",
  state: "TX",
  placeId: "place-franklin",
}

describe("business track limits", () => {
  it("caps approved business accounts and leaves admin tools open", () => {
    assert.equal(isCappedBusinessAccount(business), true)
    assert.equal(isCappedBusinessAccount(admin), false)
    assert.equal(isCappedBusinessAccount(neighbor), false)
    assert.equal(showBusinessNewCampaign(business), false)
    assert.equal(showSearchOtherBusiness(business), false)
    assert.equal(showBusinessNewCampaign(admin), true)
    assert.equal(showSearchOtherBusiness(admin), true)
  })

  it("blocks a second business campaign and a scan of another shop", () => {
    assert.deepEqual(
      businessCampaignCreateDenied({
        user: business,
        ownedListing: harbor,
        existingCampaignCount: 0,
        body: { businessName: harbor.name, city: harbor.city, state: harbor.state, listingId: harbor.id },
      }),
      null,
    )
    assert.deepEqual(
      businessCampaignCreateDenied({
        user: business,
        ownedListing: harbor,
        existingCampaignCount: 1,
        body: { businessName: franklin.name, city: franklin.city, state: franklin.state },
      }),
      { status: 403, error: BUSINESS_ONE_TRACK_MESSAGE },
    )
    assert.deepEqual(
      businessCampaignCreateDenied({
        user: business,
        ownedListing: harbor,
        existingCampaignCount: 0,
        body: { businessName: franklin.name, city: franklin.city, state: franklin.state, listingId: franklin.id },
      }),
      { status: 403, error: BUSINESS_OTHER_LISTING_MESSAGE },
    )
    assert.deepEqual(
      businessCampaignCreateDenied({
        user: business,
        ownedListing: null,
        existingCampaignCount: 0,
      }),
      { status: 400, error: BUSINESS_NEED_LISTING_MESSAGE },
    )
    assert.equal(
      businessCampaignCreateDenied({
        user: admin,
        ownedListing: harbor,
        existingCampaignCount: 3,
        body: { businessName: franklin.name, city: franklin.city, state: franklin.state },
      }),
      null,
    )
  })

  it("blocks Track and Traffic updates that leave the owned listing", () => {
    const ownCampaign = {
      listingId: harbor.id,
      businessName: harbor.name,
      city: harbor.city,
      state: harbor.state,
      placeId: harbor.placeId,
      name: harbor.name,
    }
    assert.equal(
      businessCampaignUpdateDenied({
        user: business,
        ownedListing: harbor,
        campaign: ownCampaign,
        body: { keywords: ["coffee"] },
      }),
      null,
    )
    assert.deepEqual(
      businessCampaignUpdateDenied({
        user: business,
        ownedListing: harbor,
        campaign: ownCampaign,
        body: { businessName: franklin.name, city: franklin.city, state: franklin.state, listingId: franklin.id },
      }),
      { status: 403, error: BUSINESS_OTHER_LISTING_MESSAGE },
    )
    assert.deepEqual(
      businessTrafficDenied({
        user: business,
        ownedListing: harbor,
        campaign: {
          listingId: franklin.id,
          businessName: franklin.name,
          city: franklin.city,
          state: franklin.state,
          placeId: franklin.placeId,
          name: franklin.name,
        },
      }),
      { status: 403, error: BUSINESS_ONE_TRAFFIC_MESSAGE },
    )
    assert.equal(
      businessTrafficDenied({
        user: business,
        ownedListing: harbor,
        campaign: ownCampaign,
      }),
      null,
    )
    assert.equal(campaignMatchesOwnedListing(ownCampaign, harbor), true)
    assert.equal(inputMatchesOwnedListing({ businessName: "Harbor Street", city: "Portland", state: "Oregon" }, harbor), true)
    assert.equal(mapsPlaceAllowedForOwnedListing(harbor, { title: "Some Other Cafe", placeId: "place-other" }), false)
    const stamped = stampOwnedListingOnCampaign({ name: "", businessName: "", city: "", state: "" }, harbor)
    assert.equal(stamped.listingId, harbor.id)
    assert.equal(stamped.businessName, harbor.name)
  })
})
