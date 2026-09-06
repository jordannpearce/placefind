import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_TRAFFIC_SEARCHES,
  MAX_TRAFFIC_SEARCHES,
  normalizeTrafficSearches,
  planTrafficPairs,
  plannedTrafficSearchCount,
} from "./traffic-plan.ts"

describe("normalizeTrafficSearches", () => {
  it("defaults to 3, requires a whole number, and caps at 50", () => {
    assert.equal(normalizeTrafficSearches(undefined), DEFAULT_TRAFFIC_SEARCHES)
    assert.equal(normalizeTrafficSearches(""), DEFAULT_TRAFFIC_SEARCHES)
    assert.equal(normalizeTrafficSearches(null), DEFAULT_TRAFFIC_SEARCHES)
    assert.equal(normalizeTrafficSearches(1), 1)
    assert.equal(normalizeTrafficSearches(50), MAX_TRAFFIC_SEARCHES)
    assert.equal(normalizeTrafficSearches(99), MAX_TRAFFIC_SEARCHES)
    assert.equal(normalizeTrafficSearches(0), DEFAULT_TRAFFIC_SEARCHES)
    assert.equal(normalizeTrafficSearches(-2), DEFAULT_TRAFFIC_SEARCHES)
    assert.equal(normalizeTrafficSearches(1.5), DEFAULT_TRAFFIC_SEARCHES)
  })
})

describe("planTrafficPairs", () => {
  it("keeps pin × keyword order and stops at the search count", () => {
    const pins = ["p1", "p2", "p3"]
    const keywords = ["barbecue", "brisket"]
    const pairs = pins.flatMap((pin) => keywords.map((keyword) => `${pin}:${keyword}`))
    assert.deepEqual(pairs, ["p1:barbecue", "p1:brisket", "p2:barbecue", "p2:brisket", "p3:barbecue", "p3:brisket"])
    assert.deepEqual(planTrafficPairs(pairs, 4), ["p1:barbecue", "p1:brisket", "p2:barbecue", "p2:brisket"])
    assert.deepEqual(planTrafficPairs(pairs, 1), ["p1:barbecue"])
    assert.deepEqual(planTrafficPairs(pairs, 50), pairs)
    assert.equal(plannedTrafficSearchCount(pairs.length, 4), 4)
    assert.equal(plannedTrafficSearchCount(2, 4), 2)
    assert.equal(plannedTrafficSearchCount(0, 3), 0)
  })
})
