import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  accountKindOf,
  canPublishListing,
  canUseOwnerTools,
  joinHref,
  joinIntentFromSearch,
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
    assert.match(MEMBER_LISTING_MESSAGE, /\$150 per month/)
    assert.match(MEMBER_LISTING_MESSAGE, /reviews and quotes/)
  })

  it("reads free-neighbor join intent and blocks unsafe next paths", () => {
    assert.equal(joinIntentFromSearch(""), "business")
    assert.equal(joinIntentFromSearch("?for=review"), "member")
    assert.equal(joinIntentFromSearch("for=quote&next=/listings/oak-bakery"), "member")
    assert.equal(safeAuthNext("/listings/oak-bakery"), "/listings/oak-bakery")
    assert.equal(safeAuthNext("https://evil.example/listings/oak"), null)
    assert.equal(safeAuthNext("//evil.example"), null)
    assert.equal(safeAuthNext("/track"), null)
    assert.equal(joinHref("member", "/listings/oak-bakery"), "/join?for=review&next=%2Flistings%2Foak-bakery")
    assert.equal(loginHref("/listings/oak-bakery"), "/login?next=%2Flistings%2Foak-bakery")
    assert.equal(joinHref("business"), "/join")
  })
})
