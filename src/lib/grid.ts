import type { GridPoint, GridSize } from "./types"

export const GRID_SIZES: GridSize[] = [3, 5, 7, 9, 11, 13]

const MILES_PER_DEGREE_LAT = 69.0
const COORD_DECIMALS = 7
const COORD_STEP = 10 ** -COORD_DECIMALS
export const MIN_RADIUS_MILES = 0.5
export const MIN_SPACING_MILES = 0.05
const DEFAULT_CENTER = { lat: 30.2672, lng: -97.7431 }
const DEFAULT_RADIUS_MILES = 1.4

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
  return `${clampDecimals(lat, COORD_DECIMALS)},${clampDecimals(lng, COORD_DECIMALS)},${clampZoom(zoom)}z`
}

export function clampDecimals(value: number, digits: number): string {
  return String(quantizeCoord(value, digits))
}

/** Round GPS to DataForSEO’s 7-decimal budget without leftover binary float noise. */
export function quantizeCoord(value: number, digits = COORD_DECIMALS): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const factor = 10 ** digits
  return Number((Math.round(n * factor) / factor).toFixed(digits))
}

export function normalizeGridSize(size: unknown): GridSize {
  const n = Math.round(Number(size))
  if ((GRID_SIZES as number[]).includes(n)) return n as GridSize
  if (!Number.isFinite(n) || n < 3) return 5
  const odd = n % 2 === 0 ? n + 1 : n
  const clamped = Math.min(13, Math.max(3, odd))
  return ((GRID_SIZES as number[]).includes(clamped) ? clamped : 5) as GridSize
}

export function normalizeRadiusMiles(radius: unknown): number {
  const n = Number(radius)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RADIUS_MILES
  return Math.min(50, Math.max(MIN_RADIUS_MILES, n))
}

export function normalizeSpacingMiles(
  spacing: unknown,
  radius?: unknown,
  size?: unknown
): number {
  let miles = Number(spacing)
  if (!Number.isFinite(miles) || miles <= 0) {
    miles = spacingFromRadius(normalizeRadiusMiles(radius), normalizeGridSize(size))
  }
  return Math.min(20, Math.max(MIN_SPACING_MILES, miles))
}

export function normalizeCenter(lat: unknown, lng: unknown): { lat: number; lng: number } {
  const nextLat = Number(lat)
  const nextLng = Number(lng)
  if (
    !Number.isFinite(nextLat) ||
    !Number.isFinite(nextLng) ||
    nextLat < -90 ||
    nextLat > 90 ||
    nextLng < -180 ||
    nextLng > 180
  ) {
    return { ...DEFAULT_CENTER }
  }
  return { lat: nextLat, lng: nextLng }
}

/**
 * N×N lattice around the listing. Size, spacing, and center are sanitized so a
 * 0/NaN radius or integer-truncated grid cannot collapse onto the center pin.
 * Each cell is quantized to 7 decimals and kept unique for DataForSEO.
 */
export function buildGrid(
  centerLat: number,
  centerLng: number,
  size: GridSize,
  spacingMiles: number
): GridPoint[] {
  const n = normalizeGridSize(size)
  const center = normalizeCenter(centerLat, centerLng)
  const spacing = normalizeSpacingMiles(spacingMiles, undefined, n)
  const offset = (n - 1) / 2
  const dLat = milesToLatitudeDelta(spacing)
  const dLng = milesToLongitudeDelta(spacing, center.lat)
  const points: GridPoint[] = []
  const seen = new Set<string>()

  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      let lat = quantizeCoord(center.lat + (offset - row) * dLat)
      let lng = quantizeCoord(center.lng + (col - offset) * dLng)
      let key = `${lat},${lng}`
      while (seen.has(key)) {
        lng = quantizeCoord(lng + COORD_STEP)
        if (lng > 180) lng = quantizeCoord(180 - COORD_STEP)
        key = `${lat},${lng}`
      }
      seen.add(key)
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
  const size = normalizeGridSize(gridSize)
  const radius = normalizeRadiusMiles(radiusMiles)
  if (size <= 1) return radius
  return Number(((2 * radius) / (size - 1)).toFixed(3))
}

export function radiusFromSpacing(spacingMiles: number, gridSize: GridSize): number {
  const size = normalizeGridSize(gridSize)
  const spacing = normalizeSpacingMiles(spacingMiles, undefined, size)
  return Number((spacing * ((size - 1) / 2)).toFixed(2))
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
