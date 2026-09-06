export const MAX_GRID_SIZE = 7
export const MIN_GRID_SIZE = 1
export const DEFAULT_GRID_SIZE = 5
export const DEFAULT_SPACING_MILES = 1
export const DEFAULT_ZOOM = 17
export const MIN_ZOOM = 3
export const MAX_ZOOM = 21
export const MAX_COORD_DECIMALS = 7
export const MAX_TASKS_PER_POST = 100
export const METERS_PER_MILE = 1609.344

export type GridPoint = {
  id: string
  row: number
  col: number
  lat: number
  lng: number
  zoom: number
  locationCoordinate: string
}

export type GridSpec = {
  centerLat: number
  centerLng: number
  size: number
  spacingMiles: number
  zoom?: number
}

export function clampZoom(zoom?: number): number {
  const value = Number.isFinite(zoom) ? Math.round(Number(zoom)) : DEFAULT_ZOOM
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export function clampGridSize(size?: number): number {
  const value = Number.isFinite(size) ? Math.round(Number(size)) : DEFAULT_GRID_SIZE
  return Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, value))
}

export function clampSpacingMiles(miles?: number): number {
  const value = Number(miles)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SPACING_MILES
  return Math.min(25, Math.max(0.1, value))
}

export function formatCoordinatePart(value: number): string {
  if (!Number.isFinite(value)) throw new Error("Latitude and longitude must be finite numbers.")
  const fixed = value.toFixed(MAX_COORD_DECIMALS)
  const trimmed = fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
  const [whole, fraction = ""] = trimmed.split(".")
  if (fraction.length > MAX_COORD_DECIMALS) {
    return `${whole}.${fraction.slice(0, MAX_COORD_DECIMALS)}`
  }
  return trimmed === "-0" ? "0" : trimmed
}

/** DataForSEO Maps SERP `location_coordinate`: "latitude,longitude,zoom" (max 7 decimals, zoom 3z–21z). */
export function formatLocationCoordinate(lat: number, lng: number, zoom: number = DEFAULT_ZOOM): string {
  if (lat < -90 || lat > 90) throw new Error("Latitude must be between -90 and 90.")
  if (lng < -180 || lng > 180) throw new Error("Longitude must be between -180 and 180.")
  return `${formatCoordinatePart(lat)},${formatCoordinatePart(lng)},${clampZoom(zoom)}z`
}

export function parseLocationCoordinate(value: string): { lat: number; lng: number; zoom: number } | null {
  const match = String(value ?? "").trim().match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d{1,2})z?)?$/)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  const zoom = match[3] != null ? Number(match[3]) : DEFAULT_ZOOM
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng, zoom: clampZoom(zoom) }
}

export function buildGrid(spec: GridSpec): GridPoint[] {
  const size = clampGridSize(spec.size)
  const spacingMiles = clampSpacingMiles(spec.spacingMiles)
  const zoom = clampZoom(spec.zoom)
  const centerLat = Number(spec.centerLat)
  const centerLng = Number(spec.centerLng)
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
    throw new Error("Enter a map center latitude and longitude.")
  }

  const latStep = spacingMiles / 69
  const lngDenom = 69 * Math.max(0.2, Math.cos((centerLat * Math.PI) / 180))
  const lngStep = spacingMiles / lngDenom
  const offset = (size - 1) / 2
  const points: GridPoint[] = []

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const lat = centerLat + (offset - row) * latStep
      const lng = centerLng + (col - offset) * lngStep
      const locationCoordinate = formatLocationCoordinate(lat, lng, zoom)
      points.push({
        id: `${row}:${col}`,
        row,
        col,
        lat: Number(formatCoordinatePart(lat)),
        lng: Number(formatCoordinatePart(lng)),
        zoom,
        locationCoordinate,
      })
    }
  }
  return points
}

export function mapsGridTask(keyword: string, locationCoordinate: string, tag?: string) {
  return {
    language_code: "en" as const,
    location_coordinate: locationCoordinate,
    keyword,
    depth: 20,
    search_places: false,
    search_this_area: true,
    ...(tag ? { tag } : {}),
  }
}

export function chunkTasks<T>(tasks: T[], size = MAX_TASKS_PER_POST): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < tasks.length; index += size) {
    chunks.push(tasks.slice(index, index + size))
  }
  return chunks
}

export function gridTaskCount(size?: number): number {
  const edge = clampGridSize(size)
  return edge * edge
}

export function rankColor(rank: number | null | undefined): string {
  if (rank == null) return "#6b6356"
  if (rank <= 3) return "#7dae86"
  if (rank <= 7) return "#e0b15b"
  if (rank <= 14) return "#c98a4a"
  return "#d07252"
}
