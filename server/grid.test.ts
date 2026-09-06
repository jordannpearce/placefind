import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MAX_COORD_DECIMALS,
  MAX_GRID_SIZE,
  MAX_TASKS_PER_POST,
  buildGrid,
  chunkTasks,
  formatCoordinatePart,
  formatLocationCoordinate,
  gridTaskCount,
  mapsGridTask,
  parseLocationCoordinate,
} from "./grid.ts"

describe("formatLocationCoordinate", () => {
  it("formats latitude,longitude,zoom with a z suffix", () => {
    assert.equal(formatLocationCoordinate(40.689199, -73.975035), "40.689199,-73.975035,17z")
    assert.equal(formatLocationCoordinate(40.689199, -73.975035, 17), "40.689199,-73.975035,17z")
  })

  it("keeps at most 7 decimal digits", () => {
    const formatted = formatLocationCoordinate(40.68919912345678, -73.97503598765432, 20)
    assert.equal(formatted, "40.6891991,-73.975036,20z")
    const [lat, lng, zoom] = formatted.split(",")
    assert.ok((lat.split(".")[1] ?? "").length <= MAX_COORD_DECIMALS)
    assert.ok((lng.split(".")[1] ?? "").length <= MAX_COORD_DECIMALS)
    assert.equal(zoom, "20z")
  })

  it("defaults omitted zoom to 17z and clamps 3z–21z", () => {
    assert.match(formatLocationCoordinate(52.6178549, -155.352142), /,17z$/)
    assert.equal(formatLocationCoordinate(52.6178549, -155.352142, 2), "52.6178549,-155.352142,3z")
    assert.equal(formatLocationCoordinate(52.6178549, -155.352142, 30), "52.6178549,-155.352142,21z")
  })

  it("does not use a radius-in-meters third field", () => {
    const value = formatLocationCoordinate(40.689199, -73.975035, 500)
    assert.equal(value, "40.689199,-73.975035,21z")
    assert.doesNotMatch(value, /,500$/)
  })

  it("trims trailing zeros without exceeding 7 decimals", () => {
    assert.equal(formatCoordinatePart(40.5), "40.5")
    assert.equal(formatCoordinatePart(40), "40")
    assert.equal(formatLocationCoordinate(40.5, -73.9, 14), "40.5,-73.9,14z")
  })
})

describe("parseLocationCoordinate", () => {
  it("reads the official lat,lng and lat,lng,zoom forms", () => {
    assert.deepEqual(parseLocationCoordinate("40.689199,-73.975035"), {
      lat: 40.689199,
      lng: -73.975035,
      zoom: 17,
    })
    assert.deepEqual(parseLocationCoordinate("52.6178549,-155.352142,20z"), {
      lat: 52.6178549,
      lng: -155.352142,
      zoom: 20,
    })
  })
})

describe("buildGrid", () => {
  it("builds one unique coordinate task per cell, capped at 7×7", () => {
    const points = buildGrid({
      centerLat: 40.689199,
      centerLng: -73.975035,
      size: 7,
      spacingMiles: 1,
      zoom: 17,
    })
    assert.equal(points.length, 49)
    assert.equal(gridTaskCount(99), 49)
    assert.equal(new Set(points.map((point) => point.locationCoordinate)).size, 49)
    const center = points.find((point) => point.row === 3 && point.col === 3)
    assert.equal(center?.locationCoordinate, "40.689199,-73.975035,17z")
    assert.ok(points.every((point) => /^[-.\d]+,[-.\d]+,17z$/.test(point.locationCoordinate)))
    assert.equal(buildGrid({ centerLat: 30, centerLng: -97, size: 99, spacingMiles: 1 }).length, MAX_GRID_SIZE ** 2)
  })

  it("places north rows at higher latitude and east columns at higher longitude", () => {
    const points = buildGrid({
      centerLat: 30.2672,
      centerLng: -97.7431,
      size: 3,
      spacingMiles: 1,
    })
    const nw = points.find((point) => point.row === 0 && point.col === 0)!
    const se = points.find((point) => point.row === 2 && point.col === 2)!
    assert.ok(nw.lat > se.lat)
    assert.ok(se.lng > nw.lng)
  })
})

describe("mapsGridTask", () => {
  it("builds a Maps SERP task that pins one cell with location_coordinate", () => {
    const task = mapsGridTask("car rental", "40.689199,-73.975035,17z", "2:3")
    assert.deepEqual(task, {
      language_code: "en",
      location_coordinate: "40.689199,-73.975035,17z",
      keyword: "car rental",
      depth: 20,
      search_places: false,
      search_this_area: true,
      tag: "2:3",
    })
  })

  it("chunks POSTs so each body has at most 100 tasks", () => {
    const tasks = Array.from({ length: 149 }, (_, index) => index)
    const chunks = chunkTasks(tasks)
    assert.equal(chunks.length, 2)
    assert.equal(chunks[0]?.length, MAX_TASKS_PER_POST)
    assert.equal(chunks[1]?.length, 49)
  })
})
