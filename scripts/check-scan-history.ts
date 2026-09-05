import assert from "node:assert/strict"

import { compareScanRuns, rankChangeDirection } from "../src/lib/scan-compare"
import {
  createScanRun,
  latestKeywordResults,
  mergeWorkspaceScans,
  normalizeWorkspaceScans,
} from "../src/lib/scan-results"
import type { PointResult } from "../src/lib/types"

function point(id: string, rank: number | null, found = rank != null): PointResult {
  return {
    id,
    lat: 30.26,
    lng: -97.74,
    locationCoordinate: "30.26,-97.74,15z",
    rank,
    found,
    listings: [],
    error: null,
  }
}

const legacy = normalizeWorkspaceScans(
  { camp_a: { coffee: { r0c0: point("r0c0", 3), r0c1: point("r0c1", 8) } } },
  ["camp_a"]
)
assert.equal(legacy.camp_a.length, 1)
assert.equal(latestKeywordResults(legacy.camp_a).coffee.r0c0.rank, 3)

const first = createScanRun({
  results: { coffee: { r0c0: point("r0c0", 5), r0c1: point("r0c1", 4) } },
  gridSize: 5,
  radiusMiles: 1.4,
  center: { lat: 30.26, lng: -97.74 },
  keywords: ["coffee"],
  createdAt: "2026-09-01T12:00:00.000Z",
})
const second = createScanRun({
  results: { coffee: { r0c0: point("r0c0", 2), r0c1: point("r0c1", 6) } },
  gridSize: 5,
  radiusMiles: 1.4,
  center: { lat: 30.26, lng: -97.74 },
  keywords: ["coffee"],
  createdAt: "2026-09-05T12:00:00.000Z",
})
const stored = normalizeWorkspaceScans({ camp_a: [second, first] }, ["camp_a"])
assert.equal(stored.camp_a[0].id, second.id, "newest run is first")
assert.equal(latestKeywordResults(stored.camp_a).coffee.r0c0.rank, 2)

const merged = mergeWorkspaceScans(stored, {})
assert.equal(merged.camp_a.length, 2, "empty incoming must not wipe history")

const comparison = compareScanRuns(first, second, "coffee", "Houndstooth Coffee")
assert.equal(comparison.points.find((row) => row.id === "r0c0")?.delta, -3)
assert.equal(comparison.points.find((row) => row.id === "r0c1")?.delta, 2)
assert.equal(comparison.improved, 1)
assert.equal(comparison.declined, 1)
assert.equal(comparison.averageRankDelta, -0.5)
assert.equal(rankChangeDirection(comparison.averageRankDelta), "up")
assert.equal(rankChangeDirection(2), "down")

console.log("ok scan history + compare")
