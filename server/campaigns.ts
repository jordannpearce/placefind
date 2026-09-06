import { randomBytes } from "node:crypto"
import { scanMapsGrid, searchDataForSeo } from "./dataforseo.ts"
import { geocodeCityState } from "./geocode.ts"
import { formatLocationCoordinate, type GridPoint as MapsGridPoint } from "./grid.ts"
import { mapsScanConfigured, mergeHostedKeys } from "./hosted-keys.ts"
import { mapsPlaceUrl } from "./match.ts"
import { publicSearchMessage } from "./public-copy.ts"
import { rankFromMapsItems, rankOfBusiness } from "./rank.ts"
import { isSellerMode } from "./runtime.ts"
import { finalizeGridPointResults } from "./scan-finalize.ts"
import { readCollection, writeCollection } from "./store.ts"
import type { ApiKeys } from "./types.ts"

export const MAX_KEYWORDS = 20
export const MAX_RECENT_SCANS = 10
export const MAX_GRID_SIZE = 7
export const MIN_GRID_SIZE = 3
export const ALLOWED_GRID_SIZES = [3, 5, 7] as const
export const DEFAULT_GRID_SIZE = 5
export const DEFAULT_SPACING_MILES = 1
export const MIN_SPACING_MILES = 0.25
export const MAX_SPACING_MILES = 10
export const DEFAULT_ZOOM = 17

export type GeoPoint = {
  lat: number
  lng: number
}

export type CampaignInput = {
  name?: string
  businessName?: string
  city?: string
  state?: string
  keywords?: string[]
  placeId?: string
  listingTitle?: string
  listingAddress?: string
  gridSize?: number
  spacingMiles?: number
  zoom?: number
  center?: GeoPoint | null
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

export type GridPoint = {
  row: number
  col: number
  lat: number
  lng: number
  locationCoordinate?: string
}

export type GridPointResult = GridPoint & {
  keyword: string
  rank: number | null
  listingTitle: string | null
  rating: number | null
  reviewCount?: number | null
  address: string | null
  domain?: string | null
  placeId?: string | null
  mapsUrl: string | null
  scannedAt: string
  error?: string
  status?: "rank" | "not_found" | "error" | "pending" | "unset"
}

export type ScanRun = {
  id: string
  scannedAt: string
  keywordCount: number
  foundCount: number
  results: KeywordRank[]
}

export type GridScanRun = {
  id: string
  scannedAt: string
  keyword: string
  gridSize: number
  spacingMiles: number
  zoom: number
  center: GeoPoint
  placeId: string | null
  pointCount: number
  foundCount: number
  points: GridPointResult[]
}

export type Campaign = {
  id: string
  userId: string
  name: string
  businessName: string
  city: string
  state: string
  placeId: string
  listingTitle: string
  listingAddress: string
  keywords: string[]
  gridSize: number
  spacingMiles: number
  zoom: number
  center: GeoPoint | null
  createdAt: string
  updatedAt: string
  lastScan: ScanRun | null
  lastGridScan: GridScanRun | null
  recentScans: ScanRun[]
  recentGridScans: GridScanRun[]
  lastTrafficJob: TrafficJob | null
}

export type TrafficJob = {
  id: string
  status: "running" | "ok" | "error"
  startedAt: string
  finishedAt: string | null
  sessionsRequested: number
  sessionsAttempted: number
  sessionsOk: number
  sessionsFailed: number
  requestCount: number
  lastError: string | null
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

export function normalizeGridSize(raw: unknown): { value?: number; error?: string } {
  if (raw == null || raw === "") return { value: DEFAULT_GRID_SIZE }
  const size = Number(raw)
  if (!Number.isInteger(size)) return { error: "Choose a 3×3, 5×5, or 7×7 grid." }
  if (size > MAX_GRID_SIZE) return { error: `A grid can be at most ${MAX_GRID_SIZE}×${MAX_GRID_SIZE} (${MAX_GRID_SIZE * MAX_GRID_SIZE} map searches).` }
  if (!(ALLOWED_GRID_SIZES as readonly number[]).includes(size)) {
    return { error: "Choose a 3×3, 5×5, or 7×7 grid." }
  }
  return { value: size }
}

export function normalizeSpacingMiles(raw: unknown): { value?: number; error?: string } {
  if (raw == null || raw === "") return { value: DEFAULT_SPACING_MILES }
  const miles = Number(raw)
  if (!Number.isFinite(miles) || miles < MIN_SPACING_MILES || miles > MAX_SPACING_MILES) {
    return { error: `Distance between points must be between ${MIN_SPACING_MILES} and ${MAX_SPACING_MILES} miles.` }
  }
  return { value: miles }
}

export function normalizeCenter(raw: unknown): GeoPoint | null {
  if (!raw || typeof raw !== "object") return null
  const lat = Number((raw as GeoPoint).lat)
  const lng = Number((raw as GeoPoint).lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

export function normalizeZoom(raw: unknown): number {
  const zoom = Number(raw)
  if (!Number.isFinite(zoom)) return DEFAULT_ZOOM
  return Math.min(21, Math.max(3, Math.round(zoom)))
}


export function listingNotConfirmedMessage() {
  return "Confirm a Maps listing before scanning."
}

export function hasConfirmedListing(campaign: Pick<Campaign, "placeId">): boolean {
  return Boolean(campaign.placeId?.trim())
}

export function validateCampaign(input: CampaignInput): {
  value?: Pick<Campaign, "name" | "businessName" | "city" | "state" | "placeId" | "listingTitle" | "listingAddress" | "keywords" | "gridSize" | "spacingMiles" | "zoom" | "center">
  error?: string
} {
  const name = input.name?.trim() ?? ""
  const businessName = input.businessName?.trim() ?? ""
  const city = input.city?.trim() ?? ""
  const state = input.state?.trim() ?? ""
  const placeId = input.placeId?.trim() ?? ""
  const listingTitle = input.listingTitle?.trim() ?? ""
  const listingAddress = input.listingAddress?.trim() ?? ""
  const keywords = normalizeKeywords(input.keywords)
  if (name.length < 2) return { error: "Enter a campaign name." }
  if (businessName.length < 2) return { error: "Enter the business name to track." }
  if (city.length < 2) return { error: "Enter the city." }
  if (!state) return { error: "Choose a state." }
  if (keywords.length > MAX_KEYWORDS) return { error: `A campaign can have at most ${MAX_KEYWORDS} keywords.` }
  const grid = normalizeGridSize(input.gridSize)
  if (grid.error || grid.value == null) return { error: grid.error || "Choose a grid size." }
  const spacing = normalizeSpacingMiles(input.spacingMiles)
  if (spacing.error || spacing.value == null) return { error: spacing.error || "Enter the distance between points." }
  return {
    value: {
      name,
      businessName,
      city,
      state,
      placeId,
      listingTitle,
      listingAddress,
      keywords,
      gridSize: grid.value,
      spacingMiles: spacing.value,
      zoom: normalizeZoom(input.zoom),
      center: input.center === undefined ? null : normalizeCenter(input.center),
    },
  }
}

export function buildGridPoints(center: GeoPoint, gridSize: number, spacingMiles: number, zoom = DEFAULT_ZOOM): GridPoint[] {
  const size = normalizeGridSize(gridSize).value ?? DEFAULT_GRID_SIZE
  const spacing = normalizeSpacingMiles(spacingMiles).value ?? DEFAULT_SPACING_MILES
  const z = normalizeZoom(zoom)
  const half = (size - 1) / 2
  const latDegPerMile = 1 / 69
  const cosLat = Math.cos((center.lat * Math.PI) / 180)
  const lngDegPerMile = 1 / (69 * (Math.abs(cosLat) < 0.01 ? 0.01 : cosLat))
  const points: GridPoint[] = []
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const northMiles = (half - row) * spacing
      const eastMiles = (col - half) * spacing
      const lat = center.lat + northMiles * latDegPerMile
      const lng = center.lng + eastMiles * lngDegPerMile
      points.push({
        row,
        col,
        lat,
        lng,
        locationCoordinate: formatLocationCoordinate(lat, lng, z),
      })
    }
  }
  return points
}

export function gridPointsForCampaign(
  campaign: Pick<Campaign, "center" | "gridSize" | "spacingMiles" | "zoom">,
  gridSize?: number,
  spacingMiles?: number,
): GridPoint[] {
  const center = normalizeCenter(campaign.center)
  if (!center) return []
  return buildGridPoints(center, gridSize ?? campaign.gridSize, spacingMiles ?? campaign.spacingMiles, campaign.zoom)
}

export async function loadCampaignGrid(
  id: string,
  userId?: string | null,
  input: { gridSize?: number; spacingMiles?: number } = {},
): Promise<{ campaign: Campaign; center: GeoPoint; points: GridPoint[]; gridSize: number; spacingMiles: number }> {
  const campaign = getCampaign(id, userId)
  if (!campaign) throw new CampaignError("That campaign was not found.", 404)

  const grid = normalizeGridSize(input.gridSize ?? campaign.gridSize)
  if (grid.error || grid.value == null) throw new CampaignError(grid.error || "Choose a grid size.")
  const spacing = normalizeSpacingMiles(input.spacingMiles ?? campaign.spacingMiles)
  if (spacing.error || spacing.value == null) throw new CampaignError(spacing.error || "Enter the distance between points.")

  let next = campaign
  let center = normalizeCenter(campaign.center)
  if (!center) {
    const located = await geocodeCity(campaign.city, campaign.state)
    if (!located) {
      throw new CampaignError("Could not find a map location for this business. Check the city and state.")
    }
    center = located
    next = saveCampaign({
      ...campaign,
      center,
      updatedAt: new Date().toISOString(),
    })
  }

  return {
    campaign: next,
    center,
    points: buildGridPoints(center, grid.value, spacing.value, next.zoom),
    gridSize: grid.value,
    spacingMiles: spacing.value,
  }
}

function ownsCampaign(campaign: Campaign, userId?: string | null) {
  if (!userId) return false
  if (!campaign.userId) return true
  return campaign.userId === userId
}

export function readCampaigns(userId?: string | null): Campaign[] {
  const rows = readCollection<Campaign>("campaigns")
  if (!Array.isArray(rows)) return []
  const all = rows.map(normalizeStoredCampaign)
  if (!userId) return all
  return all.filter((row) => ownsCampaign(row, userId))
}

function writeCampaigns(campaigns: Campaign[]) {
  writeCollection("campaigns", campaigns)
}

function normalizeStoredCampaign(row: Campaign): Campaign {
  const grid = normalizeGridSize(row.gridSize)
  const spacing = normalizeSpacingMiles(row.spacingMiles)
  return {
    id: row.id || newId(),
    userId: row.userId ?? "",
    name: row.name ?? "",
    businessName: row.businessName ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    placeId: row.placeId ?? "",
    listingTitle: row.listingTitle ?? "",
    listingAddress: row.listingAddress ?? "",
    keywords: normalizeKeywords(row.keywords),
    gridSize: grid.value ?? DEFAULT_GRID_SIZE,
    spacingMiles: spacing.value ?? DEFAULT_SPACING_MILES,
    zoom: normalizeZoom(row.zoom),
    center: normalizeCenter(row.center),
    createdAt: row.createdAt || new Date().toISOString(),
    updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
    lastScan: row.lastScan ?? null,
    lastGridScan: row.lastGridScan ?? null,
    recentScans: Array.isArray(row.recentScans) ? row.recentScans.slice(0, MAX_RECENT_SCANS) : [],
    recentGridScans: Array.isArray(row.recentGridScans) ? row.recentGridScans.slice(0, MAX_RECENT_SCANS) : [],
    lastTrafficJob: row.lastTrafficJob ?? null,
  }
}

export function getCampaign(id: string, userId?: string | null): Campaign | null {
  const campaign = readCollection<Campaign>("campaigns").map(normalizeStoredCampaign).find((row) => row.id === id) ?? null
  if (!campaign) return null
  if (userId && !ownsCampaign(campaign, userId)) return null
  return campaign
}

export function createCampaign(input: CampaignInput, userId = ""): Campaign {
  const parsed = validateCampaign(input)
  if (parsed.error || !parsed.value) throw new CampaignError(parsed.error || "Could not create the campaign.")
  const now = new Date().toISOString()
  const campaign: Campaign = {
    id: newId(),
    userId,
    ...parsed.value,
    createdAt: now,
    updatedAt: now,
    lastScan: null,
    lastGridScan: null,
    recentScans: [],
    recentGridScans: [],
    lastTrafficJob: null,
  }
  writeCampaigns([campaign, ...readCollection<Campaign>("campaigns").map(normalizeStoredCampaign)])
  return campaign
}

export function updateCampaign(id: string, input: CampaignInput, userId?: string | null): Campaign {
  const campaigns = readCollection<Campaign>("campaigns").map(normalizeStoredCampaign)
  const index = campaigns.findIndex((row) => row.id === id)
  if (index < 0) throw new CampaignError("That campaign was not found.", 404)
  const current = campaigns[index]!
  if (userId && !ownsCampaign(current, userId)) throw new CampaignError("That campaign was not found.", 404)
  const parsed = validateCampaign({
    name: input.name !== undefined ? input.name : current.name,
    businessName: input.businessName !== undefined ? input.businessName : current.businessName,
    city: input.city !== undefined ? input.city : current.city,
    state: input.state !== undefined ? input.state : current.state,
    keywords: input.keywords !== undefined ? input.keywords : current.keywords,
    placeId: input.placeId !== undefined ? input.placeId : current.placeId,
    listingTitle: input.listingTitle !== undefined ? input.listingTitle : current.listingTitle,
    listingAddress: input.listingAddress !== undefined ? input.listingAddress : current.listingAddress,
    gridSize: input.gridSize !== undefined ? input.gridSize : current.gridSize,
    spacingMiles: input.spacingMiles !== undefined ? input.spacingMiles : current.spacingMiles,
    zoom: input.zoom !== undefined ? input.zoom : current.zoom,
    center: input.center !== undefined ? input.center : current.center,
  })
  if (parsed.error || !parsed.value) throw new CampaignError(parsed.error || "Could not update the campaign.")
  const moved =
    parsed.value.businessName !== current.businessName ||
    parsed.value.city !== current.city ||
    parsed.value.state !== current.state
  const listingProvided =
    input.placeId !== undefined || input.center !== undefined || input.listingTitle !== undefined
  const next: Campaign = {
    ...current,
    ...parsed.value,
    placeId: moved && !listingProvided ? "" : parsed.value.placeId,
    listingTitle: moved && !listingProvided ? "" : parsed.value.listingTitle,
    listingAddress: moved && !listingProvided ? "" : parsed.value.listingAddress,
    center: moved && input.center === undefined ? null : parsed.value.center,
    updatedAt: new Date().toISOString(),
  }
  campaigns[index] = next
  writeCampaigns(campaigns)
  return next
}

export function deleteCampaign(id: string, userId?: string | null): boolean {
  const campaigns = readCollection<Campaign>("campaigns").map(normalizeStoredCampaign)
  const current = campaigns.find((row) => row.id === id)
  if (!current || (userId && !ownsCampaign(current, userId))) {
    throw new CampaignError("That campaign was not found.", 404)
  }
  writeCampaigns(campaigns.filter((row) => row.id !== id))
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

export function mapsKeysMissingMessage() {
  return "Maps search is not configured, so a rank scan cannot run."
}

export { mapsScanConfigured }

export async function geocodeCity(city: string, state: string): Promise<GeoPoint | null> {
  return geocodeCityState(city, state)
}

export async function resolveCampaignCenter(
  campaign: Campaign,
  keys: ApiKeys,
): Promise<{ center: GeoPoint; placeId: string }> {
  let placeId = campaign.placeId?.trim() || ""
  if (campaign.center) return { center: campaign.center, placeId }
  if (hasDataForSeo(keys)) {
    const live = await searchDataForSeo(
      { name: campaign.businessName, city: campaign.city, state: campaign.state },
      keys.dataforseoLogin!,
      keys.dataforseoPassword!,
    )
    if (!live.error) {
      const hit = rankOfBusiness(live.hits, campaign.businessName, campaign.city, campaign.state, placeId)
      if (hit.listing?.lat != null && hit.listing?.lng != null) {
        return { center: { lat: hit.listing.lat, lng: hit.listing.lng }, placeId: placeId || hit.listing.placeId || "" }
      }
      const first = live.hits.find((row) => row.lat != null && row.lng != null)
      if (first?.lat != null && first.lng != null) {
        return { center: { lat: first.lat, lng: first.lng }, placeId: placeId || first.placeId || "" }
      }
    }
  }
  const cityPoint = await geocodeCity(campaign.city, campaign.state)
  if (cityPoint) return { center: cityPoint, placeId }
  throw new CampaignError("Could not find a map location for this business. Check the name, city, and state.")
}

export function mapsPlaceUrlFromCampaign(campaign: Campaign, title: string, address: string): string {
  if (!campaign.placeId && campaign.center == null) return ""
  return mapsPlaceUrl({
    title,
    address,
    placeId: campaign.placeId || null,
    lat: campaign.center?.lat ?? campaign.lastGridScan?.center.lat,
    lng: campaign.center?.lng ?? campaign.lastGridScan?.center.lng,
    cid: null,
  })
}

export function saveCampaign(next: Campaign): Campaign {
  const campaigns = readCollection<Campaign>("campaigns").map(normalizeStoredCampaign)
  const index = campaigns.findIndex((row) => row.id === next.id)
  if (index < 0) {
    writeCampaigns([next, ...campaigns])
    return next
  }
  campaigns[index] = next
  writeCampaigns(campaigns)
  return next
}

export async function scanCampaign(
  id: string,
  rawKeys: ApiKeys,
  requestedKeywords?: string[],
  userId?: string | null,
): Promise<{ campaign: Campaign; scan: ScanRun; grid: GridScanRun }> {
  const campaign = getCampaign(id, userId)
  if (!campaign) throw new CampaignError("That campaign was not found.", 404)

  const keys = mergeHostedKeys(rawKeys)
  if (!mapsScanConfigured(rawKeys)) {
    throw new CampaignError(mapsKeysMissingMessage())
  }

  const keywords = selectScanKeywords(campaign, requestedKeywords)
  if (keywords.length === 0) {
    throw new CampaignError("Add at least one keyword before running a scan.")
  }
  if (!hasConfirmedListing(campaign)) {
    throw new CampaignError(listingNotConfirmedMessage(), 400)
  }
  const keyword = keywords[0]!

  const scannedAt = new Date().toISOString()
  const center = normalizeCenter(campaign.center)
  if (!center) {
    throw new CampaignError("That listing has no map location. Choose another listing.", 400)
  }
  const placeId = campaign.placeId.trim()
  const targetName = campaign.listingTitle.trim() || campaign.businessName
  const zoom = normalizeZoom(campaign.zoom)
  const gridPoints = buildGridPoints(center, campaign.gridSize, campaign.spacingMiles, zoom)
  const cells = await scanMapsGrid(
    gridPoints.map(
      (point): MapsGridPoint => ({
        id: `${point.row}:${point.col}`,
        row: point.row,
        col: point.col,
        lat: point.lat,
        lng: point.lng,
        zoom,
        locationCoordinate: point.locationCoordinate || formatLocationCoordinate(point.lat, point.lng, zoom),
      }),
    ),
    keyword,
    keys.dataforseoLogin!,
    keys.dataforseoPassword!,
  )

  const points: GridPointResult[] = finalizeGridPointResults(cells.map((cell) => {
    const hit = rankFromMapsItems(cell.items, {
      name: targetName,
      placeId,
      city: campaign.city,
      state: campaign.state,
    })
    const listing = hit.listing
    const publicError = cell.error
      ? isSellerMode()
        ? cell.error
        : publicSearchMessage(cell.error) || "Maps search could not finish this point."
      : undefined
    return {
      row: cell.point.row,
      col: cell.point.col,
      lat: cell.point.lat,
      lng: cell.point.lng,
      locationCoordinate: cell.point.locationCoordinate,
      keyword,
      rank: publicError ? null : hit.rank,
      listingTitle: listing?.title ?? null,
      rating: listing?.rating?.value ?? null,
      reviewCount: listing?.rating?.votes_count ?? null,
      address: listing?.address ?? null,
      domain: listing?.domain ?? null,
      placeId: listing?.place_id ?? null,
      mapsUrl: listing
        ? mapsPlaceUrl({
            title: listing.title || campaign.businessName,
            address: listing.address || "",
            placeId: listing.place_id,
            lat: cell.point.lat,
            lng: cell.point.lng,
            cid: null,
          })
        : null,
      scannedAt,
      error: publicError,
    }
  }), scannedAt)

  const grid: GridScanRun = {
    id: newId(),
    scannedAt,
    keyword,
    gridSize: campaign.gridSize,
    spacingMiles: campaign.spacingMiles,
    zoom,
    center,
    placeId: placeId || null,
    pointCount: points.length,
    foundCount: points.filter((row) => row.rank != null).length,
    points,
  }

  const keywordRank: KeywordRank = {
    keyword,
    rank: bestGridRank(points),
    listingTitle: points.find((row) => row.rank != null)?.listingTitle ?? null,
    rating: points.find((row) => row.rank != null)?.rating ?? null,
    address: points.find((row) => row.rank != null)?.address ?? null,
    mapsUrl: points.find((row) => row.rank != null)?.mapsUrl ?? null,
    scannedAt,
    error: points.every((row) => row.error) ? points[0]?.error : undefined,
  }

  const merged = mergeKeywordRanks(campaign.keywords, campaign.lastScan?.results, [keywordRank])
  const scan: ScanRun = {
    id: grid.id,
    scannedAt,
    keywordCount: merged.length,
    foundCount: merged.filter((row) => row.rank != null).length,
    results: merged,
  }

  const next: Campaign = {
    ...campaign,
    center,
    placeId,
    zoom,
    updatedAt: scannedAt,
    lastScan: scan,
    lastGridScan: grid,
    recentScans: [scan, ...campaign.recentScans].slice(0, MAX_RECENT_SCANS),
    recentGridScans: [grid, ...campaign.recentGridScans].slice(0, MAX_RECENT_SCANS),
  }

  return { campaign: saveCampaign(next), scan, grid }
}

export function bestGridRank(points: GridPointResult[]): number | null {
  const ranks = points.map((row) => row.rank).filter((rank): rank is number => rank != null)
  if (ranks.length === 0) return null
  return Math.min(...ranks)
}

export function rankColor(rank: number | null | undefined): "green" | "yellow" | "red" {
  if (rank == null || rank >= 11) return "red"
  if (rank <= 3) return "green"
  return "yellow"
}
