import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { searchDataForSeo } from "./dataforseo.ts"
import { mergeHostedKeys } from "./hosted-keys.ts"
import { rankOfBusiness } from "./rank.ts"
import { isSellerMode } from "./runtime.ts"
import type { ApiKeys } from "./types.ts"

export const MAX_KEYWORDS = 20
export const MAX_RECENT_SCANS = 10

const DATA_DIR = path.resolve(process.env.PLACEFIND_DATA_DIR || path.resolve(process.cwd(), ".data"))
const DATA_FILE = path.join(DATA_DIR, "campaigns.json")

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback
    return JSON.parse(readFileSync(file, "utf8")) as T
  } catch {
    return fallback
  }
}

function writeJson(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2))
}

export type CampaignInput = {
  name?: string
  businessName?: string
  city?: string
  state?: string
  keywords?: string[]
}

export type KeywordRank = {
  keyword: string
  rank: number | null
  listingTitle: string | null
  rating: number | null
  address: string | null
  mapsUrl: string | null
  scannedAt: string
  error?: string
}

export type ScanRun = {
  id: string
  scannedAt: string
  keywordCount: number
  foundCount: number
  results: KeywordRank[]
}

export type Campaign = {
  id: string
  name: string
  businessName: string
  city: string
  state: string
  keywords: string[]
  createdAt: string
  updatedAt: string
  lastScan: ScanRun | null
  recentScans: ScanRun[]
}

export class CampaignError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "CampaignError"
    this.status = status
  }
}

function newId(): string {
  return randomBytes(8).toString("hex")
}

export function normalizeKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const keyword = String(item ?? "").trim()
    if (!keyword) continue
    const key = keyword.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(keyword)
  }
  return out
}

export function validateCampaign(input: CampaignInput): { value?: Pick<Campaign, "name" | "businessName" | "city" | "state" | "keywords">; error?: string } {
  const name = input.name?.trim() ?? ""
  const businessName = input.businessName?.trim() ?? ""
  const city = input.city?.trim() ?? ""
  const state = input.state?.trim() ?? ""
  const keywords = normalizeKeywords(input.keywords)
  if (name.length < 2) return { error: "Enter a campaign name." }
  if (businessName.length < 2) return { error: "Enter the business name to track." }
  if (city.length < 2) return { error: "Enter the city." }
  if (!state) return { error: "Choose a state." }
  if (keywords.length > MAX_KEYWORDS) return { error: `A campaign can have at most ${MAX_KEYWORDS} keywords.` }
  return { value: { name, businessName, city, state, keywords } }
}

export function readCampaigns(): Campaign[] {
  const rows = readJson<Campaign[]>(DATA_FILE, [])
  if (!Array.isArray(rows)) return []
  return rows.map(normalizeStoredCampaign)
}

function writeCampaigns(campaigns: Campaign[]) {
  writeJson(DATA_FILE, campaigns)
}

function normalizeStoredCampaign(row: Campaign): Campaign {
  return {
    id: row.id || newId(),
    name: row.name ?? "",
    businessName: row.businessName ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    keywords: normalizeKeywords(row.keywords),
    createdAt: row.createdAt || new Date().toISOString(),
    updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
    lastScan: row.lastScan ?? null,
    recentScans: Array.isArray(row.recentScans) ? row.recentScans.slice(0, MAX_RECENT_SCANS) : [],
  }
}

export function getCampaign(id: string): Campaign | null {
  return readCampaigns().find((row) => row.id === id) ?? null
}

export function createCampaign(input: CampaignInput): Campaign {
  const parsed = validateCampaign(input)
  if (parsed.error || !parsed.value) throw new CampaignError(parsed.error || "Could not create the campaign.")
  const now = new Date().toISOString()
  const campaign: Campaign = {
    id: newId(),
    ...parsed.value,
    createdAt: now,
    updatedAt: now,
    lastScan: null,
    recentScans: [],
  }
  writeCampaigns([campaign, ...readCampaigns()])
  return campaign
}

export function updateCampaign(id: string, input: CampaignInput): Campaign {
  const campaigns = readCampaigns()
  const index = campaigns.findIndex((row) => row.id === id)
  if (index < 0) throw new CampaignError("That campaign was not found.", 404)
  const current = campaigns[index]!
  const parsed = validateCampaign({
    name: input.name !== undefined ? input.name : current.name,
    businessName: input.businessName !== undefined ? input.businessName : current.businessName,
    city: input.city !== undefined ? input.city : current.city,
    state: input.state !== undefined ? input.state : current.state,
    keywords: input.keywords !== undefined ? input.keywords : current.keywords,
  })
  if (parsed.error || !parsed.value) throw new CampaignError(parsed.error || "Could not update the campaign.")
  const next: Campaign = {
    ...current,
    ...parsed.value,
    updatedAt: new Date().toISOString(),
  }
  campaigns[index] = next
  writeCampaigns(campaigns)
  return next
}

export function deleteCampaign(id: string): boolean {
  const campaigns = readCampaigns()
  const next = campaigns.filter((row) => row.id !== id)
  if (next.length === campaigns.length) throw new CampaignError("That campaign was not found.", 404)
  writeCampaigns(next)
  return true
}

export function mergeKeywordRanks(keywords: string[], previous: KeywordRank[] | null | undefined, incoming: KeywordRank[]): KeywordRank[] {
  const byKeyword = new Map<string, KeywordRank>()
  for (const row of previous ?? []) {
    byKeyword.set(row.keyword.toLowerCase(), row)
  }
  for (const row of incoming) {
    byKeyword.set(row.keyword.toLowerCase(), row)
  }
  return keywords.map((keyword) => byKeyword.get(keyword.toLowerCase())).filter((row): row is KeywordRank => Boolean(row))
}

function hasDataForSeo(keys: ApiKeys): boolean {
  return Boolean(keys.dataforseoLogin?.trim() && keys.dataforseoPassword?.trim())
}

export function selectScanKeywords(campaign: Campaign, requested?: string[]): string[] {
  if (!requested?.length) return campaign.keywords
  const allowed = new Set(campaign.keywords.map((keyword) => keyword.toLowerCase()))
  return normalizeKeywords(requested).filter((keyword) => allowed.has(keyword.toLowerCase()))
}

export async function scanCampaign(id: string, rawKeys: ApiKeys, requestedKeywords?: string[]): Promise<{ campaign: Campaign; scan: ScanRun }> {
  const campaign = getCampaign(id)
  if (!campaign) throw new CampaignError("That campaign was not found.", 404)

  const keys = mergeHostedKeys(rawKeys)
  if (!hasDataForSeo(keys)) {
    throw new CampaignError(
      isSellerMode()
        ? "Add a DataForSEO login and API password in Settings, or seal them on Sell, before running a rank scan."
        : "Maps search is not ready yet, so a rank scan cannot run.",
    )
  }

  const keywords = selectScanKeywords(campaign, requestedKeywords)
  if (keywords.length === 0) {
    throw new CampaignError("Add at least one keyword before running a scan.")
  }

  const scannedAt = new Date().toISOString()
  const results: KeywordRank[] = []

  for (const keyword of keywords) {
    const live = await searchDataForSeo(
      { name: campaign.businessName, city: campaign.city, state: campaign.state },
      keys.dataforseoLogin!,
      keys.dataforseoPassword!,
      keyword,
    )
    if (live.error) {
      results.push({
        keyword,
        rank: null,
        listingTitle: null,
        rating: null,
        address: null,
        mapsUrl: null,
        scannedAt,
        error: live.error,
      })
      continue
    }

    const hit = rankOfBusiness(live.hits, campaign.businessName, campaign.city, campaign.state)
    results.push({
      keyword,
      rank: hit.rank,
      listingTitle: hit.listing?.title ?? null,
      rating: hit.listing?.rating ?? null,
      address: hit.listing?.address ?? null,
      mapsUrl: hit.listing?.mapsUrl ?? null,
      scannedAt,
    })
  }

  const scan: ScanRun = {
    id: newId(),
    scannedAt,
    keywordCount: results.length,
    foundCount: results.filter((row) => row.rank != null).length,
    results,
  }

  const merged = mergeKeywordRanks(campaign.keywords, campaign.lastScan?.results, results)
  const lastScan: ScanRun = {
    id: scan.id,
    scannedAt,
    keywordCount: merged.length,
    foundCount: merged.filter((row) => row.rank != null).length,
    results: merged,
  }

  const next: Campaign = {
    ...campaign,
    updatedAt: scannedAt,
    lastScan,
    recentScans: [scan, ...campaign.recentScans].slice(0, MAX_RECENT_SCANS),
  }

  const campaigns = readCampaigns().map((row) => (row.id === campaign.id ? next : row))
  writeCampaigns(campaigns)
  return { campaign: next, scan }
}
