import {
  dataForSeoErrorMessage,
  isEmptySearchResults,
  listingsFromTask,
  mapsLiveTask,
  matchTarget,
} from "../src/lib/dataforseo.ts"
import { buildGrid, formatCoordinate, spacingFromRadius } from "../src/lib/grid.ts"
import { mockScanPoint } from "../src/lib/mock-scan.ts"
import { listingMatchesTarget, pinMark } from "../src/lib/rank.ts"
import { latestKeywordResults, mergeWorkspaceScans, normalizeWorkspaceScans } from "../src/lib/scan-results.ts"
import type { Listing } from "../src/lib/types.ts"

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
  unknownTarget.every(
    (row) => row.found && row.rank != null && row.rank >= 1 && row.rank <= 20 && row.listings.length > 0
  ),
  "sample mode must paint a numeric rank on every pin even when the campaign listing is not in the Austin set"
)
console.log("ok mock paints ranks for a listing outside the Austin sample set")

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
  latestKeywordResults(campaignKeyed.camp_houndstooth_austin).coffee.r0c0.found,
  "campaign-keyed workspace scans stay campaign-keyed"
)

const bare = normalizeWorkspaceScans({ coffee: { r0c0: matched } }, ["camp_houndstooth_austin"])
assert(
  latestKeywordResults(bare.camp_houndstooth_austin).coffee.r0c0.found,
  "bare KeywordResults attach to the active campaign"
)

const seeded = normalizeWorkspaceScans(
  { camp_houndstooth_austin: { coffee: { r0c0: matched } } },
  ["camp_houndstooth_austin"]
)
const wiped = mergeWorkspaceScans(seeded, {})
assert(
  latestKeywordResults(wiped.camp_houndstooth_austin).coffee.r0c0.found,
  "empty server scans must not wipe local results"
)

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
assert(
  isEmptySearchResults({
    status_code: 20000,
    status_message: "Ok.",
    tasks: [{ status_code: 40102, status_message: "No Search Results." }],
  }),
  "40102 is an empty Maps pack, not a failed request"
)
assert(
  dataForSeoErrorMessage({
    status_code: 20000,
    tasks: [{ status_code: 40102, status_message: "No Search Results." }],
  }) === null,
  "empty SERP must not surface as a scan error"
)
const emptyPin = matchTarget({
  id: "r0c0",
  lat: 30.26,
  lng: -97.74,
  locationCoordinate: "30.26,-97.74,15z",
  listings: [],
  targetBusiness: "Houndstooth Coffee",
})
assert(emptyPin.found === false && emptyPin.rank == null && emptyPin.error == null, "empty pack is not found")

const grid = buildGrid(30.2672, -97.7431, 5, spacingFromRadius(1.4, 5))
assert(grid.length === 25, "5×5 lattice is 25 cells around the listing")
const cellTasks = grid.map((point) =>
  mapsLiveTask({
    keyword: "coffee",
    languageCode: "en",
    locationCoordinate: formatCoordinate(point.lat, point.lng, 15),
    device: "desktop",
    depth: 20,
  })
)
const cellCoords = cellTasks.map((task) => task.location_coordinate)
assert(new Set(cellCoords).size === 25, "each cell posts its own location_coordinate")
assert(
  cellTasks.every(
    (task) =>
      task.location_coordinate &&
      !("location_code" in task) &&
      !("location_name" in task) &&
      task.language_code === "en"
  ),
  "grid tasks are coordinate-only with language_code en — never United States location_code/name"
)
assert(
  grid.some((point) => point.lat !== 30.2672 || point.lng !== -97.7431),
  "lattice is not a single repeated coordinate"
)

const listing = (partial: Partial<Listing>): Listing => ({
  rankAbsolute: 3,
  rankGroup: 3,
  type: "maps_search",
  title: "Houndstooth Coffee",
  domain: null,
  address: null,
  placeId: "ChIJ1",
  cid: "12345",
  phone: null,
  category: null,
  rating: null,
  reviews: null,
  latitude: 30.2669,
  longitude: -97.7434,
  url: null,
  isPaid: false,
  ...partial,
})

assert(listingMatchesTarget(listing({}), { title: "Other", placeId: "ChIJ1" }), "place_id match wins")
assert(
  listingMatchesTarget(listing({ placeId: null }), { title: "Houndstooth Coffee", cid: "12345" }),
  "title+cid match"
)
assert(
  listingMatchesTarget(listing({ placeId: null, cid: null }), {
    title: "Houndstooth Coffee",
    lat: 30.267,
    lng: -97.743,
  }),
  "normalized name + nearby coords match"
)
assert(
  !listingMatchesTarget(listing({ placeId: null, cid: null }), {
    title: "Houndstooth Coffee",
    lat: 29.76,
    lng: -95.36,
  }),
  "same name 150+ miles away is a different storefront"
)
assert(
  listingMatchesTarget(listing({ isPaid: true }), { title: "Houndstooth Coffee", placeId: "ChIJ1" }) === false,
  "paid items are not organic ranks"
)

const unranked = listingsFromTask({
  result: [{ items: [{ type: "maps_search", title: "First" }, { type: "maps_search", title: "Second" }] }],
})
assert(
  unranked[0].rankGroup === 1 && unranked[1].rankGroup === 2,
  "items without rank_group still get sequential organic ranks"
)

assert(pinMark({ loading: true }) === "…", "loading pin is not blank")
assert(pinMark({ error: "DataForSEO 40100: Authorization Error", scanned: true }) === "!", "error pin")
assert(pinMark({ rank: 7, scanned: true }) === "7", "ranked pin shows the number")
assert(pinMark({ rank: null, scanned: true }) === "—", "outside-pack pin shows an em dash")
assert(pinMark({ scanned: false }) === "·", "unscanned pin still has a glyph")

console.log("ok DataForSEO request shape + error bodies")
console.log("ok per-cell coordinates + pin marks + listing match")
console.log("all scan pin checks passed")
