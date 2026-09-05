import { homeDemoPoints, HOME_DEMO } from "./home-demo"
import { mockScanPoint } from "./mock-scan"
import type { GridPoint, KeywordResults, PointResult } from "./types"

export function homeDemoResultsForKeyword(keyword: string, points: GridPoint[]): Record<string, PointResult> {
  const results: Record<string, PointResult> = {}
  for (const point of points) {
    results[point.id] = mockScanPoint({
      pointId: point.id,
      keyword,
      targetBusiness: HOME_DEMO.targetBusiness,
      targetPlaceId: HOME_DEMO.targetPlaceId,
      targetLat: HOME_DEMO.store.lat,
      targetLng: HOME_DEMO.store.lng,
      lat: point.lat,
      lng: point.lng,
      zoom: HOME_DEMO.zoom,
    })
  }
  return results
}

export function buildHomeDemoScan() {
  const points = homeDemoPoints()
  const results: KeywordResults = {}
  for (const keyword of HOME_DEMO.keywords) {
    results[keyword] = homeDemoResultsForKeyword(keyword, points)
  }
  return { points, results }
}
