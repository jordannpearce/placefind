import type { Listing } from "./types"

export type RankTone = {
  fill: string
  text: string
  label: string
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "")
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`
}

function mix(from: string, to: string, amount: number): string {
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  const t = Math.min(1, Math.max(0, amount))
  return rgbToHex([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ])
}

function contrastText(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luma > 0.65 ? "#1a1a1a" : "#ffffff"
}

export function rankFill(rank: number): string {
  if (!Number.isFinite(rank) || rank <= 0) return "#94a3b8"
  if (rank <= 3) {
    const greens = ["#166534", "#22c55e", "#86efac"]
    return greens[rank - 1] ?? "#86efac"
  }
  if (rank <= 10) {
    return mix("#facc15", "#ea580c", (rank - 4) / 6)
  }
  if (rank <= 14) {
    return mix("#ea580c", "#f97316", (rank - 10) / 4)
  }
  if (rank <= 20) {
    return mix("#ea580c", "#b91c1c", (rank - 15) / 5)
  }
  return "#7f1d1d"
}

export function rankTone(rank: number | null | undefined, error?: string | null): RankTone {
  if (error) {
    return { fill: "#64748b", text: "#ffffff", label: "Error" }
  }
  if (rank == null) {
    return { fill: "#94a3b8", text: "#0f172a", label: "Outside pack" }
  }
  const fill = rankFill(rank)
  if (rank <= 3) {
    return { fill, text: contrastText(fill), label: "Local pack" }
  }
  if (rank <= 10) {
    return { fill, text: contrastText(fill), label: rank <= 6 ? "Strong" : "Page one" }
  }
  if (rank <= 14) {
    return { fill, text: contrastText(fill), label: "Mid pack" }
  }
  return { fill, text: contrastText(fill), label: rank <= 20 ? "Weak" : "Buried" }
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function namesMatch(listingTitle: string, target: string): boolean {
  const listing = normalizeName(listingTitle)
  const query = normalizeName(target)
  if (!listing || !query) return false
  if (listing === query) return true
  if (listing.includes(query) || query.includes(listing)) return true

  const listingTokens = new Set(listing.split(" ").filter((t) => t.length > 2))
  const queryTokens = query.split(" ").filter((t) => t.length > 2)
  if (queryTokens.length === 0) return false
  const overlap = queryTokens.filter((token) => listingTokens.has(token)).length
  return overlap / queryTokens.length >= 0.7
}

export function idsEqual(left?: string | null, right?: string | null): boolean {
  const a = left?.trim()
  const b = right?.trim()
  return Boolean(a && b && a === b)
}

/** Null when either side is missing coords; otherwise whether they sit within `miles`. */
export function coordsNearby(
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null,
  miles = 0.35
): boolean | null {
  if (
    lat1 == null ||
    lng1 == null ||
    lat2 == null ||
    lng2 == null ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return null
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const r = 3958.8
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const distance = 2 * r * Math.asin(Math.min(1, Math.sqrt(a)))
  return distance <= miles
}

export function listingMatchesTarget(
  listing: Listing,
  target: {
    title: string
    placeId?: string | null
    cid?: string | null
    lat?: number | null
    lng?: number | null
  }
): boolean {
  if (listing.isPaid) return false
  if (idsEqual(listing.placeId, target.placeId)) return true

  const named = namesMatch(listing.title, target.title)
  if (named && idsEqual(listing.cid, target.cid)) return true
  if (!named) return false

  const nearby = coordsNearby(listing.latitude, listing.longitude, target.lat, target.lng)
  return nearby !== false
}

export function rankLabel(rank: number | null, error?: string | null): string {
  if (error) return "!"
  if (rank == null) return "—"
  return String(rank)
}

/** Always a visible glyph: loading, error, 1–20, outside-pack, or not-yet-scanned. */
export function pinMark(input: {
  rank?: number | null
  error?: string | null
  loading?: boolean
  scanned?: boolean
}): string {
  if (input.loading) return "…"
  if (input.error) return "!"
  if (input.rank != null && Number.isFinite(input.rank) && input.rank > 0) {
    return String(Math.round(input.rank))
  }
  if (input.scanned) return "—"
  return "·"
}

export function formatReviews(count: number | null | undefined): string {
  if (count == null) return "No review count"
  if (count === 0) return "0 reviews"
  return `${count.toLocaleString("en-US")} review${count === 1 ? "" : "s"}`
}
