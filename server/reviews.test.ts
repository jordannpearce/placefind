import assert from "node:assert/strict"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import express from "express"
import { createSession, signup, userFromCookie } from "./auth.ts"
import { createListing, seedDirectoryListings } from "./listings.ts"
import { registerListingLeadRoutes } from "./listing-leads.ts"
import { ListingError } from "./listings.ts"
import { createReview, reviewsForListing, seedDirectoryReviews } from "./reviews.ts"
import { reloadStoreFromDisk, resetStoreForTests } from "./store.ts"

async function withLeadServer(run: (port: number) => Promise<void>) {
  const app = express()
  app.use(express.json())
  registerListingLeadRoutes(app, (req, res) => {
    const user = userFromCookie(req.headers.cookie)
    if (user) return user
    res.status(401).json({ error: "Sign in to continue." })
    return null
  })
  const server = createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const port = (server.address() as AddressInfo).port
  try {
    await run(port)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

describe("signed-in reviews", () => {
  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("does not seed reviews when the live store is empty", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-reviews-empty-")))
    assert.deepEqual(reviewsForListing("seed-1"), [])
    const seeded = seedDirectoryReviews()
    assert.ok(seeded.some((row) => row.id === "seed-review-1"))
  })

  it("rejects an anonymous review and saves a signed-in review", async () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-reviews-")))
    seedDirectoryListings()
    const listing = createListing({ name: "Harbor Street Cafe", city: "Portland", state: "OR" }, "owner-1")

    assert.throws(
      () => createReview(listing.id, { rating: 5, text: "Strong coffee and a quiet corner." }, null),
      (error: unknown) => {
        assert.ok(error instanceof ListingError)
        assert.equal(error.status, 401)
        return true
      },
    )

    const saved = createReview(
      listing.id,
      { rating: 5, text: "Strong coffee and a quiet corner." },
      { id: "reviewer-1", name: "Maya Chen" },
    )
    assert.equal(saved.authorName, "Maya Chen")
    assert.equal(saved.rating, 5)
    assert.equal(reviewsForListing(listing.id)[0]?.id, saved.id)
  })

  it("POST /api/listings/:id/reviews returns 401 without a session and 201 when signed in", async () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-reviews-http-")))
    seedDirectoryListings()
    const created = signup({ name: "Maya Chen", email: "maya@example.com", password: "password12" })
    const listing = createListing({ name: "Harbor Street Cafe", city: "Portland", state: "OR" }, "owner-1")
    const token = createSession(created.user!.id)

    await withLeadServer(async (port) => {
      const anonymous = await fetch(`http://127.0.0.1:${port}/api/listings/${listing.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: 5, text: "Warm bread every morning." }),
      })
      assert.equal(anonymous.status, 401)
      const denied = (await anonymous.json()) as { error?: string }
      assert.match(denied.error ?? "", /sign in/i)

      const signedIn = await fetch(`http://127.0.0.1:${port}/api/listings/${listing.id}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `pf_session=${token}`,
        },
        body: JSON.stringify({ rating: 4, text: "Busy Saturday line, but worth it." }),
      })
      assert.equal(signedIn.status, 201)
      const payload = (await signedIn.json()) as { review?: { authorName?: string; rating?: number } }
      assert.equal(payload.review?.authorName, "Maya Chen")
      assert.equal(payload.review?.rating, 4)
    })
  })
})
