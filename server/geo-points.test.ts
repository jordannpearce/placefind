import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { parseGeoCsv } from "./geo-csv.ts"
import {
  applyCityGpsBackup,
  cityKey,
  importGeoCsvText,
  importGeoPoints,
  listGeoPointsForCity,
  listNearbyGeoPoints,
  haversineMiles,
  milesBetween,
  nearestGeoPoints,
  uniqueCityNamesWithinMiles,
  normalizePinSource,
  resetGeoPointsForTests,
  resolveScanPoints,
  usingCityGpsBackupNote,
} from "./geo-points.ts"

const franklin = { lat: 30.2701, lng: -97.7313 }

function gridCell(row: number, col: number, lat: number, lng: number) {
  return { row, col, lat, lng, locationCoordinate: `${lat},${lng},14z` }
}

describe("normalizePinSource", () => {
  it("defaults to the listing grid", () => {
    assert.equal(normalizePinSource(undefined), "grid")
    assert.equal(normalizePinSource("city_gps"), "city_gps")
    assert.equal(normalizePinSource("csv"), "city_gps")
  })
})

describe("nearestGeoPoints", () => {
  it("returns the closest N points around the listing", () => {
    const points = [
      { lat: 30.4, lng: -97.7 },
      { lat: 30.2702, lng: -97.7314 },
      { lat: 30.28, lng: -97.74 },
      { lat: 31.0, lng: -97.0 },
    ]
    const nearest = nearestGeoPoints(franklin, points, 2)
    assert.equal(nearest.length, 2)
    assert.ok(milesBetween(franklin, nearest[0]!) < milesBetween(franklin, nearest[1]!))
    assert.ok(Math.abs(nearest[0]!.lat - 30.2702) < 1e-6)
    assert.equal(nearestGeoPoints(franklin, points, 0).length, 0)
  })
})

describe("applyCityGpsBackup", () => {
  it("snaps each grid cell to the nearest unused city GPS point", () => {
    const computed = [
      gridCell(0, 0, 30.28, -97.74),
      gridCell(0, 1, 30.28, -97.73),
      gridCell(1, 0, 30.27, -97.74),
      gridCell(1, 1, 30.27, -97.73),
    ]
    const city = [
      { lat: 30.2801, lng: -97.7401 },
      { lat: 30.27005, lng: -97.73005 },
    ]
    const result = applyCityGpsBackup(computed, city, 14, 1)
    assert.equal(result.usedCityGps, true)
    assert.equal(result.snappedCount, 2)
    assert.equal(result.points.length, 4)
    const lats = result.points.map((point) => point.lat)
    assert.equal(lats.includes(30.2801), true)
    assert.equal(lats.includes(30.27005), true)
    assert.equal(result.points.filter((point) => point.lat === 30.28 || point.lat === 30.27).length, 2)
  })

  it("keeps the computed coordinate when a pin has no CSV neighbor", () => {
    const computed = [gridCell(0, 0, 30.27, -97.74), gridCell(0, 1, 47.6, -122.3)]
    const result = applyCityGpsBackup(computed, [{ lat: 30.2701, lng: -97.7399 }], 14, 1)
    assert.equal(result.snappedCount, 1)
    assert.equal(result.points[0]?.lat, 30.2701)
    assert.equal(result.points[1]?.lat, 47.6)
    assert.equal(result.points[1]?.lng, -122.3)
  })
})

describe("city GPS store", () => {
  it("indexes imported points by state and city", () => {
    resetGeoPointsForTests()
    importGeoPoints([
      { city: "Austin", state: "Texas", lat: 30.2672, lng: -97.7431 },
      { city: "Austin", state: "TX", lat: 30.2701, lng: -97.7313 },
      { city: "Seattle", state: "WA", lat: 47.6097, lng: -122.3331 },
    ])
    assert.equal(cityKey("Austin", "TX"), "tx|austin")
    assert.equal(listGeoPointsForCity("austin", "Texas").length, 2)
    assert.equal(listGeoPointsForCity("Seattle", "WA").length, 1)
  })

  it("imports the bundled sample CSV", () => {
    resetGeoPointsForTests()
    const csv = readFileSync(path.resolve(process.cwd(), "data/us-cities-sample.csv"), "utf8")
    const parsed = parseGeoCsv(csv)
    assert.ok(parsed.points.length >= 8)
    const { meta } = importGeoCsvText(csv, "us-cities-sample.csv")
    assert.ok(meta.pointCount >= 8)
    assert.ok(listGeoPointsForCity("Austin", "TX").length >= 3)
  })

  it("uses only that city's CSV points when the file is one row per city", () => {
    resetGeoPointsForTests()
    importGeoPoints([
      { city: "Austin", state: "TX", lat: 30.2672, lng: -97.7431, population: 900000 },
      { city: "Round Rock", state: "TX", lat: 30.5082, lng: -97.6789 },
      { city: "Dallas", state: "TX", lat: 32.7767, lng: -96.797 },
      { city: "Seattle", state: "WA", lat: 47.6097, lng: -122.3331 },
    ])
    const nearby = listNearbyGeoPoints(franklin, "Austin", "TX", 4)
    assert.equal(nearby.length, 1)
    assert.equal(nearby[0]?.city, "Austin")
    const backup = resolveScanPoints({
      center: franklin,
      city: "Austin",
      state: "TX",
      gridSize: 2,
      spacingMiles: 1,
      pinSource: "city_gps",
      buildGrid: (origin) => [
        gridCell(0, 0, origin.lat + 0.01, origin.lng - 0.01),
        gridCell(0, 1, origin.lat + 0.01, origin.lng + 0.01),
        gridCell(1, 0, origin.lat - 0.01, origin.lng - 0.01),
        gridCell(1, 1, origin.lat, origin.lng),
      ],
    })
    assert.equal(backup.usedCityGps, true)
    assert.equal(backup.cityPointCount, 1)
    assert.equal(backup.points.length, 4)
    assert.ok(backup.points.some((point) => Math.abs(point.lat - 30.2672) < 1e-6))
    assert.equal(
      backup.points.some((point) => Math.abs(point.lat - 32.7767) < 1e-6 || Math.abs(point.lat - 47.6097) < 1e-6),
      false,
    )
  })

  it("uses city GPS points only in city_gps mode", () => {
    resetGeoPointsForTests()
    importGeoPoints([{ city: "Austin", state: "TX", lat: 30.2801, lng: -97.7401 }])
    const center = { lat: 30.27, lng: -97.74 }
    const buildGrid = (origin: { lat: number; lng: number }) => [gridCell(0, 0, origin.lat, origin.lng)]
    const grid = resolveScanPoints({
      center,
      city: "Austin",
      state: "TX",
      gridSize: 3,
      spacingMiles: 1,
      pinSource: "grid",
      buildGrid: (origin) => buildGrid(origin),
    })
    assert.equal(grid.usedCityGps, false)
    assert.equal(grid.points[0]?.lat, 30.27)
    const backup = resolveScanPoints({
      center,
      city: "Austin",
      state: "TX",
      gridSize: 3,
      spacingMiles: 1,
      pinSource: "city_gps",
      buildGrid: (origin) => buildGrid(origin),
    })
    assert.equal(backup.usedCityGps, true)
    assert.equal(backup.points[0]?.lat, 30.2801)
  })

  it("does not pull GPS points from another city", () => {
    resetGeoPointsForTests()
    importGeoPoints([
      { city: "Austin", state: "TX", lat: 30.2801, lng: -97.7401 },
      { city: "Chicago", state: "IL", lat: 41.8781, lng: -87.6298 },
      { city: "New York", state: "NY", lat: 40.758, lng: -73.9855 },
    ])
    const backup = resolveScanPoints({
      center: { lat: 30.27, lng: -97.74 },
      city: "Austin",
      state: "TX",
      gridSize: 3,
      spacingMiles: 1,
      pinSource: "city_gps",
      buildGrid: (origin) => [
        gridCell(0, 0, origin.lat + 0.01, origin.lng),
        gridCell(0, 1, origin.lat, origin.lng),
        gridCell(0, 2, origin.lat - 0.01, origin.lng),
      ],
    })
    assert.equal(backup.cityPointCount, 1)
    assert.equal(
      backup.points.some((point) => Math.abs(point.lat - 41.8781) < 1e-6 || Math.abs(point.lat - 40.758) < 1e-6),
      false,
    )
    assert.equal(backup.points.some((point) => Math.abs(point.lat - 30.2801) < 1e-6), true)
  })
})

describe("uniqueCityNamesWithinMiles", () => {
  it("returns unique city names within 50 haversine miles", () => {
    resetGeoPointsForTests()
    importGeoPoints([
      { city: "Austin", state: "TX", lat: 30.2672, lng: -97.7431 },
      { city: "Ava", state: "TX", lat: 30.28, lng: -97.74 },
      { city: "Round Rock", state: "TX", lat: 30.5082, lng: -97.6789 },
      { city: "Dallas", state: "TX", lat: 32.7767, lng: -96.797 },
    ])
    const names = uniqueCityNamesWithinMiles(franklin, 50)
    assert.ok(names.includes("Austin"))
    assert.ok(names.includes("Ava"))
    assert.ok(names.includes("Round Rock"))
    assert.equal(names.includes("Dallas"), false)
    assert.ok(haversineMiles(franklin, { lat: 32.7767, lng: -96.797 }) > 50)
  })
})

describe("usingCityGpsBackupNote", () => {
  it("stays vendor-free", () => {
    assert.equal(usingCityGpsBackupNote(), "Using city GPS backup")
  })
})
