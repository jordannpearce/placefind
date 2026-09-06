import { createHash } from "node:crypto"
import { searchMockBusinesses } from "./mock.ts"
import { readCollection, writeCollection } from "./store.ts"
import type { SearchQuery, SearchResponse } from "./types.ts"

export const VISITOR_SEARCH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export const EXAMPLE_QUERY: SearchQuery = {
  name: "Franklin Barbecue",
  city: "Austin",
  state: "TX",
  keyword: "barbecue",
}

export type SearchIpRow = {
  hash: string
  firstAt: string
  lastAt: string
  count: number
}

export function hashSearchIp(ip: string): string {
  return createHash("sha256").update(`placefind-visitor:${ip.trim()}`).digest("hex")
}

export function requestIp(req: {
  headers: { [key: string]: string | string[] | undefined }
  socket?: { remoteAddress?: string }
  ip?: string
}): string {
  const forwarded = req.headers["x-forwarded-for"]
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]
  const raw = first?.trim() || req.socket?.remoteAddress || req.ip || ""
  return raw.replace(/^::ffff:/, "") || "unknown"
}

export function visitorSearchAllowed(ip: string, now = Date.now()): { allowed: boolean; hash: string } {
  const hash = hashSearchIp(ip)
  const rows = readCollection<SearchIpRow>("search_ip")
  const row = rows.find((item) => item.hash === hash)
  if (!row) return { allowed: true, hash }
  const last = Date.parse(row.lastAt)
  if (!Number.isFinite(last) || now - last >= VISITOR_SEARCH_WINDOW_MS) return { allowed: true, hash }
  return { allowed: false, hash }
}

export function recordVisitorSearch(hash: string, now = Date.now()) {
  const at = new Date(now).toISOString()
  const rows = readCollection<SearchIpRow>("search_ip")
  const existing = rows.find((item) => item.hash === hash)
  if (existing) {
    existing.lastAt = at
    existing.count += 1
  } else {
    rows.push({ hash, firstAt: at, lastAt: at, count: 1 })
  }
  writeCollection("search_ip", rows)
}

export function exampleSearchResponse(query: SearchQuery): SearchResponse {
  const hits = searchMockBusinesses(EXAMPLE_QUERY)
  return {
    query,
    best: hits[0] ?? null,
    others: [],
    mode: "sample",
    sources: { dataforseo: false, scrappey: false },
    warning: "Here's an example of how PlaceFind presents a Google Maps listing.",
    elapsedMs: 1,
  }
}

export function exampleHasLimitCopy(text: string): boolean {
  return /you('ve| have) used|ip limit|logged your ip|tracking your|fingerprint|already in use|rate limit/i.test(text)
}

export async function runWebsiteSearch(input: {
  query: SearchQuery
  search: (query: SearchQuery) => Promise<SearchResponse>
  signedIn: boolean
  ip: string
  now?: number
}): Promise<SearchResponse> {
  if (input.signedIn) return input.search(input.query)
  const gate = visitorSearchAllowed(input.ip, input.now)
  if (!gate.allowed) return exampleSearchResponse(input.query)
  const result = await input.search(input.query)
  recordVisitorSearch(gate.hash, input.now)
  return result
}
