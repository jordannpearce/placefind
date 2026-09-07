import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  accountKindOf,
  ACCOUNT_PENDING_MESSAGE,
  canLeaveReview,
  canPublishListing,
  canUseOwnerTools,
  canUseRankTracker,
  canUseTraffic,
  isApprovedAccount,
  listingCreateDenied,
  MEMBER_OWNER_TOOLS_MESSAGE,
  ownerToolDenied,
  showCreateListingCta,
  afterSignupHref,
  createProfileHref,
  isCreateProfilePath,
  joinHref,
  joinIntentFromSearch,
  listBusinessHref,
  loginHref,
  MEMBER_LISTING_MESSAGE,
  parseAccountKind,
  safeAuthNext,
} from "./account.ts"
import type { AuthUser } from "./types.ts"

const business: AuthUser = {
  id: "b1",
  name: "Pat",
  email: "pat@example.com",
  role: "customer",
  accountKind: "business",
  status: "active",
  createdAt: "2026-09-06T00:00:00.000Z",
}

const member: AuthUser = { ...business, id: "m1", accountKind: "member", email: "maya@example.com" }
const admin: AuthUser = { ...business, id: "a1", role: "admin", accountKind: "member", email: "ada@example.com" }

describe("account kinds", () => {
  it("treats missing kind and admins as business accounts", () => {
    assert.equal(parseAccountKind("member"), "member")
    assert.equal(parseAccountKind("visitor"), null)
    assert.equal(accountKindOf({ ...business, accountKind: undefined }), "business")
    assert.equal(accountKindOf(member), "member")
    assert.equal(accountKindOf(admin), "business")
    assert.equal(canPublishListing(business), true)
    assert.equal(canPublishListing(member), false)
    assert.equal(canPublishListing(admin), true)
    assert.equal(canUseOwnerTools(member), false)
    assert.equal(isApprovedAccount(business), true)
    assert.equal(canLeaveReview(business), true)
    const pending: AuthUser = { ...business, status: "pending" }
    assert.equal(isApprovedAccount(pending), false)
    assert.equal(canPublishListing(pending), false)
    assert.equal(canUseOwnerTools(pending), false)
    assert.equal(canUseRankTracker(pending), false)
    assert.equal(canUseTraffic(pending), false)
    assert.equal(canUseRankTracker(business), true)
    assert.equal(canUseTraffic(admin), true)
    assert.equal(canUseRankTracker(member), false)
    assert.equal(canLeaveReview(pending), false)
    assert.equal(listingCreateDenied(pending), ACCOUNT_PENDING_MESSAGE)
    assert.equal(listingCreateDenied(member), MEMBER_LISTING_MESSAGE)
    assert.equal(ownerToolDenied(pending), ACCOUNT_PENDING_MESSAGE)
    assert.equal(ownerToolDenied(member), MEMBER_OWNER_TOOLS_MESSAGE)
    assert.equal(ownerToolDenied(business), null)
    assert.equal(showCreateListingCta(null), true)
    assert.equal(showCreateListingCta(business), true)
    assert.equal(showCreateListingCta(member), false)
    assert.equal(showCreateListingCta(pending), false)
    assert.match(MEMBER_LISTING_MESSAGE, /\$150 per month/)
    assert.match(MEMBER_LISTING_MESSAGE, /reviews/)
    assert.match(MEMBER_LISTING_MESSAGE, /Anyone can request a quote/)
  })

  it("sends Join and Create a Profile to separate routes", () => {
    assert.equal(joinIntentFromSearch(""), "member")
    assert.equal(joinIntentFromSearch("?for=review"), "member")
    assert.equal(joinIntentFromSearch("for=quote&next=/listings/oak-bakery"), "member")
    assert.equal(joinIntentFromSearch("?for=business"), "business")
    assert.equal(joinIntentFromSearch("intent=owner"), "business")
    assert.equal(safeAuthNext("/listings/oak-bakery"), "/listings/oak-bakery")
    assert.equal(safeAuthNext("/pricing"), "/pricing")
    assert.equal(safeAuthNext("https://evil.example/listings/oak"), null)
    assert.equal(safeAuthNext("//evil.example"), null)
    assert.equal(safeAuthNext("/track"), null)
    assert.equal(joinHref("member", "/listings/oak-bakery"), "/join?next=%2Flistings%2Foak-bakery")
    assert.equal(joinHref("member"), "/join")
    assert.equal(joinHref("business"), "/create-profile")
    assert.equal(createProfileHref("/listings/new"), "/create-profile?next=%2Flistings%2Fnew")
    assert.equal(loginHref("/listings/oak-bakery"), "/login?next=%2Flistings%2Foak-bakery")
    assert.equal(afterSignupHref("member"), "/directory")
    assert.equal(afterSignupHref("business"), "/listings/new")
    assert.equal(afterSignupHref("member", "/listings/oak-bakery"), "/listings/oak-bakery")
    assert.equal(isCreateProfilePath("/create-profile"), true)
    assert.equal(isCreateProfilePath("/join/business"), true)
    assert.equal(isCreateProfilePath("/join"), false)
    assert.equal(listBusinessHref(null), "/create-profile")
    assert.equal(listBusinessHref(business), "/listings/new")
    assert.equal(listBusinessHref(member), "/account")
    assert.equal(listBusinessHref({ ...business, status: "pending" }), "/account")
  })
})
