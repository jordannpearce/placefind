import type { GridPoint, GridSize } from "./types"

const MILES_PER_DEGREE_LAT = 69.0

export function milesToLatitudeDelta(miles: number): number {
  return miles / MILES_PER_DEGREE_LAT
}

export function milesToLongitudeDelta(miles: number, latitude: number): number {
  const milesPerDegreeLng = MILES_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180)
  return miles / Math.max(milesPerDegreeLng, 0.01)
}

export function formatCoordinate(lat: number, lng: number, zoom: number): string {
  return `${clampDecimals(lat, 7)},${clampDecimals(lng, 7)},${zoom}z`
}

export function clampDecimals(value: number, digits: number): string {
  const factor = 10 ** digits
  const rounded = Math.round(value * factor) / factor
  return String(rounded)
}

export function buildGrid(
  centerLat: number,
  centerLng: number,
  size: GridSize,
  spacingMiles: number
): GridPoint[] {
  const offset = (size - 1) / 2
  const dLat = milesToLatitudeDelta(spacingMiles)
  const dLng = milesToLongitudeDelta(spacingMiles, centerLat)
  const points: GridPoint[] = []

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const lat = centerLat + (offset - row) * dLat
      const lng = centerLng + (col - offset) * dLng
      points.push({
        id: `r${row}c${col}`,
        row,
        col,
        lat,
        lng,
      })
    }
  }

  return points
}

export function cellBounds(
  lat: number,
  lng: number,
  spacingMiles: number
): [[number, number], [number, number]] {
  const halfLat = milesToLatitudeDelta(spacingMiles) / 2
  const halfLng = milesToLongitudeDelta(spacingMiles, lat) / 2
  const pad = 0.04
  return [
    [lat - halfLat * (1 - pad), lng - halfLng * (1 - pad)],
    [lat + halfLat * (1 - pad), lng + halfLng * (1 - pad)],
  ]
}

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const r = 3958.8
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function suggestedZoom(spacingMiles: number): number {
  if (spacingMiles <= 0.4) return 17
  if (spacingMiles <= 0.75) return 16
  if (spacingMiles <= 1.25) return 15
  if (spacingMiles <= 2) return 14
  if (spacingMiles <= 3) return 13
  return 12
}

export function estimateScanCostUsd(pointCount: number): number {
  return Number((pointCount * 0.002).toFixed(3))
}
