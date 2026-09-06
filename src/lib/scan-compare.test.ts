import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { compareScanRuns, rankChange, rankChangeColor, rankChangeLabel } from "./scan-compare.ts"
import type { GridPointResult, GridScanRun } from "./types.ts"

function point(row: number, col: number, rank: number | null): GridPointResult {
  return {
    row,
    col,
    lat: 30.27 + row * 0.01,
    lng: -97.74 + col * 0.01,
    keyword: "barbecue",
    rank,
    listingTitle: rank == null ? null : "Franklin Barbecue",
    rating: rank == null ? null : 4.7,
    address: rank == null ? null : "900 E 11th St",
    mapsUrl: rank == null ? null : "https://maps.example.test/franklin",
    scannedAt: "2026-09-06T09:00:00.000Z",
  }
}

function scan(id: string, points: GridPointResult[]): GridScanRun {
  return {
    id,
    campaignId: "c1",
    startedAt: "2026-09-06T09:00:00.000Z",
    finishedAt: "2026-09-06T09:05:00.000Z",
    scannedAt: "2026-09-06T09:05:00.000Z",
    keyword: "barbecue",
    gridSize: 3,
    spacingMiles: 1,
    center: { lat: 30.27, lng: -97.74 },
    placeId: "sample-franklin",
    pointCount: points.length,
    foundCount: points.filter((row) => row.rank != null).length,
    points,
  }
}

describe("rankChange", () => {
  it("treats a drop from rank 5 to 3 as up", () => {
    assert.equal(rankChange(5, 3), "up")
    assert.equal(rankChangeLabel("up"), "Improved")
    assert.equal(rankChangeColor("up"), "#2f6b3d")
  })

  it("classifies down, same, new, and lost", () => {
    assert.equal(rankChange(3, 5), "down")
    assert.equal(rankChange(4, 4), "same")
    assert.equal(rankChange(null, 2), "new")
    assert.equal(rankChange(7, null), "lost")
    assert.equal(rankChange(null, null), "same")
    assert.equal(rankChangeLabel("down"), "Worse")
    assert.equal(rankChangeColor("down"), "#c5362b")
    assert.equal(rankChangeLabel("new"), "New")
    assert.equal(rankChangeLabel("lost"), "Lost")
  })
})

describe("compareScanRuns", () => {
  it("builds per-pin deltas for two fixtures", () => {
    const previous = scan("a", [point(0, 0, 5), point(0, 1, 2), point(1, 0, null)])
    const current = scan("b", [point(0, 0, 3), point(0, 1, 2), point(1, 0, 8)])
    const result = compareScanRuns(previous, current)
    assert.equal(result.pins.find((pin) => pin.row === 0 && pin.col === 0)?.change, "up")
    assert.equal(result.pins.find((pin) => pin.row === 0 && pin.col === 1)?.change, "same")
    assert.equal(result.pins.find((pin) => pin.row === 1 && pin.col === 0)?.change, "new")
    assert.equal(result.improved, 1)
    assert.equal(result.added, 1)
    assert.equal(result.same, 1)
  })

  it("compares the same pin separately for each keyword", () => {
    const previous = scan("a", [point(0, 0, 5), { ...point(0, 0, 8), keyword: "brisket" }])
    const current = scan("b", [point(0, 0, 3), { ...point(0, 0, 8), keyword: "brisket" }])
    const result = compareScanRuns(previous, current)
    assert.equal(result.pins.find((pin) => pin.keyword === "barbecue")?.change, "up")
    assert.equal(result.pins.find((pin) => pin.keyword === "brisket")?.change, "same")
  })
})
