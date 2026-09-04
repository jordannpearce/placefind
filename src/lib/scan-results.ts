import { formatCoordinate } from "./grid"
import type { KeywordResults, PointResult, ScanMode, ScanPointResponse } from "./types"

export function isPointResult(value: unknown): value is PointResult {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  const id = String(row.id ?? "").trim()
  const lat = Number(row.lat)
  const lng = Number(row.lng)
  return id.length > 0 && Number.isFinite(lat) && Number.isFinite(lng)
}

function asPointResult(row: PointResult, fallbackId: string): PointResult {
  return {
    ...row,
    id: String(row.id || fallbackId),
    lat: Number(row.lat),
    lng: Number(row.lng),
  }
}

function toPointMap(value: unknown): Record<string, PointResult> {
  if (!value) return {}
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value.filter(isPointResult).map((row) => {
        const next = asPointResult(row, row.id)
        return [next.id, next]
      })
    )
  }
  if (typeof value !== "object") return {}
  const out: Record<string, PointResult> = {}
  for (const [key, row] of Object.entries(value)) {
    if (isPointResult(row)) {
      const next = asPointResult(row, key)
      out[next.id] = next
    }
  }
  return out
}

export function toKeywordResults(value: unknown): KeywordResults {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: KeywordResults = {}
  for (const [keyword, points] of Object.entries(value)) {
    out[keyword] = toPointMap(points)
  }
  return out
}

export function keywordResultsHavePoints(scans: KeywordResults): boolean {
  return Object.values(scans).some((points) => Object.keys(points).length > 0)
}

/**
 * Server workspaces store `{ [campaignId]: KeywordResults }`.
 * Older clients PUT a bare KeywordResults map (`{ coffee: { r0c0: ... } }`).
 * Reading the wrong shape makes `scans["coffee"]` undefined — a blank grid.
 */
export function normalizeWorkspaceScans(
  raw: unknown,
  campaignIds: string[] = []
): Record<string, KeywordResults> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const obj = raw as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.length === 0) return {}

  const campaignSet = new Set(campaignIds.filter(Boolean))
  const campaignKeyed = keys.some((key) => campaignSet.has(key) || /^camp_/i.test(key))
  if (campaignKeyed) {
    const out: Record<string, KeywordResults> = {}
    for (const [id, value] of Object.entries(obj)) {
      out[id] = toKeywordResults(value)
    }
    return out
  }

  const bare = toKeywordResults(obj)
  const attachTo = campaignIds[0]
  return attachTo && keywordResultsHavePoints(bare) ? { [attachTo]: bare } : {}
}

export function mergeWorkspaceScans(
  current: Record<string, KeywordResults>,
  incoming: Record<string, KeywordResults>
): Record<string, KeywordResults> {
  const next = { ...current }
  for (const [id, scans] of Object.entries(incoming)) {
    if (keywordResultsHavePoints(scans)) next[id] = scans
  }
  return next
}

export function placeholderPoint(input: {
  id: string
  lat: number
  lng: number
  zoom: number
  error?: string | null
  mode?: ScanMode
}): ScanPointResponse {
  return {
    id: input.id,
    lat: input.lat,
    lng: input.lng,
    locationCoordinate: formatCoordinate(input.lat, input.lng, input.zoom),
    rank: null,
    found: false,
    listings: [],
    error: input.error ?? null,
    mode: input.mode ?? "mock",
  }
}
