import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { finalizeGridPointResults, pinScanStatus } from "./scan-finalize.ts"

function pin(row: number, col: number, rank: number | null, error?: string, scannedAt = "") {
  return {
    row,
    col,
    lat: 30.27 + row,
    lng: -97.74 + col,
    keyword: "barbecue",
    rank,
    listingTitle: rank != null ? "Franklin Barbecue" : null,
    rating: null,
    address: null,
    mapsUrl: null,
    scannedAt,
    error,
    status: "pending" as const,
  }
}

describe("pinScanStatus", () => {
  it("classifies rank, not_found, and error", () => {
    assert.equal(pinScanStatus(3), "rank")
    assert.equal(pinScanStatus(null), "not_found")
    assert.equal(pinScanStatus(null, "Maps search timed out."), "error")
  })
})

describe("finalizeGridPointResults", () => {
  it("gives all 9 fixture pins a finished status", () => {
    const raw = [
      pin(0, 0, 1, undefined, "2026-09-06T00:00:00.000Z"),
      pin(0, 1, 4, undefined, "2026-09-06T00:00:00.000Z"),
      pin(0, 2, null, undefined, "2026-09-06T00:00:00.000Z"),
      pin(1, 0, 7, undefined, "2026-09-06T00:00:00.000Z"),
      pin(1, 1, 2, undefined, "2026-09-06T00:00:00.000Z"),
      pin(1, 2, null, "Maps search timed out."),
      pin(2, 0, null, undefined, "2026-09-06T00:00:00.000Z"),
      pin(2, 1, 11, undefined, "2026-09-06T00:00:00.000Z"),
      pin(2, 2, null),
    ]
    const points = finalizeGridPointResults(raw, "2026-09-06T00:01:00.000Z")
    assert.equal(points.length, 9)
    assert.ok(points.every((point) => point.status === "rank" || point.status === "not_found" || point.status === "error"))
    assert.equal(points.filter((point) => point.status === "rank").length, 5)
    assert.equal(points.filter((point) => point.status === "not_found").length, 3)
    assert.equal(points.filter((point) => point.status === "error").length, 1)
    assert.ok(points.every((point) => point.scannedAt))
    assert.ok(points.every((point) => point.status !== "pending" && point.status !== "unset"))
  })
})
