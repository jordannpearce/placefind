import type { GridPoint, GridSize } from "./types"

export const GRID_SIZES: GridSize[] = [3, 5, 7, 9, 11, 13]

const MILES_PER_DEGREE_LAT = 69.0

export function milesToLatitudeDelta(miles: number): number {
  return miles / MILES_PER_DEGREE_LAT
}

export function milesToLongitudeDelta(miles: number, latitude: number): number {
  const milesPerDegreeLng = MILES_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180)
  return miles / Math.max(milesPerDegreeLng, 0.01)
}

export function clampZoom(zoom: number): number {
  const rounded = Math.round(Number(zoom))
  if (!Number.isFinite(rounded)) return 15
  return Math.min(21, Math.max(3, rounded))
}

/** DataForSEO Maps: latitude,longitude,zoom with a `z` suffix. Max 7 decimals, zoom 3–21. */
export function formatCoordinate(lat: number, lng: number, zoom: number): string {
  return `${clampDecimals(lat, 7)},${clampDecimals(lng, 7)},${clampZoom(zoom)}z`
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

export function spacingFromRadius(radiusMiles: number, gridSize: GridSize): number {
  if (gridSize <= 1) return radiusMiles
  return Number(((2 * radiusMiles) / (gridSize - 1)).toFixed(3))
}

export function radiusFromSpacing(spacingMiles: number, gridSize: GridSize): number {
  return Number((spacingMiles * ((gridSize - 1) / 2)).toFixed(2))
}

export function suggestedZoom(spacingMiles: number): number {
  if (spacingMiles <= 0.4) return 17
  if (spacingMiles <= 0.75) return 16
  if (spacingMiles <= 1.25) return 15
  if (spacingMiles <= 2) return 14
  if (spacingMiles <= 3) return 13
  return 12
}

export function googleMapsUrl(input: {
  title: string
  address?: string | null
  lat?: number | null
  lng?: number | null
  placeId?: string | null
}): string {
  if (input.placeId && !input.placeId.startsWith("ChIJMock")) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(input.title)}&query_place_id=${input.placeId}`
  }
  if (input.lat != null && input.lng != null) {
    return `https://www.google.com/maps/search/${encodeURIComponent(input.title)}/@${input.lat},${input.lng},16z`
  }
  const query = [input.title, input.address].filter(Boolean).join(", ")
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function estimateScanCostUsd(pointCount: number): number {
  return Number((pointCount * 0.002).toFixed(3))
}
