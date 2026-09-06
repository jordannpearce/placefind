export const MAX_KEYWORDS = 20

const KEYWORD_SPLIT = /[,;\n\r]+/

export function keywordCapMessage(max = MAX_KEYWORDS) {
  return `A campaign can have at most ${max} keywords.`
}

export function keywordHelpCopy(max = MAX_KEYWORDS) {
  return `Type keywords separated by commas, new lines, or semicolons. Up to ${max} unique keywords. Scans run each one.`
}

export function trafficKeywordTypeHelpCopy() {
  return "Type extra keywords the same way, or pick from the list. Traffic searches the selected set in listed order from each selected pin."
}

export function formatKeywordText(keywords: string[]): string {
  return keywords.join(", ")
}

export function scanKeywordsLabel(input: { keywords?: string[] | null; keyword?: string | null } | null | undefined): string {
  const keywords = normalizeKeywords(input?.keywords ?? input?.keyword)
  return keywords.join(", ")
}

/** Split typed keyword text. Trims blanks and keeps the first spelling of case-insensitive duplicates. */
export function parseKeywordText(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of String(raw ?? "").split(KEYWORD_SPLIT)) {
    const keyword = part.trim()
    if (!keyword) continue
    const key = keyword.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(keyword)
  }
  return out
}

/**
 * Normalize stored or typed keywords.
 * Accepts a string, string[], or a legacy `{ keyword }` / `{ keywords }` object.
 */
export function normalizeKeywords(raw: unknown): string[] {
  if (raw == null || raw === "") return []
  if (typeof raw === "string") return parseKeywordText(raw)
  if (Array.isArray(raw)) {
    const seen = new Set<string>()
    const out: string[] = []
    for (const item of raw) {
      for (const keyword of parseKeywordText(String(item ?? ""))) {
        const key = keyword.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(keyword)
      }
    }
    return out
  }
  if (typeof raw === "object") {
    const row = raw as { keywords?: unknown; keyword?: unknown }
    const fromList = normalizeKeywords(row.keywords)
    if (fromList.length > 0) return fromList
    return normalizeKeywords(row.keyword)
  }
  return []
}

export function parseKeywordsOrError(raw: unknown, max = MAX_KEYWORDS): { keywords: string[]; error?: string } {
  const keywords = normalizeKeywords(raw)
  if (keywords.length > max) return { keywords, error: keywordCapMessage(max) }
  return { keywords }
}

export function mergeKeywordLists(...lists: Array<unknown>): string[] {
  return normalizeKeywords(lists.flatMap((list) => normalizeKeywords(list)))
}
