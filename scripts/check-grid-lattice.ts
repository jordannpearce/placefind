import { mapsLiveTask } from "../src/lib/dataforseo"
import {
  buildGrid,
  formatCoordinate,
  GRID_SIZES,
  normalizeGridSize,
  spacingFromRadius,
} from "../src/lib/grid"
import { campaignToConfig, defaultCampaign } from "../src/lib/storage"
import { latestKeywordResults, normalizeWorkspaceScans } from "../src/lib/scan-results"
import type { GridSize, PointResult } from "../src/lib/types"

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function uniqueKeys(points: Array<{ lat: number; lng: number }>, zoom = 15) {
  const raw = new Set(points.map((point) => `${point.lat},${point.lng}`))
  const formatted = new Set(points.map((point) => formatCoordinate(point.lat, point.lng, zoom)))
  return { raw: raw.size, formatted: formatted.size }
}

function expectLattice(size: GridSize, spacingMiles: number, label: string) {
  const points = buildGrid(30.2672, -97.7431, size, spacingMiles)
  const expected = size * size
  const keys = uniqueKeys(points)
  assert(points.length === expected, `${label}: expected ${expected} points, got ${points.length}`)
  assert(keys.raw === expected, `${label}: expected ${expected} unique coords, got ${keys.raw}`)
  assert(
    keys.formatted === expected,
    `${label}: expected ${expected} unique location_coordinate values, got ${keys.formatted}`
  )
  assert(points[0].id === "r0c0", `${label}: first cell must be r0c0`)
  assert(
    points[expected - 1].id === `r${size - 1}c${size - 1}`,
    `${label}: last cell must be r${size - 1}c${size - 1} (no dropped row/col)`
  )
  const mid = points.find((point) => point.row === (size - 1) / 2 && point.col === (size - 1) / 2)
  assert(mid, `${label}: center cell missing`)
  const tasks = points.map((point) =>
    mapsLiveTask({
      keyword: "coffee",
      languageCode: "en",
      locationCoordinate: formatCoordinate(point.lat, point.lng, 15),
      device: "desktop",
      depth: 20,
    })
  )
  assert(
    tasks.every((task) => !("location_code" in task) && !("location_name" in task)),
    `${label}: DFS task must not send United States location_code/name`
  )
  const taskCoords = new Set(tasks.map((task) => task.location_coordinate))
  assert(taskCoords.size === expected, `${label}: DFS requests collapsed to ${taskCoords.size} coords`)
  return points
}

const before: Record<string, { count: number; unique: number }> = {}
for (const size of [5, 7] as const) {
  const spacing = spacingFromRadius(1.4, size)
  const points = expectLattice(size, spacing, `${size}×${size} downtown`)
  before[`${size}x${size}`] = { count: points.length, unique: uniqueKeys(points).formatted }
  console.log(`ok ${size}×${size} → ${points.length} unique GPS (${spacing} mi spacing)`)
}

for (const size of GRID_SIZES) {
  expectLattice(size, spacingFromRadius(1.4, size), `${size}×${size} default radius`)
}

expectLattice(5, 0, "5×5 spacing 0 must not collapse")
expectLattice(7, Number.NaN, "7×7 NaN spacing must not collapse")
expectLattice(5, 0.0001, "5×5 tiny spacing stays unique after 7-decimal quantize")

assert(normalizeGridSize(null) === 5, "null grid size snaps to 5")
assert(normalizeGridSize(1) === 5, "size 1 is not a 1-cell 'center only' grid")
assert(normalizeGridSize(4) === 5, "even size 4 snaps to an odd lattice")
assert(normalizeGridSize("7") === 7, "string 7 is a valid 7×7")

const collapsed = campaignToConfig(
  {
    ...defaultCampaign(),
    gridSize: 7 as GridSize,
    radiusMiles: 0,
    center: { lat: Number.NaN, lng: Number.NaN },
  },
  true
)
assert(collapsed.gridSize === 7, "campaign 7×7 stays 7")
assert(collapsed.radiusMiles >= 0.5, "zero radius must not stay 0")
assert(Number.isFinite(collapsed.center.lat) && Number.isFinite(collapsed.center.lng), "center is finite")
const fromCampaign = buildGrid(
  collapsed.center.lat,
  collapsed.center.lng,
  collapsed.gridSize,
  collapsed.spacingMiles
)
assert(fromCampaign.length === 49, "sanitized 7×7 campaign still builds 49 points")
assert(uniqueKeys(fromCampaign).formatted === 49, "sanitized 7×7 campaign coords stay unique")

const sample: PointResult = {
  id: "r0c0",
  lat: 30.2672,
  lng: -97.7431,
  locationCoordinate: "30.2672,-97.7431,15z",
  rank: 2,
  found: true,
  listings: [],
  error: null,
}
const hydrated = normalizeWorkspaceScans(
  {
    camp_houndstooth_austin: {
      coffee: {
        r0c0: { ...sample, lat: "30.2672" as unknown as number, lng: "-97.7431" as unknown as number },
        r0c1: { ...sample, id: "r0c1", lat: 30.2672, lng: -97.733 },
      },
    },
  },
  ["camp_houndstooth_austin"]
)
const hydratedPoints = latestKeywordResults(hydrated.camp_houndstooth_austin)
assert(
  hydratedPoints.coffee.r0c0 && hydratedPoints.coffee.r0c1,
  "hydrate must keep cells whose lat/lng arrived as strings"
)
assert(
  typeof hydratedPoints.coffee.r0c0.lat === "number",
  "hydrated lat is a number"
)

console.log("ok lattice generate → DFS coordinate → persist/hydrate")
console.log("all grid lattice checks passed")
