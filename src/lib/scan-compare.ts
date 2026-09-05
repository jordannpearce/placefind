import { computeStats } from "./stats"
import type { KeywordResults, PointResult, ScanRun, ScanStats } from "./types"

export type PointDelta = {
  id: string
  previousRank: number | null
  currentRank: number | null
  /** Negative means the listing ranked better (closer to #1). */
  delta: number | null
  appeared: boolean
  disappeared: boolean
}

export type ScanComparison = {
  previous: ScanRun
  current: ScanRun
  keyword: string
  previousStats: ScanStats | null
  currentStats: ScanStats | null
  atrDelta: number | null
  coverageDelta: number | null
  packDelta: number | null
  points: PointDelta[]
  improved: number
  declined: number
  unchanged: number
}

function rankValue(point: PointResult | undefined): number | null {
  if (!point || point.error) return null
  if (point.found && point.rank != null) return point.rank
  if (point && !point.found) return 21
  return null
}

export function compareScanRuns(
  previous: ScanRun,
  current: ScanRun,
  keyword: string,
  targetBusiness: string
): ScanComparison {
  const prevPoints = previous.results[keyword] ?? {}
  const currPoints = current.results[keyword] ?? {}
  const ids = new Set([...Object.keys(prevPoints), ...Object.keys(currPoints)])
  const points: PointDelta[] = []
  let improved = 0
  let declined = 0
  let unchanged = 0

  for (const id of ids) {
    const previousRank = rankValue(prevPoints[id])
    const currentRank = rankValue(currPoints[id])
    const appeared = previousRank == null && currentRank != null
    const disappeared = previousRank != null && currentRank == null
    const delta =
      previousRank != null && currentRank != null ? currentRank - previousRank : null
    if (delta != null && delta < 0) improved += 1
    else if (delta != null && delta > 0) declined += 1
    else if (delta === 0) unchanged += 1
    points.push({ id, previousRank, currentRank, delta, appeared, disappeared })
  }

  points.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))

  const previousRows = Object.values(prevPoints)
  const currentRows = Object.values(currPoints)
  const previousStats = previousRows.length ? computeStats(previousRows, targetBusiness) : null
  const currentStats = currentRows.length ? computeStats(currentRows, targetBusiness) : null

  return {
    previous,
    current,
    keyword,
    previousStats,
    currentStats,
    atrDelta:
      previousStats?.atr != null && currentStats?.atr != null
        ? Number((currentStats.atr - previousStats.atr).toFixed(1))
        : null,
    coverageDelta:
      previousStats && currentStats ? currentStats.coverage - previousStats.coverage : null,
    packDelta:
      previousStats && currentStats ? currentStats.top3Share - previousStats.top3Share : null,
    points,
    improved,
    declined,
    unchanged,
  }
}

export function formatRankDelta(delta: number | null): string {
  if (delta == null) return "—"
  if (delta === 0) return "0"
  return delta < 0 ? `+${Math.abs(delta)}` : `−${delta}`
}

export function pickCompareKeyword(current: ScanRun, previous: ScanRun, preferred?: string): string {
  if (preferred && (current.results[preferred] || previous.results[preferred])) return preferred
  return current.keywords[0] || previous.keywords[0] || Object.keys(current.results)[0] || ""
}

export function runHasKeyword(run: ScanRun, keyword: string): boolean {
  return Boolean(run.results[keyword] && Object.keys(run.results[keyword]).length > 0)
}

export function keywordMapFromHistory(
  runs: ScanRun[],
  scanId: string | null,
  draft: KeywordResults | null
): KeywordResults {
  if (draft && keywordResultsFromDraft(draft)) return draft
  const run = runs.find((item) => item.id === scanId) ?? runs[0]
  return run?.results ?? {}
}

function keywordResultsFromDraft(draft: KeywordResults): boolean {
  return Object.keys(draft).length > 0
}
