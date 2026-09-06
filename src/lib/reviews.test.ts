import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { reviewSummary, validateReview } from "./reviews.ts"

describe("reviews", () => {
  it("averages ratings and validates input", () => {
    assert.deepEqual(reviewSummary([]), { count: 0, average: null })
    assert.deepEqual(reviewSummary([{ rating: 5 }, { rating: 4 }]), { count: 2, average: 4.5 })
    assert.equal(validateReview({ authorName: "A", rating: 5, text: "Nice shop" }).error, "Enter your name.")
    assert.equal(validateReview({ authorName: "Maya", rating: 6, text: "Nice shop here" }).error, "Choose a rating from 1 to 5.")
    assert.ok(validateReview({ authorName: "Maya", rating: 5, text: "Warm bread every morning." }).value)
  })
})
