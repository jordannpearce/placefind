import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { BUSINESS_ONE_TRACK_MESSAGE, BUSINESS_OTHER_LISTING_MESSAGE } from "../src/lib/business-track.ts"
import { approveUser, signup } from "./auth.ts"
import {
  assertBusinessCampaignCreate,
  assertBusinessTraffic,
  withOwnedListingCampaignInput,
} from "./business-track.ts"
import { CampaignError, createCampaign } from "./campaigns.ts"
import { createListing } from "./listings.ts"
import { reloadStoreFromDisk, resetStoreForTests } from "./store.ts"

describe("business campaign API limits", () => {
  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("rejects a second business scan target for an approved owner", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-one-track-")))
    signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const owner = signup({ name: "Riley Shop", email: "riley-shop@example.com", password: "password12" })
    approveUser(owner.user!.id)
    const listing = createListing({ name: "Harbor Street Cafe", city: "Portland", state: "OR" }, owner.user!.id)
    const user = { id: owner.user!.id, role: "customer" as const, accountKind: "business" as const }
    const stamped = withOwnedListingCampaignInput(user, {
      name: listing.name,
      businessName: listing.name,
      city: listing.city,
      state: listing.state,
      keywords: ["coffee"],
    })
    assert.equal(stamped.listingId, listing.id)
    assertBusinessCampaignCreate(user, stamped)
    createCampaign(stamped, user.id)

    assert.throws(
      () =>
        assertBusinessCampaignCreate(user, {
          name: "Austin BBQ",
          businessName: "Franklin Barbecue",
          city: "Austin",
          state: "TX",
          listingId: "other-shop",
          keywords: ["barbecue"],
        }),
      (error: unknown) => {
        assert.ok(error instanceof CampaignError)
        assert.equal(error.status, 403)
        assert.equal(error.message === BUSINESS_ONE_TRACK_MESSAGE || error.message === BUSINESS_OTHER_LISTING_MESSAGE, true)
        return true
      },
    )

    const other = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        listingId: "other-shop",
        keywords: ["barbecue"],
      },
      user.id,
    )
    assert.throws(
      () => assertBusinessTraffic(user, other),
      (error: unknown) => {
        assert.ok(error instanceof CampaignError)
        assert.equal(error.status, 403)
        return true
      },
    )
  })
})
