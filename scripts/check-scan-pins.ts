import { dataForSeoErrorMessage, listingsFromTask, mapsLiveTask, matchTarget } from "../src/lib/dataforseo"
import { buildGrid, formatCoordinate, spacingFromRadius } from "../src/lib/grid"
import { mockScanPoint } from "../src/lib/mock-scan"
import { mergeWorkspaceScans, normalizeWorkspaceScans } from "../src/lib/scan-results"

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function scanGrid(size: 5 | 7, target = "Houndstooth Coffee") {
  const spacing = spacingFromRadius(1.4, size)
  const points = buildGrid(30.2672, -97.7431, size, spacing)
  return points.map((point) =>
    mockScanPoint({
      pointId: point.id,
      keyword: "coffee",
      targetBusiness: target,
      lat: point.lat,
      lng: point.lng,
      zoom: 15,
    })
  )
}

for (const size of [5, 7] as const) {
  const results = scanGrid(size)
  assert(results.length === size * size, `${size}×${size} must produce ${size * size} points`)
  const uniqueCoords = new Set(results.map((row) => `${row.lat},${row.lng}`))
  const uniqueTasks = new Set(results.map((row) => row.locationCoordinate))
  assert(uniqueCoords.size === size * size, `${size}×${size} must have ${size * size} unique lat/lng, got ${uniqueCoords.size}`)
  assert(uniqueTasks.size === size * size, `${size}×${size} must send ${size * size} unique location_coordinate values, got ${uniqueTasks.size}`)
  assert(
    results.every((row) => !("location_code" in row) && row.locationCoordinate.includes(",")),
    `${size}×${size} every cell stays on lat,lng,zoom — not a country code`
  )
  assert(
    results.every((row) => row.id && (row.found ? row.rank != null && row.rank >= 1 : row.rank == null)),
    `${size}×${size} every cell needs a rank or explicit outside-pack`
  )
  assert(
    results.every((row) => row.listings.length > 0),
    `${size}×${size} mock listings should not be empty downtown`
  )
  const found = results.filter((row) => row.found).length
  assert(found === results.length, `${size}×${size} Houndstooth should rank at every downtown pin, got ${found}`)
  console.log(`ok mock ${size}×${size} · ${found} ranked`)
}

const unknownTarget = scanGrid(5, "Not A Real Cafe LLC")
assert(
  unknownTarget.every((row) => !row.found && row.rank == null && row.listings.length > 0),
  "unknown listing must be outside-pack at every cell, not a blank hole"
)
console.log("ok outside-pack is explicit for an unmatched listing")

const typed = listingsFromTask({
  result: [{ items: [{ type: "maps_search", title: "Houndstooth Coffee", rank_group: 2, place_id: "ChIJ1" }] }],
})
assert(typed.length === 1 && typed[0].rankGroup === 2, "maps_search items parse")

const untyped = listingsFromTask({
  result: [{ items: [{ title: "Houndstooth Coffee", rank_absolute: 4, place_id: "ChIJ1" }] }],
})
assert(untyped.length === 1 && untyped[0].rankAbsolute === 4, "title-only items must not be dropped")

const nested = listingsFromTask({
  result: [
    {
      items: [
        {
          type: "maps",
          items: [{ type: "maps_search", title: "Houndstooth Coffee", rank_group: 1 }],
        },
      ],
    },
  ],
})
assert(nested.length === 1 && nested[0].title === "Houndstooth Coffee", "nested maps groups flatten")

const matched = matchTarget({
  id: "r0c0",
  lat: 30.26,
  lng: -97.74,
  locationCoordinate: "30.26,-97.74,15z",
  listings: untyped,
  targetBusiness: "Houndstooth Coffee",
})
assert(matched.found && matched.rank === 4, "rank_absolute is used when rank_group is missing")

const campaignKeyed = normalizeWorkspaceScans(
  { camp_houndstooth_austin: { coffee: { r0c0: matched } } },
  ["camp_houndstooth_austin"]
)
assert(
  campaignKeyed.camp_houndstooth_austin.coffee.r0c0.found,
  "campaign-keyed workspace scans stay campaign-keyed"
)

const bare = normalizeWorkspaceScans({ coffee: { r0c0: matched } }, ["camp_houndstooth_austin"])
assert(bare.camp_houndstooth_austin?.coffee.r0c0.found, "bare KeywordResults attach to the active campaign")

const wiped = mergeWorkspaceScans({ camp_houndstooth_austin: { coffee: { r0c0: matched } } }, {})
assert(wiped.camp_houndstooth_austin.coffee.r0c0.found, "empty server scans must not wipe local results")

console.log("ok DataForSEO parse + workspace scan shape")

const coord = formatCoordinate(30.26721234567, -97.74319876543, 15.4)
assert(coord === "30.2672123,-97.7431988,15z", `location_coordinate must be lat,lng,zoomz with 7 decimals, got ${coord}`)
assert(
  formatCoordinate(30.26, -97.74, 2) === "30.26,-97.74,3z" &&
    formatCoordinate(30.26, -97.74, 99) === "30.26,-97.74,21z",
  "zoom must clamp to 3–21"
)

const taskBody = mapsLiveTask({
  keyword: "coffee",
  languageCode: "en",
  locationCoordinate: coord,
  device: "desktop",
  depth: 20,
})
assert(taskBody.location_coordinate === coord, "live task uses formatted coordinate")
assert(!("location_code" in taskBody) && !("location_name" in taskBody), "coordinate-only task must omit location_code/name")
assert(taskBody.search_this_area === true && taskBody.search_places === false, "grid tasks stay in search-this-area mode")

assert(
  dataForSeoErrorMessage({ status_code: 20000, status_message: "Ok." }) === null,
  "ok payload is not an error"
)
assert(
  dataForSeoErrorMessage({
    status_code: 20000,
    tasks: [{ status_code: 40501, status_message: "Invalid Field: 'location_coordinate'." }],
  }) === "DataForSEO 40501: Invalid Field: 'location_coordinate'",
  "task status_code wins over a top-level Ok"
)
assert(
  dataForSeoErrorMessage({ status_code: 40100, status_message: "Authorization Error." }, 401) ===
    "DataForSEO 40100: Authorization Error",
  "top-level auth errors keep the DFS code"
)
assert(
  dataForSeoErrorMessage({}, 502) === "DataForSEO returned HTTP 502",
  "HTTP failures without a JSON body still surface"
)

console.log("ok DataForSEO request shape + error bodies")
console.log("all scan pin checks passed")
