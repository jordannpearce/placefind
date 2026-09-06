import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildGridPoints, buildPreviewPoints, gridPinId, pinColor, rankColor, rankTone } from "./grid.ts"

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

  it("uses row and column as the stable pin id", () => {
    assert.equal(gridPinId({ row: 0, col: 1 }), "0:1")
    assert.equal(gridPinId({ row: 2, col: 4 }), "2:4")
  })

  it("marks preview points as unscanned", () => {
    const preview = buildPreviewPoints(center, 3, 1, "barbecue")
    assert.equal(preview.length, 9)
    assert.ok(preview.every((point) => point.scannedAt === "" && point.rank == null && point.status === "unset"))
  })

  it("labels preview coordinates with at most 7 decimals and a zoom", () => {
    const points = buildGridPoints({ lat: 40.689199123, lng: -73.975035987 }, 3, 1, 17)
    assert.ok(
      points.every((point) => {
        const [lat, lng, zoom] = (point.locationCoordinate || "").split(",")
        return (lat.split(".")[1] ?? "").length <= 7 && (lng.split(".")[1] ?? "").length <= 7 && zoom === "17z"
      }),
    )
  })
})

describe("rankColor", () => {
  it("uses three distinct greens for ranks 1–3, darkest at 1", () => {
    assert.equal(rankColor(1), "#2f6b3d")
    assert.equal(rankColor(2), "#4d8f5a")
    assert.equal(rankColor(3), "#7dae86")
    assert.notEqual(rankColor(1), rankColor(2))
    assert.notEqual(rankColor(2), rankColor(3))
    assert.notEqual(rankColor(1), rankColor(3))
  })

  it("maps rank color buckets", () => {
    assert.equal(rankColor(4), "#e6c24a")
    assert.equal(rankColor(6), "#e6c24a")
    assert.equal(rankColor(7), "#e08a3c")
    assert.equal(rankColor(10), "#e08a3c")
    assert.equal(rankColor(11), "#d45c38")
    assert.equal(rankColor(15), "#d45c38")
    assert.equal(rankColor(16), "#c5362b")
    assert.equal(rankColor(20), "#c5362b")
    assert.equal(rankColor(21), "#c5362b")
    assert.equal(rankColor(null), "#c5362b")
    assert.equal(rankColor(undefined), "#c5362b")
  })

  it("keeps bucket colors distinct from their neighbors", () => {
    assert.notEqual(rankColor(3), rankColor(4))
    assert.notEqual(rankColor(6), rankColor(7))
    assert.notEqual(rankColor(10), rankColor(11))
    assert.notEqual(rankColor(15), rankColor(16))
  })

  it("uses muted ink for unscanned pins and rank color after a scan", () => {
    assert.equal(pinColor({ rank: null, scannedAt: "", error: undefined }), "#b4a793")
    assert.equal(pinColor({ rank: 1, scannedAt: "2026-01-01", error: undefined }), rankColor(1))
    assert.equal(pinColor({ rank: null, scannedAt: "2026-01-01", error: undefined }), rankColor(null))
  })

  it("groups rankTone to the same color buckets", () => {
    assert.equal(rankTone(1), "green")
    assert.equal(rankTone(3), "green")
    assert.equal(rankTone(4), "yellow")
    assert.equal(rankTone(6), "yellow")
    assert.equal(rankTone(7), "orange")
    assert.equal(rankTone(10), "orange")
    assert.equal(rankTone(11), "orange-red")
    assert.equal(rankTone(15), "orange-red")
    assert.equal(rankTone(16), "red")
    assert.equal(rankTone(null), "red")
  })
})
