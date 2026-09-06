export const DEFAULT_TRAFFIC_SEARCHES = 3
export const MIN_TRAFFIC_SEARCHES = 1
export const MAX_TRAFFIC_SEARCHES = 50

/** Total Maps search sessions to run. Default 3, min 1, max 50. */
export function normalizeTrafficSearches(raw: unknown): number {
  if (raw == null || raw === "") return DEFAULT_TRAFFIC_SEARCHES
  const value = Number(raw)
  if (!Number.isInteger(value) || value < MIN_TRAFFIC_SEARCHES) return DEFAULT_TRAFFIC_SEARCHES
  return Math.min(MAX_TRAFFIC_SEARCHES, value)
}

/** First N pin×keyword pairs in listed order. Extra pairs are not run. */
export function planTrafficPairs<T>(pairs: T[], searches?: unknown): T[] {
  return pairs.slice(0, normalizeTrafficSearches(searches))
}

export function plannedTrafficSearchCount(pairCount: number, searches?: unknown): number {
  const available = Number.isFinite(pairCount) ? Math.max(0, Math.floor(pairCount)) : 0
  return Math.min(available, normalizeTrafficSearches(searches))
}

export function trafficSearchHelpCopy() {
  return "Total Maps searches this run. Uses selected pins × selected keywords in listed order, then stops."
}
