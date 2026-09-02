import { spacingFromRadius } from "./grid"
import type { ApiSettings, Campaign, ScanConfig, ScheduleCadence } from "./types"

const SETTINGS_KEY = "gridpin.settings"
const CAMPAIGNS_KEY = "gridpin.campaigns"
const ACTIVE_KEY = "gridpin.activeCampaignId"

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

export function defaultConfig(): ScanConfig {
  return {
    keyword: "coffee",
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

export function defaultCampaign(): Campaign {
  const config = defaultConfig()
  return {
    id: "camp_houndstooth_austin",
    name: "Houndstooth · Austin",
    brand: "Houndstooth Coffee",
    keyword: config.keyword,
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
  if (typeof window === "undefined") return [defaultCampaign()]
  try {
    const raw = window.localStorage.getItem(CAMPAIGNS_KEY)
    if (!raw) {
      const seed = [defaultCampaign()]
      window.localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(seed))
      return seed
    }
    const parsed = JSON.parse(raw) as Campaign[]
    return parsed.length > 0 ? parsed : [defaultCampaign()]
  } catch {
    return [defaultCampaign()]
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
  return {
    keyword: campaign.keyword,
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
  return {
    keyword: config.keyword,
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

export function nextScanAt(from: Date, cadence: ScheduleCadence): string | null {
  if (cadence === "manual") return null
  const next = new Date(from)
  next.setDate(next.getDate() + (cadence === "daily" ? 1 : 7))
  return next.toISOString()
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
