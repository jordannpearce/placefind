import { randomBytes } from "node:crypto"
import { scanMapsGrid, searchDataForSeo, type MapsGridClient } from "./dataforseo.ts"
import { geocodeCityState } from "./geocode.ts"
import { formatLocationCoordinate, type GridPoint as MapsGridPoint } from "./grid.ts"
import { mapsScanConfigured, mergeHostedKeys } from "./hosted-keys.ts"
import { mapsPlaceUrl } from "./match.ts"
import {
  mapsKeysMissingAdminMessage,
  mapsKeysMissingPublicMessage,
  publicPinScanMessage,
  publicSearchMessage,
} from "./public-copy.ts"
import { rankFromMapsItems, rankOfBusiness } from "./rank.ts"
import { isSellerMode } from "./runtime.ts"
import { compareScanRuns } from "../src/lib/scan-compare.ts"
import { finalizeGridPointResults } from "./scan-finalize.ts"
import {
  defaultScanSchedule,
  defaultTrafficSchedule,
  listingNotConfirmedForScheduleMessage,
  nextRunAt,
  normalizeScanSchedule,
  normalizeTrafficSchedule,
  type ScanSchedule,
  type TrafficSchedule,
} from "./schedule.ts"
import { readCollection, writeCollection } from "./store.ts"
import type { ApiKeys } from "./types.ts"
import type { ScanCompare } from "../src/lib/types.ts"

export type { ScanSchedule, TrafficSchedule }
export { listingNotConfirmedForScheduleMessage }

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
  scanSchedule?: ScanSchedule | null
  trafficSchedule?: TrafficSchedule | null
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
  campaignId?: string
  startedAt?: string
  finishedAt?: string
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
  status?: "running" | "ok" | "error"
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
  scanSchedule: ScanSchedule
  trafficSchedule: TrafficSchedule
}

export type TrafficJobStatus = "running" | "ok" | "error" | "stopped"

export type TrafficLogLine = {
  at: string
  message: string
  pinId?: string
  keyword?: string
}

export type TrafficPinResult = {
  pinId: string
  keyword?: string
  row: number
  col: number
  lat: number
  lng: number
  status: "pending" | "running" | "ok" | "fail" | "cancelled"
  finishedAt: string | null
}

export type TrafficJob = {
  id: string
  status: TrafficJobStatus
  startedAt: string
  finishedAt: string | null
  sessionsRequested: number
  sessionsAttempted: number
  sessionsOk: number
  sessionsFailed: number
  requestCount: number
  lastError: string | null
  pinIds?: string[]
  keywords?: string[]
  keywordIds?: string[]
  log?: TrafficLogLine[]
  results?: TrafficPinResult[]
}

export class CampaignError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "CampaignError"
    this.status = status
  }
}

const runningScans = new Set<string>()

function newId(): string {
  return randomBytes(8).toString("hex")
}

export function isScanRunning(campaignId: string): boolean {
  return runningScans.has(campaignId)
}

export function scanAlreadyRunningMessage() {
  return "A scan is already running for this campaign."
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

function writeScanRuns(rows: GridScanRun[]) {
  writeCollection("scan_runs", rows)
}

function normalizeStoredScanRun(row: GridScanRun): GridScanRun {
  return {
    id: row.id || newId(),
    campaignId: row.campaignId,
    startedAt: row.startedAt || row.scannedAt,
    finishedAt: row.finishedAt || row.scannedAt,
    scannedAt: row.scannedAt || row.finishedAt || new Date().toISOString(),
    keyword: row.keyword ?? "",
    gridSize: row.gridSize,
    spacingMiles: row.spacingMiles,
    zoom: normalizeZoom(row.zoom),
    center: normalizeCenter(row.center) ?? { lat: 0, lng: 0 },
    placeId: row.placeId ?? null,
    pointCount: row.pointCount ?? row.points?.length ?? 0,
    foundCount: row.foundCount ?? 0,
    points: Array.isArray(row.points) ? row.points : [],
    status: row.status === "running" || row.status === "ok" || row.status === "error" ? row.status : undefined,
  }
}

export function saveScanRun(run: GridScanRun): GridScanRun {
  const next = normalizeStoredScanRun(run)
  const rows = readCollection<GridScanRun>("scan_runs").map(normalizeStoredScanRun)
  const index = rows.findIndex((row) => row.id === next.id)
  if (index < 0) writeScanRuns([next, ...rows])
  else {
    rows[index] = next
    writeScanRuns(rows)
  }
  return next
}

export function listScanRuns(campaignId: string): GridScanRun[] {
  return readCollection<GridScanRun>("scan_runs")
    .map(normalizeStoredScanRun)
    .filter((row) => row.campaignId === campaignId)
    .sort((a, b) => String(b.finishedAt || b.scannedAt).localeCompare(String(a.finishedAt || a.scannedAt)))
}

export function getScanRun(campaignId: string, id: string): GridScanRun | null {
  return listScanRuns(campaignId).find((row) => row.id === id) ?? null
}

export function deleteScanRunsForCampaign(campaignId: string) {
  writeScanRuns(readCollection<GridScanRun>("scan_runs").map(normalizeStoredScanRun).filter((row) => row.campaignId !== campaignId))
}

function backfillScanRuns(campaign: Campaign): GridScanRun[] {
  const existing = listScanRuns(campaign.id)
  if (existing.length > 0) return existing
  const seen = new Set<string>()
  const fromCampaign = [campaign.lastGridScan, ...(campaign.recentGridScans ?? [])].filter((row): row is GridScanRun => Boolean(row))
  for (const run of fromCampaign) {
    if (seen.has(run.id)) continue
    seen.add(run.id)
    saveScanRun({ ...run, campaignId: campaign.id, startedAt: run.startedAt || run.scannedAt, finishedAt: run.finishedAt || run.scannedAt })
  }
  return listScanRuns(campaign.id)
}

export function listCampaignScans(id: string, userId?: string | null): GridScanRun[] {
  const campaign = getCampaign(id, userId)
  if (!campaign) throw new CampaignError("That campaign was not found.", 404)
  return backfillScanRuns(campaign)
}

export function getCampaignScan(id: string, scanId: string, userId?: string | null): GridScanRun {
  const campaign = getCampaign(id, userId)
  if (!campaign) throw new CampaignError("That campaign was not found.", 404)
  const run = getScanRun(campaign.id, scanId) ?? backfillScanRuns(campaign).find((row) => row.id === scanId)
  if (!run) throw new CampaignError("That scan was not found.", 404)
  return run
}

export function compareCampaignScans(id: string, previousId: string, currentId: string, userId?: string | null): ScanCompare {
  const previous = getCampaignScan(id, previousId, userId)
  const current = getCampaignScan(id, currentId, userId)
  return compareScanRuns(previous, current)
}

function applyScheduleNextRun<T extends ScanSchedule | TrafficSchedule>(schedule: T, now = new Date()): T {
  return { ...schedule, nextRunAt: nextRunAt({ ...schedule, enabled: true }, now).toISOString() }
}

function normalizeStoredTrafficJob(job: Campaign["lastTrafficJob"] | undefined): TrafficJob | null {
  if (!job || typeof job !== "object") return null
  const status =
    job.status === "running" || job.status === "ok" || job.status === "error" || job.status === "stopped"
      ? job.status
      : "error"
  return {
    id: String(job.id || ""),
    status,
    startedAt: String(job.startedAt || ""),
    finishedAt: job.finishedAt ?? null,
    sessionsRequested: Number(job.sessionsRequested) || 0,
    sessionsAttempted: Number(job.sessionsAttempted) || 0,
    sessionsOk: Number(job.sessionsOk) || 0,
    sessionsFailed: Number(job.sessionsFailed) || 0,
    requestCount: Number(job.requestCount) || 0,
    lastError: job.lastError ?? null,
    pinIds: Array.isArray(job.pinIds) ? job.pinIds.map(String) : [],
    keywords: Array.isArray(job.keywords) ? job.keywords.map(String) : [],
    keywordIds: Array.isArray(job.keywordIds) ? job.keywordIds.map(String) : [],
    log: Array.isArray(job.log)
      ? job.log
          .filter((line): line is TrafficLogLine => Boolean(line && typeof line === "object"))
          .map((line) => ({
            at: String(line.at || ""),
            message: String(line.message || ""),
            ...(line.pinId ? { pinId: String(line.pinId) } : {}),
            ...(line.keyword ? { keyword: String(line.keyword) } : {}),
          }))
      : [],
    results: Array.isArray(job.results)
      ? job.results
          .filter((row): row is TrafficPinResult => Boolean(row && typeof row === "object"))
          .map((row) => ({
            pinId: String(row.pinId || ""),
            ...(row.keyword ? { keyword: String(row.keyword) } : {}),
            row: Number(row.row) || 0,
            col: Number(row.col) || 0,
            lat: Number(row.lat) || 0,
            lng: Number(row.lng) || 0,
            status:
              row.status === "pending" ||
              row.status === "running" ||
              row.status === "ok" ||
              row.status === "fail" ||
              row.status === "cancelled"
                ? row.status
                : "pending",
            finishedAt: row.finishedAt ?? null,
          }))
      : [],
  }
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
    lastTrafficJob: normalizeStoredTrafficJob(row.lastTrafficJob),
    scanSchedule: normalizeScanSchedule(row.scanSchedule).value ?? defaultScanSchedule(),
    trafficSchedule: normalizeTrafficSchedule(row.trafficSchedule).value ?? defaultTrafficSchedule(),
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
    scanSchedule: defaultScanSchedule(),
    trafficSchedule: defaultTrafficSchedule(),
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
  const scanSchedule = input.scanSchedule !== undefined ? normalizeScanSchedule(input.scanSchedule) : { value: current.scanSchedule }
  if (scanSchedule.error || !scanSchedule.value) throw new CampaignError(scanSchedule.error || "That scan schedule is not valid.")
  const trafficSchedule =
    input.trafficSchedule !== undefined ? normalizeTrafficSchedule(input.trafficSchedule) : { value: current.trafficSchedule }
  if (trafficSchedule.error || !trafficSchedule.value) {
    throw new CampaignError(trafficSchedule.error || "That traffic schedule is not valid.")
  }
  const enablingSchedule = Boolean(scanSchedule.value.enabled || trafficSchedule.value.enabled)
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
    scanSchedule: applyScheduleNextRun(scanSchedule.value),
    trafficSchedule: applyScheduleNextRun(trafficSchedule.value),
    updatedAt: new Date().toISOString(),
  }
  if (enablingSchedule && !hasConfirmedListing(next)) {
    throw new CampaignError(listingNotConfirmedForScheduleMessage(), 400)
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
  deleteScanRunsForCampaign(id)
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
  return mapsKeysMissingPublicMessage()
}

export { mapsKeysMissingAdminMessage, mapsScanConfigured }

export type ScanCampaignOptions = {
  client?: MapsGridClient
  pollTimeoutMs?: number
  sleep?: (ms: number) => Promise<void>
}

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

function pinResultFromCell(
  cell: { point: MapsGridPoint; items: import("./dataforseo.ts").MapsItem[]; error: string | null },
  input: { keyword: string; targetName: string; placeId: string; city: string; state: string; businessName: string; scannedAt: string },
): GridPointResult {
  const hit = rankFromMapsItems(cell.items, {
    name: input.targetName,
    placeId: input.placeId,
    city: input.city,
    state: input.state,
  })
  const listing = hit.listing
  const publicError = cell.error
    ? isSellerMode()
      ? publicPinScanMessage(cell.error)
      : publicPinScanMessage(publicSearchMessage(cell.error) || cell.error)
    : undefined
  return {
    row: cell.point.row,
    col: cell.point.col,
    lat: cell.point.lat,
    lng: cell.point.lng,
    locationCoordinate: cell.point.locationCoordinate,
    keyword: input.keyword,
    rank: publicError ? null : hit.rank,
    listingTitle: listing?.title ?? null,
    rating: listing?.rating?.value ?? null,
    reviewCount: listing?.rating?.votes_count ?? null,
    address: listing?.address ?? null,
    domain: listing?.domain ?? null,
    placeId: listing?.place_id ?? null,
    mapsUrl: listing
      ? mapsPlaceUrl({
          title: listing.title || input.businessName,
          address: listing.address || "",
          placeId: listing.place_id,
          lat: cell.point.lat,
          lng: cell.point.lng,
          cid: null,
        })
      : null,
    scannedAt: input.scannedAt,
    error: publicError,
  }
}

function persistLiveGrid(campaignId: string, grid: GridScanRun): Campaign | null {
  const latest = getCampaign(campaignId)
  if (!latest) return null
  return saveCampaign({
    ...latest,
    lastGridScan: grid,
    updatedAt: new Date().toISOString(),
  })
}

export async function scanCampaign(
  id: string,
  rawKeys: ApiKeys,
  requestedKeywords?: string[],
  userId?: string | null,
  options?: ScanCampaignOptions,
): Promise<{ campaign: Campaign; scan: ScanRun; grid: GridScanRun }> {
  const campaign = getCampaign(id, userId)
  if (!campaign) throw new CampaignError("That campaign was not found.", 404)
  if (runningScans.has(campaign.id)) {
    throw new CampaignError(scanAlreadyRunningMessage(), 409)
  }
  runningScans.add(campaign.id)

  const keys = mergeHostedKeys(rawKeys)
  try {
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

    const startedAt = new Date().toISOString()
    const scannedAt = startedAt
    const center = normalizeCenter(campaign.center)
    if (!center) {
      throw new CampaignError("That listing has no map location. Choose another listing.", 400)
    }
    const placeId = campaign.placeId.trim()
    const targetName = campaign.listingTitle.trim() || campaign.businessName
    const zoom = normalizeZoom(campaign.zoom)
    const gridPoints = buildGridPoints(center, campaign.gridSize, campaign.spacingMiles, zoom)
    const mapsPoints = gridPoints.map(
      (point): MapsGridPoint => ({
        id: `${point.row}:${point.col}`,
        row: point.row,
        col: point.col,
        lat: point.lat,
        lng: point.lng,
        zoom,
        locationCoordinate: point.locationCoordinate || formatLocationCoordinate(point.lat, point.lng, zoom),
      }),
    )
    const pinContext = { keyword, targetName, placeId, city: campaign.city, state: campaign.state, businessName: campaign.businessName, scannedAt }
    const scanId = newId()
    const pendingPoints: GridPointResult[] = mapsPoints.map((point) => ({
      row: point.row,
      col: point.col,
      lat: point.lat,
      lng: point.lng,
      locationCoordinate: point.locationCoordinate,
      keyword,
      rank: null,
      listingTitle: null,
      rating: null,
      address: null,
      mapsUrl: null,
      scannedAt: "",
      status: "pending",
    }))
    let liveGrid: GridScanRun = {
      id: scanId,
      campaignId: campaign.id,
      startedAt,
      scannedAt,
      keyword,
      gridSize: campaign.gridSize,
      spacingMiles: campaign.spacingMiles,
      zoom,
      center,
      placeId: placeId || null,
      pointCount: pendingPoints.length,
      foundCount: 0,
      points: pendingPoints,
      status: "running",
    }
    persistLiveGrid(campaign.id, liveGrid)

    const cells = await scanMapsGrid(mapsPoints, keyword, keys.dataforseoLogin!, keys.dataforseoPassword!, {
      client: options?.client,
      pollTimeoutMs: options?.pollTimeoutMs,
      sleep: options?.sleep,
      onCell: (cell) => {
        const [finished] = finalizeGridPointResults([pinResultFromCell(cell, pinContext)], scannedAt)
        if (!finished) return
        liveGrid = {
          ...liveGrid,
          points: liveGrid.points.map((point) =>
            point.row === finished.row && point.col === finished.col ? finished : point,
          ),
          foundCount: liveGrid.points.filter((row) =>
            row.row === finished.row && row.col === finished.col ? finished.rank != null : row.rank != null,
          ).length,
        }
        persistLiveGrid(campaign.id, liveGrid)
      },
    })

    const points: GridPointResult[] = finalizeGridPointResults(
      cells.map((cell) => pinResultFromCell(cell, pinContext)),
      scannedAt,
    )
    const finishedAt = new Date().toISOString()
    const allFailed = points.length > 0 && points.every((row) => row.status === "error")
    const grid: GridScanRun = {
      id: scanId,
      campaignId: campaign.id,
      startedAt,
      finishedAt,
      scannedAt: finishedAt,
      keyword,
      gridSize: campaign.gridSize,
      spacingMiles: campaign.spacingMiles,
      zoom,
      center,
      placeId: placeId || null,
      pointCount: points.length,
      foundCount: points.filter((row) => row.rank != null).length,
      points,
      status: allFailed ? "error" : "ok",
    }

    const keywordRank: KeywordRank = {
      keyword,
      rank: bestGridRank(points),
      listingTitle: points.find((row) => row.rank != null)?.listingTitle ?? null,
      rating: points.find((row) => row.rank != null)?.rating ?? null,
      address: points.find((row) => row.rank != null)?.address ?? null,
      mapsUrl: points.find((row) => row.rank != null)?.mapsUrl ?? null,
      scannedAt,
      error: allFailed ? points[0]?.error : undefined,
    }

    const latest = getCampaign(campaign.id) ?? campaign
    const merged = mergeKeywordRanks(latest.keywords, latest.lastScan?.results, [keywordRank])
    const scan: ScanRun = {
      id: grid.id,
      scannedAt,
      keywordCount: merged.length,
      foundCount: merged.filter((row) => row.rank != null).length,
      results: merged,
    }

    const next: Campaign = {
      ...latest,
      center,
      placeId,
      zoom,
      updatedAt: finishedAt,
      lastScan: scan,
      lastGridScan: grid,
      recentScans: [scan, ...latest.recentScans].slice(0, MAX_RECENT_SCANS),
      recentGridScans: [grid, ...latest.recentGridScans].slice(0, MAX_RECENT_SCANS),
    }

    saveScanRun(grid)
    return { campaign: saveCampaign(next), scan, grid }
  } finally {
    runningScans.delete(id)
  }
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
