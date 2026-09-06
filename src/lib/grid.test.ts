import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildGridPoints, buildPreviewPoints } from "./grid.ts"

describe("buildGridPoints", () => {
  const center = { lat: 30.27, lng: -97.74 }

  it("builds a 3×3 grid with the listing at the center", () => {
    const points = buildGridPoints(center, 3, 1)
    assert.equal(points.length, 9)
    const middle = points.find((point) => point.row === 1 && point.col === 1)
    assert.ok(middle)
    if (!middle) return
    assert.ok(Math.abs(middle.lat - center.lat) < 1e-9)
    assert.ok(Math.abs(middle.lng - center.lng) < 1e-9)
  })

  it("builds a 5×5 grid of 25 points including the center", () => {
    const points = buildGridPoints(center, 5, 1)
    assert.equal(points.length, 25)
    const middle = points.find((point) => point.row === 2 && point.col === 2)
    assert.ok(middle)
    if (!middle) return
    assert.ok(Math.abs(middle.lat - center.lat) < 1e-9)
    assert.ok(Math.abs(middle.lng - center.lng) < 1e-9)
  })

  it("builds a 7×7 grid of 49 points including the center", () => {
    const points = buildGridPoints(center, 7, 0.5)
    assert.equal(points.length, 49)
    const middle = points.find((point) => point.row === 3 && point.col === 3)
    assert.ok(middle)
    if (!middle) return
    assert.ok(Math.abs(middle.lat - center.lat) < 1e-9)
    assert.ok(Math.abs(middle.lng - center.lng) < 1e-9)
  })

  it("marks preview points as unscanned", () => {
    const preview = buildPreviewPoints(center, 3, 1, "barbecue")
    assert.equal(preview.length, 9)
    assert.ok(preview.every((point) => point.scannedAt === "" && point.rank == null))
  })
})
