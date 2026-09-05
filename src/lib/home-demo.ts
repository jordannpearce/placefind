import { buildGrid, spacingFromRadius } from "./grid"
import { computeStats } from "./stats"
import type { GridPoint, KeywordResults, KeywordStatRow } from "./types"

export const HOME_DEMO = {
  keywords: ["coffee", "espresso", "coffee shop"],
  activeKeyword: "coffee",
  targetBusiness: "Houndstooth Coffee",
  targetPlaceId: "ChIJMockHoundstooth001",
  city: "Austin",
  state: "TX",
  locationLabel: "Downtown Austin, TX",
  center: { lat: 30.2672, lng: -97.7431 },
  store: { lat: 30.2669, lng: -97.7434 },
  gridSize: 5 as const,
  radiusMiles: 1.4,
  zoom: 15,
}

export function homeDemoSpacing() {
  return spacingFromRadius(HOME_DEMO.radiusMiles, HOME_DEMO.gridSize)
}

export function homeDemoPoints(): GridPoint[] {
  return buildGrid(
    HOME_DEMO.center.lat,
    HOME_DEMO.center.lng,
    HOME_DEMO.gridSize,
    homeDemoSpacing()
  )
}

export function homeDemoKeywordStats(all: KeywordResults): KeywordStatRow[] {
  return HOME_DEMO.keywords.map((keyword) => ({
    keyword,
    stats: computeStats(Object.values(all[keyword] ?? {}), HOME_DEMO.targetBusiness),
  }))
}
