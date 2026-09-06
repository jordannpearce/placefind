import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { deleteManagedAccount, purgeLeftoverSampleUsers } from "./account-purge.ts"
import { createManagedUser, readUsers, signup } from "./auth.ts"
import { createListing, getListing, listingsForUser } from "./listings.ts"
import { createReview, reviewsForListing } from "./reviews.ts"
import { consumeMonthlyUsage, readMonthlyUsage } from "./usage.ts"
import { reloadStoreFromDisk, resetStoreForTests } from "./store.ts"

describe("admin account purge", () => {
  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("deletes an account and the listings, reviews, and usage it owned", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-account-purge-")))
    const admin = signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const customer = createManagedUser({
      name: "Casey",
      email: "casey@example.com",
      password: "password12",
      role: "customer",
    })
    const listing = createListing({ name: "Harbor Street Cafe", city: "Portland", state: "OR" }, customer.user!.id)
    createReview(listing.id, { rating: 5, text: "Strong coffee and a quiet corner." }, { id: "reviewer-1", name: "Maya" })
    consumeMonthlyUsage(customer.user!.id, "rankScans")
    assert.equal(listingsForUser(customer.user!.id).length, 1)
    assert.equal(reviewsForListing(listing.id).length, 1)
    assert.equal(readMonthlyUsage(customer.user!.id).rankScans, 1)

    const deleted = deleteManagedAccount(customer.user!.id, admin.user!.id)
    assert.equal(deleted.ok, true)
    assert.equal(listingsForUser(customer.user!.id).length, 0)
    assert.throws(() => getListing(listing.id), /not in the directory/)
    assert.equal(readMonthlyUsage(customer.user!.id).rankScans, 0)
  })

  it("removes leftover reserved-domain users from a store and keeps real accounts", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-sample-purge-")))
    const keeper = signup({ name: "TM", email: "tmrapp1995@gmail.com", password: "password12" })
    const sample = createManagedUser({
      name: "Casey Owner",
      email: "casey-dir@example.com",
      password: "password12",
      role: "customer",
    })
    const listing = createListing({ name: "Harbor Street Cafe", city: "Portland", state: "OR" }, sample.user!.id)
    const removed = purgeLeftoverSampleUsers()
    assert.deepEqual(
      removed.map((user) => user.email),
      ["casey-dir@example.com"],
    )
    assert.deepEqual(
      readUsers().map((user) => user.email),
      [keeper.user!.email],
    )
    assert.throws(() => getListing(listing.id), /not in the directory/)
  })
})
