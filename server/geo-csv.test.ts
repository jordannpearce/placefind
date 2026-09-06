import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mapGeoCsvColumns, parseGeoCsv, parseLatLngPair, splitCsvLine } from "./geo-csv.ts"

describe("mapGeoCsvColumns", () => {
  it("maps city, state, lat, and lng", () => {
    const columns = mapGeoCsvColumns(["city", "state", "lat", "lng"])
    assert.equal(columns.city, "city")
    assert.equal(columns.state, "state")
    assert.equal(columns.lat, "lat")
    assert.equal(columns.lng, "lng")
  })

  it("accepts latitude, longitude, gps, and coord aliases", () => {
    const aliases = mapGeoCsvColumns(["Town", "State", "Latitude", "Longitude"])
    assert.equal(aliases.city, "Town")
    assert.equal(aliases.lat, "Latitude")
    assert.equal(aliases.lng, "Longitude")
    const gps = mapGeoCsvColumns(["city", "st", "gps"])
    assert.equal(gps.state, "st")
    assert.equal(gps.gps, "gps")
    const coord = mapGeoCsvColumns(["city", "state", "coord"])
    assert.equal(coord.gps, "coord")
  })

  it("maps the uploaded US cities headers, preferring the 2-letter state", () => {
    const columns = mapGeoCsvColumns([
      "city",
      "state abbreviation",
      "state name",
      "latitude",
      "longitude",
      "population",
      "military",
      "incorporated",
      "zips",
    ])
    assert.equal(columns.city, "city")
    assert.equal(columns.state, "state abbreviation")
    assert.equal(columns.lat, "latitude")
    assert.equal(columns.lng, "longitude")
    assert.equal(columns.zip, "zips")
    assert.equal(columns.population, "population")
  })

  it("maps SimpleMaps city_ascii and state_id when those are present", () => {
    const columns = mapGeoCsvColumns(["city_ascii", "state_id", "state_name", "lat", "lng", "zips", "population"])
    assert.equal(columns.city, "city_ascii")
    assert.equal(columns.state, "state_id")
    assert.equal(columns.lat, "lat")
    assert.equal(columns.lng, "lng")
    assert.equal(columns.zip, "zips")
  })
})

describe("parseLatLngPair", () => {
  it("reads comma or space separated GPS pairs", () => {
    assert.deepEqual(parseLatLngPair("30.2672,-97.7431"), { lat: 30.2672, lng: -97.7431 })
    assert.deepEqual(parseLatLngPair("40.73, -73.93"), { lat: 40.73, lng: -73.93 })
    assert.deepEqual(parseLatLngPair("47.6097 -122.3331"), { lat: 47.6097, lng: -122.3331 })
    assert.equal(parseLatLngPair("not-a-point"), null)
  })
})

describe("parseGeoCsv", () => {
  it("parses city, state, lat, and lng rows", () => {
    const parsed = parseGeoCsv(`city,state,lat,lng
Austin,TX,30.2672,-97.7431
Seattle,Washington,47.6097,-122.3331`)
    assert.equal(parsed.points.length, 2)
    assert.equal(parsed.points[0]?.city, "Austin")
    assert.equal(parsed.points[0]?.state, "TX")
    assert.equal(parsed.points[0]?.lat, 30.2672)
    assert.equal(parsed.points[0]?.lng, -97.7431)
    assert.equal(parsed.points[1]?.state, "WA")
  })

  it("reads a gps column when lat and lng are missing", () => {
    const parsed = parseGeoCsv(`city,state,gps,zip,name
Austin,TX,"30.2701, -97.7313",78702,East Austin`)
    assert.equal(parsed.points.length, 1)
    assert.equal(parsed.points[0]?.lat, 30.2701)
    assert.equal(parsed.points[0]?.lng, -97.7313)
    assert.equal(parsed.points[0]?.zip, "78702")
    assert.equal(parsed.points[0]?.name, "East Austin")
  })

  it("skips rows that are missing coordinates", () => {
    const parsed = parseGeoCsv(`city,state,lat,lng
Austin,TX,30.2672,-97.7431
Nowhere,TX,,
,TX,30.1,-97.7`)
    assert.equal(parsed.points.length, 1)
    assert.equal(parsed.skipped, 2)
  })

  it("keeps quoted commas inside cells", () => {
    assert.deepEqual(splitCsvLine(`Austin,TX,"30.27, -97.74"`), ["Austin", "TX", "30.27, -97.74"])
  })

  it("reads the uploaded US cities header row", () => {
    const parsed = parseGeoCsv(`city,state abbreviation,state name,latitude,longitude,population,military,incorporated,zips
New York,NY,New York,40.6943,-73.9249,19268388,FALSE,TRUE,11232 10110
Austin,TX,Texas,30.2672,-97.7431,961855,FALSE,TRUE,78701 78702`)
    assert.equal(parsed.columns.state, "state abbreviation")
    assert.equal(parsed.columns.lat, "latitude")
    assert.equal(parsed.columns.lng, "longitude")
    assert.equal(parsed.columns.zip, "zips")
    assert.equal(parsed.points.length, 2)
    assert.equal(parsed.points[0]?.city, "New York")
    assert.equal(parsed.points[0]?.state, "NY")
    assert.equal(parsed.points[0]?.lat, 40.6943)
    assert.equal(parsed.points[0]?.lng, -73.9249)
    assert.equal(parsed.points[0]?.zip, "11232 10110")
    assert.equal(parsed.points[0]?.population, 19268388)
    assert.equal(parsed.points[1]?.state, "TX")
  })
})
