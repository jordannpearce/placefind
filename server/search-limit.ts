import { createHash } from "node:crypto"
import { sampleSearchUsedMessage } from "./public-copy.ts"
import { readCollection, writeCollection } from "./store.ts"
import type { SearchQuery, SearchResponse } from "./types.ts"

export const VISITOR_SEARCH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export type SearchIpRow = {
  hash: string
  firstAt: string
  lastAt: string
  count: number
}

export class VisitorSearchUsedError extends Error {
  constructor() {
    super(sampleSearchUsedMessage())
    this.name = "VisitorSearchUsedError"
  }
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

export async function runWebsiteSearch(input: {
  query: SearchQuery
  search: (query: SearchQuery) => Promise<SearchResponse>
  signedIn: boolean
  ip: string
  now?: number
}): Promise<SearchResponse> {
  if (input.signedIn) return input.search(input.query)
  const gate = visitorSearchAllowed(input.ip, input.now)
  if (!gate.allowed) throw new VisitorSearchUsedError()
  const result = await input.search(input.query)
  recordVisitorSearch(gate.hash, input.now)
  return result
}
