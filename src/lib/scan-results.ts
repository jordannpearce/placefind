import { formatCoordinate } from "./grid"
import type {
  GridSize,
  KeywordResults,
  PointResult,
  ScanMode,
  ScanPointResponse,
  ScanRun,
  WorkspaceScans,
} from "./types"
import { MAX_SCAN_HISTORY } from "./types"

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

export function latestKeywordResults(runs: ScanRun[] | KeywordResults | undefined): KeywordResults {
  if (!runs) return {}
  if (Array.isArray(runs)) return runs[0]?.results ?? {}
  return toKeywordResults(runs)
}

export function createScanRunId() {
  return `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createScanRun(input: {
  results: KeywordResults
  gridSize: number
  radiusMiles: number
  center: { lat: number; lng: number }
  keywords: string[]
  mode?: ScanMode
  createdAt?: string
  id?: string
}): ScanRun {
  const size = ([3, 5, 7, 9, 11, 13].includes(input.gridSize) ? input.gridSize : 5) as GridSize
  return {
    id: input.id || createScanRunId(),
    createdAt: input.createdAt || new Date().toISOString(),
    gridSize: size,
    radiusMiles: Number.isFinite(input.radiusMiles) ? input.radiusMiles : 1.4,
    center: {
      lat: Number(input.center.lat) || 0,
      lng: Number(input.center.lng) || 0,
    },
    keywords: input.keywords.filter(Boolean),
    mode: input.mode === "live" ? "live" : "mock",
    results: toKeywordResults(input.results),
  }
}

function isScanRun(value: unknown): value is ScanRun {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return typeof row.results === "object" && row.results !== null && !Array.isArray(row.results)
}

function toScanRuns(value: unknown): ScanRun[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((row) => (isScanRun(row) ? createScanRun({
        id: row.id,
        createdAt: row.createdAt,
        results: row.results,
        gridSize: Number(row.gridSize) || 5,
        radiusMiles: Number(row.radiusMiles) || 1.4,
        center: row.center ?? { lat: 0, lng: 0 },
        keywords: Array.isArray(row.keywords) ? row.keywords.map(String) : Object.keys(row.results ?? {}),
        mode: row.mode,
      }) : null))
      .filter((row): row is ScanRun => Boolean(row && keywordResultsHavePoints(row.results)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_SCAN_HISTORY)
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    if (Array.isArray(obj.history)) return toScanRuns(obj.history)
    const results = toKeywordResults(obj)
    if (!keywordResultsHavePoints(results)) return []
    return [
      createScanRun({
        results,
        gridSize: 5,
        radiusMiles: 1.4,
        center: { lat: 0, lng: 0 },
        keywords: Object.keys(results),
      }),
    ]
  }
  return []
}

export function sortScanRuns(runs: ScanRun[]): ScanRun[] {
  return [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_SCAN_HISTORY)
}

export function mergeScanRuns(current: ScanRun[], incoming: ScanRun[]): ScanRun[] {
  const byId = new Map<string, ScanRun>()
  for (const run of [...current, ...incoming]) {
    if (run?.id && keywordResultsHavePoints(run.results)) byId.set(run.id, run)
  }
  return sortScanRuns([...byId.values()])
}

/**
 * Workspace scans are `{ [campaignId]: ScanRun[] }`.
 * Older clients stored `{ [campaignId]: KeywordResults }` or a bare keyword map.
 */
export function normalizeWorkspaceScans(
  raw: unknown,
  campaignIds: string[] = []
): WorkspaceScans {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const obj = raw as Record<string, unknown>
  const keys = Object.keys(obj)
  if (keys.length === 0) return {}

  const campaignSet = new Set(campaignIds.filter(Boolean))
  const campaignKeyed = keys.some((key) => campaignSet.has(key) || /^camp_/i.test(key))
  if (campaignKeyed) {
    const out: WorkspaceScans = {}
    for (const [id, value] of Object.entries(obj)) {
      out[id] = toScanRuns(value)
    }
    return out
  }

  const runs = toScanRuns(obj)
  const attachTo = campaignIds[0]
  return attachTo && runs.length > 0 ? { [attachTo]: runs } : {}
}

export function mergeWorkspaceScans(
  current: WorkspaceScans,
  incoming: WorkspaceScans
): WorkspaceScans {
  const next = { ...current }
  for (const [id, runs] of Object.entries(incoming)) {
    if (runs.length > 0) next[id] = mergeScanRuns(current[id] ?? [], runs)
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
