import type { GeoPoint, GridPoint, GridPointResult } from "./types.ts"

export const DEFAULT_GRID_SIZE = 5
export const DEFAULT_SPACING_MILES = 1
export const DEFAULT_ZOOM = 17
export const ALLOWED_GRID_SIZES = [3, 5, 7] as const

export function normalizeGridSize(raw: unknown): number {
  const size = Number(raw)
  if ((ALLOWED_GRID_SIZES as readonly number[]).includes(size)) return size
  return DEFAULT_GRID_SIZE
}

export function normalizeSpacingMiles(raw: unknown): number {
  const miles = Number(raw)
  if (!Number.isFinite(miles) || miles < 0.25 || miles > 10) return DEFAULT_SPACING_MILES
  return miles
}

export function buildGridPoints(
  center: GeoPoint,
  gridSize: number,
  spacingMiles: number,
  zoom = DEFAULT_ZOOM,
): GridPoint[] {
  const size = normalizeGridSize(gridSize)
  const spacing = normalizeSpacingMiles(spacingMiles)
  const z = Number.isFinite(zoom) ? Math.min(21, Math.max(3, Math.round(zoom))) : DEFAULT_ZOOM
  const half = (size - 1) / 2
  const latDegPerMile = 1 / 69
  const cosLat = Math.cos((center.lat * Math.PI) / 180)
  const lngDegPerMile = 1 / (69 * (Math.abs(cosLat) < 0.01 ? 0.01 : cosLat))
  const points: GridPoint[] = []
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const northMiles = (half - row) * spacing
      const eastMiles = (col - half) * spacing
      const lat = center.lat + northMiles * latDegPerMile
      const lng = center.lng + eastMiles * lngDegPerMile
      const latPart = lat.toFixed(7).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
      const lngPart = lng.toFixed(7).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
      points.push({
        row,
        col,
        lat,
        lng,
        locationCoordinate: `${latPart === "-0" ? "0" : latPart},${lngPart === "-0" ? "0" : lngPart},${z}z`,
      })
    }
  }
  return points
}

export function buildPreviewPoints(
  center: GeoPoint,
  gridSize: number,
  spacingMiles: number,
  keyword = "",
): GridPointResult[] {
  return buildGridPoints(center, gridSize, spacingMiles).map((point) => ({
    ...point,
    keyword,
    rank: null,
    listingTitle: null,
    rating: null,
    address: null,
    mapsUrl: null,
    scannedAt: "",
    status: "unset",
  }))
}

export function pointScanned(
  point: Pick<GridPointResult, "scannedAt" | "rank" | "error" | "status">,
): boolean {
  if (point.status === "rank" || point.status === "not_found" || point.status === "error") return true
  if (point.status === "pending" || point.status === "unset") return false
  return Boolean(point.scannedAt) || point.rank != null || Boolean(point.error)
}

export function rankTone(rank: number | null | undefined): "green" | "yellow" | "orange" | "orange-red" | "red" {
  if (rank == null || !Number.isFinite(rank) || rank < 1 || rank >= 16) return "red"
  if (rank <= 3) return "green"
  if (rank <= 6) return "yellow"
  if (rank <= 10) return "orange"
  return "orange-red"
}

export function rankColor(rank: number | null | undefined): string {
  if (rank == null || !Number.isFinite(rank) || rank < 1) return "#c5362b"
  if (rank === 1) return "#2f6b3d"
  if (rank === 2) return "#4d8f5a"
  if (rank === 3) return "#7dae86"
  if (rank <= 6) return "#e6c24a"
  if (rank <= 10) return "#e08a3c"
  if (rank <= 15) return "#d45c38"
  return "#c5362b"
}

export function pinColor(point: Pick<GridPointResult, "rank" | "scannedAt" | "error" | "status">): string {
  if (!pointScanned(point)) return "#b4a793"
  return rankColor(point.rank)
}

export function rankLabel(
  rank: number | null | undefined,
  error?: string,
  scannedAt?: string,
  status?: GridPointResult["status"],
): string {
  if (status === "error" || (error && rank == null && status !== "not_found")) return "Error"
  if (status === "not_found") return "Not found"
  if (status === "rank" && rank != null) return `#${rank}`
  if (error && rank == null) return "Error"
  if (rank == null && !scannedAt) return "Not scanned"
  if (rank == null) return "Not found"
  return `#${rank}`
}
