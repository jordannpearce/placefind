import { spacingFromRadius } from "./grid"
import { normalizeWorkspaceScans, toKeywordResults } from "./scan-results"
import type {
  ApiSettings,
  Campaign,
  KeywordResults,
  PointResult,
  ScanConfig,
  ScheduleCadence,
} from "./types"

const SETTINGS_KEY = "gridpin.settings"
const CAMPAIGNS_KEY = "gridpin.campaigns"
const ACTIVE_KEY = "gridpin.activeCampaignId"
const SCANS_KEY = "gridpin.scans"

export const MAX_KEYWORDS = 8

export const US_STATES: Array<{ name: string; abbr: string }> = [
  { name: "Alabama", abbr: "AL" },
  { name: "Alaska", abbr: "AK" },
  { name: "Arizona", abbr: "AZ" },
  { name: "Arkansas", abbr: "AR" },
  { name: "California", abbr: "CA" },
  { name: "Colorado", abbr: "CO" },
  { name: "Connecticut", abbr: "CT" },
  { name: "Delaware", abbr: "DE" },
  { name: "District of Columbia", abbr: "DC" },
  { name: "Florida", abbr: "FL" },
  { name: "Georgia", abbr: "GA" },
  { name: "Hawaii", abbr: "HI" },
  { name: "Idaho", abbr: "ID" },
  { name: "Illinois", abbr: "IL" },
  { name: "Indiana", abbr: "IN" },
  { name: "Iowa", abbr: "IA" },
  { name: "Kansas", abbr: "KS" },
  { name: "Kentucky", abbr: "KY" },
  { name: "Louisiana", abbr: "LA" },
  { name: "Maine", abbr: "ME" },
  { name: "Maryland", abbr: "MD" },
  { name: "Massachusetts", abbr: "MA" },
  { name: "Michigan", abbr: "MI" },
  { name: "Minnesota", abbr: "MN" },
  { name: "Mississippi", abbr: "MS" },
  { name: "Missouri", abbr: "MO" },
  { name: "Montana", abbr: "MT" },
  { name: "Nebraska", abbr: "NE" },
  { name: "Nevada", abbr: "NV" },
  { name: "New Hampshire", abbr: "NH" },
  { name: "New Jersey", abbr: "NJ" },
  { name: "New Mexico", abbr: "NM" },
  { name: "New York", abbr: "NY" },
  { name: "North Carolina", abbr: "NC" },
  { name: "North Dakota", abbr: "ND" },
  { name: "Ohio", abbr: "OH" },
  { name: "Oklahoma", abbr: "OK" },
  { name: "Oregon", abbr: "OR" },
  { name: "Pennsylvania", abbr: "PA" },
  { name: "Rhode Island", abbr: "RI" },
  { name: "South Carolina", abbr: "SC" },
  { name: "South Dakota", abbr: "SD" },
  { name: "Tennessee", abbr: "TN" },
  { name: "Texas", abbr: "TX" },
  { name: "Utah", abbr: "UT" },
  { name: "Vermont", abbr: "VT" },
  { name: "Virginia", abbr: "VA" },
  { name: "Washington", abbr: "WA" },
  { name: "West Virginia", abbr: "WV" },
  { name: "Wisconsin", abbr: "WI" },
  { name: "Wyoming", abbr: "WY" },
]

export function normalizeKeywords(raw: unknown, fallback: string | null = "coffee"): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string" && raw.trim()
      ? [raw]
      : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    if (typeof item !== "string") continue
    const value = item.trim().replace(/\s+/g, " ")
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length >= MAX_KEYWORDS) break
  }
  if (out.length > 0) return out
  return fallback ? [fallback] : []
}

export function pickActiveKeyword(keywords: string[], preferred?: string | null): string {
  if (preferred) {
    const match = keywords.find((keyword) => keyword.toLowerCase() === preferred.trim().toLowerCase())
    if (match) return match
  }
  return keywords[0] ?? ""
}

export function uniqueCampaignName(base: string, campaigns: Campaign[]): string {
  const trimmed = base.trim() || "New campaign"
  if (!campaigns.some((campaign) => campaign.name === trimmed)) return trimmed
  let n = 2
  while (campaigns.some((campaign) => campaign.name === `${trimmed} ${n}`)) n += 1
  return `${trimmed} ${n}`
}

export function defaultConfig(): ScanConfig {
  const keywords = ["coffee", "espresso", "coffee shop"]
  return {
    keywords,
    activeKeyword: "coffee",
    targetBusiness: "Houndstooth Coffee",
    targetPlaceId: "",
    businessCity: "Austin",
    businessState: "TX",
    mapsUrl: "https://www.google.com/maps/search/Houndstooth+Coffee/@30.2669,-97.7434,16z",
    locationLabel: "Downtown Austin, TX",
    center: { lat: 30.2672, lng: -97.7431 },
    gridSize: 5,
    radiusMiles: 1.4,
    spacingMiles: spacingFromRadius(1.4, 5),
    zoom: 15,
    languageCode: "en",
    device: "desktop",
    depth: 20,
    forceMock: true,
    schedule: "manual",
  }
}

export function emptyConfig(): ScanConfig {
  return {
    keywords: [],
    activeKeyword: "",
    targetBusiness: "",
    targetPlaceId: "",
    businessCity: "",
    businessState: "TX",
    mapsUrl: "",
    locationLabel: "",
    center: { lat: 30.2672, lng: -97.7431 },
    gridSize: 5,
    radiusMiles: 1.4,
    spacingMiles: spacingFromRadius(1.4, 5),
    zoom: 15,
    languageCode: "en",
    device: "desktop",
    depth: 20,
    forceMock: true,
    schedule: "manual",
  }
}

export function blankCampaign(name = "New campaign"): Campaign {
  const config = emptyConfig()
  return {
    id: `camp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    brand: "",
    keywords: [],
    activeKeyword: "",
    businessName: "",
    businessCity: "",
    businessState: "TX",
    placeId: "",
    mapsUrl: "",
    locationLabel: "",
    center: config.center,
    gridSize: config.gridSize,
    radiusMiles: config.radiusMiles,
    languageCode: config.languageCode,
    device: config.device,
    schedule: "manual",
    createdAt: new Date().toISOString(),
    lastScanAt: null,
    nextScanAt: null,
  }
}

export function defaultCampaign(): Campaign {
  const config = defaultConfig()
  return {
    id: "camp_houndstooth_austin",
    name: "Houndstooth · Austin",
    brand: "Houndstooth Coffee",
    keywords: config.keywords,
    activeKeyword: config.activeKeyword,
    businessName: config.targetBusiness,
    businessCity: config.businessCity,
    businessState: config.businessState,
    placeId: config.targetPlaceId,
    mapsUrl: config.mapsUrl,
    locationLabel: config.locationLabel,
    center: config.center,
    gridSize: config.gridSize,
    radiusMiles: config.radiusMiles,
    languageCode: config.languageCode,
    device: config.device,
    schedule: "weekly",
    createdAt: new Date().toISOString(),
    lastScanAt: null,
    nextScanAt: null,
  }
}

export function defaultCampaigns(): Campaign[] {
  const houndstooth = defaultCampaign()
  return [
    houndstooth,
    {
      ...houndstooth,
      id: "camp_jos_austin",
      name: "Jo's Coffee · Austin",
      brand: "Jo's Coffee",
      keywords: ["coffee", "austin coffee"],
      activeKeyword: "coffee",
      businessName: "Jo's Coffee",
      mapsUrl: "https://www.google.com/maps/search/Jo's+Coffee/@30.2651,-97.7468,16z",
      locationLabel: "Jo's Coffee, Austin, TX",
      center: { lat: 30.2651, lng: -97.7468 },
      schedule: "manual",
    },
  ]
}

type LegacyCampaign = Partial<Campaign> & { keyword?: string }

function migrateCampaign(raw: LegacyCampaign): Campaign {
  const fallback = defaultCampaign()
  let keywords = normalizeKeywords(raw.keywords ?? raw.keyword, fallback.keywords[0])
  if (
    raw.id === "camp_houndstooth_austin" &&
    keywords.length === 1 &&
    keywords[0].toLowerCase() === "coffee"
  ) {
    keywords = [...fallback.keywords]
  }
  return {
    ...fallback,
    ...raw,
    keywords,
    activeKeyword: pickActiveKeyword(keywords, raw.activeKeyword ?? raw.keyword),
    id: raw.id || `camp_${Date.now()}`,
    name: raw.name?.trim() || fallback.name,
  }
}

export function loadSettings(): ApiSettings {
  if (typeof window === "undefined") return { login: "", password: "" }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { login: "", password: "" }
    const parsed = JSON.parse(raw) as ApiSettings
    return { login: parsed.login ?? "", password: parsed.password ?? "" }
  } catch {
    return { login: "", password: "" }
  }
}

export function saveSettings(settings: ApiSettings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadCampaigns(): Campaign[] {
  if (typeof window === "undefined") return defaultCampaigns()
  try {
    const raw = window.localStorage.getItem(CAMPAIGNS_KEY)
    if (!raw) {
      const seed = defaultCampaigns()
      window.localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(seed))
      return seed
    }
    const parsed = JSON.parse(raw) as LegacyCampaign[]
    if (!Array.isArray(parsed)) return defaultCampaigns()
    // A stored empty list is intentional (last campaign deleted). Do not re-seed.
    if (parsed.length === 0) return []
    return parsed.map(migrateCampaign).filter((campaign) => Boolean(campaign.id))
  } catch {
    return defaultCampaigns()
  }
}

export function saveCampaigns(campaigns: Campaign[]) {
  window.localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(campaigns))
}

export function loadActiveCampaignId(campaigns: Campaign[]): string {
  if (typeof window === "undefined") return campaigns[0]?.id ?? ""
  return window.localStorage.getItem(ACTIVE_KEY) || campaigns[0]?.id || ""
}

export function saveActiveCampaignId(id: string) {
  window.localStorage.setItem(ACTIVE_KEY, id)
}

export function campaignToConfig(campaign: Campaign, forceMock: boolean): ScanConfig {
  const keywords = normalizeKeywords(campaign.keywords, null)
  return {
    keywords,
    activeKeyword: pickActiveKeyword(keywords, campaign.activeKeyword),
    targetBusiness: campaign.businessName,
    targetPlaceId: campaign.placeId,
    businessCity: campaign.businessCity,
    businessState: campaign.businessState,
    mapsUrl: campaign.mapsUrl,
    locationLabel: campaign.locationLabel,
    center: campaign.center,
    gridSize: campaign.gridSize,
    radiusMiles: campaign.radiusMiles,
    spacingMiles: spacingFromRadius(campaign.radiusMiles, campaign.gridSize),
    zoom: 15,
    languageCode: campaign.languageCode,
    device: campaign.device,
    depth: 20,
    forceMock,
    schedule: campaign.schedule,
  }
}

export function configToCampaignPatch(config: ScanConfig): Partial<Campaign> {
  const keywords = normalizeKeywords(config.keywords, null)
  return {
    keywords,
    activeKeyword: pickActiveKeyword(keywords, config.activeKeyword),
    businessName: config.targetBusiness,
    businessCity: config.businessCity,
    businessState: config.businessState,
    placeId: config.targetPlaceId,
    mapsUrl: config.mapsUrl,
    locationLabel: config.locationLabel,
    center: config.center,
    gridSize: config.gridSize,
    radiusMiles: config.radiusMiles,
    languageCode: config.languageCode,
    device: config.device,
    schedule: config.schedule,
  }
}

export function loadAllScans(): Record<string, KeywordResults> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(SCANS_KEY)
    if (!raw) return {}
    return normalizeWorkspaceScans(JSON.parse(raw) as unknown)
  } catch {
    return {}
  }
}

export function loadScans(campaignId: string): KeywordResults {
  return loadAllScans()[campaignId] ?? {}
}

export function saveAllScans(scans: Record<string, KeywordResults>) {
  if (typeof window === "undefined") return
  const all: Record<string, Record<string, PointResult[]>> = {}
  for (const [campaignId, byKeyword] of Object.entries(scans)) {
    all[campaignId] = Object.fromEntries(
      Object.entries(byKeyword).map(([keyword, byId]) => [keyword, Object.values(byId)])
    )
  }
  window.localStorage.setItem(SCANS_KEY, JSON.stringify(all))
}

export function saveScans(campaignId: string, scans: KeywordResults) {
  if (typeof window === "undefined") return
  const all = loadAllScans()
  all[campaignId] = toKeywordResults(scans)
  saveAllScans(all)
}

export function deleteScans(campaignId: string) {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem(SCANS_KEY)
    if (!raw) return
    const all = JSON.parse(raw) as Record<string, unknown>
    delete all[campaignId]
    window.localStorage.setItem(SCANS_KEY, JSON.stringify(all))
  } catch {
    return
  }
}

export function nextScanAt(from: Date, cadence: ScheduleCadence): string | null {
  if (cadence === "manual") return null
  const next = new Date(from)
  next.setDate(next.getDate() + (cadence === "daily" ? 1 : 7))
  return next.toISOString()
}

export function toStateName(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const upper = trimmed.toUpperCase()
  const byAbbr = US_STATES.find((state) => state.abbr === upper)
  if (byAbbr) return byAbbr.name
  const byName = US_STATES.find((state) => state.name.toLowerCase() === trimmed.toLowerCase())
  return byName?.name ?? trimmed
}

export function toStateAbbr(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const upper = trimmed.toUpperCase()
  const byAbbr = US_STATES.find((state) => state.abbr === upper)
  if (byAbbr) return byAbbr.abbr
  const byName = US_STATES.find((state) => state.name.toLowerCase() === trimmed.toLowerCase())
  return byName?.abbr ?? upper.slice(0, 2)
}

export function isCampaignDue(campaign: Campaign, now = new Date()): boolean {
  if (campaign.schedule === "manual") return false
  if (!campaign.lastScanAt || !campaign.nextScanAt) return true
  return new Date(campaign.nextScanAt).getTime() <= now.getTime()
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
