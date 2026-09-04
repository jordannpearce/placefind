import { listingsFromTask, matchTarget } from "../src/lib/dataforseo"
import { buildGrid, spacingFromRadius } from "../src/lib/grid"
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
console.log("all scan pin checks passed")
