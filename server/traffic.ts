import { randomBytes } from "node:crypto"
import {
  CampaignError,
  getCampaign,
  keywordCapMessage,
  mapsPlaceUrlFromCampaign,
  MAX_KEYWORDS,
  readCampaigns,
  saveCampaign,
  type Campaign,
  type GridPointResult,
  type TrafficJob,
  type TrafficLogLine,
  type TrafficPinResult,
} from "./campaigns.ts"
import { mergeKeywordLists, parseKeywordText } from "../src/lib/keywords.ts"
import {
  DEFAULT_TRAFFIC_SEARCHES,
  MAX_TRAFFIC_SEARCHES,
  normalizeTrafficSearches,
  planTrafficPairs,
} from "../src/lib/traffic-plan.ts"
import { parseLocationCoordinate } from "./grid.ts"
import { defaultTrafficSchedule } from "./schedule.ts"
import { mergeHostedKeys, trafficRunnerConfigured } from "./hosted-keys.ts"
import { publicTrafficMessage } from "./public-copy.ts"
import { consumeMonthlyUsage, QuotaError } from "./usage.ts"
import { isSellerMode } from "./runtime.ts"
import {
  listingNotFoundMessage,
  listingNotInAreaMessage,
  runMapsTrafficSession,
  type TrafficSessionResult,
} from "./scrappey-runner.ts"
import type { ApiKeys } from "./types.ts"
import {
  campaignTrafficProfileId,
  parseTrafficVisitOptions,
  resolveTrafficDevice,
  trafficScheduleVisitFields,
  trafficVisitLogCopy,
  type TrafficVisitOptions,
} from "../src/lib/traffic-visit.ts"

export const DEFAULT_TRAFFIC_SESSIONS = DEFAULT_TRAFFIC_SEARCHES
export const MAX_TRAFFIC_SESSIONS = MAX_TRAFFIC_SEARCHES
export const TRAFFIC_REQUESTS_PER_SESSION = 2
export const TRAFFIC_CONCURRENCY = 2
export const MAX_TRAFFIC_LOG_LINES = 200
export { DEFAULT_TRAFFIC_SEARCHES, MAX_TRAFFIC_SEARCHES, normalizeTrafficSearches, planTrafficPairs }

type RunningHandle = {
  jobId: string
  abort: AbortController
  stopRequested: boolean
  done: Promise<void>
}

const runningJobs = new Map<string, RunningHandle>()

function newId(): string {
  return randomBytes(8).toString("hex")
}

export function trafficRunnerMissingMessage() {
  return "Traffic runner is not configured."
}

export function listingNotReadyForTrafficMessage() {
  return "Confirm a Maps listing and finish a grid scan before starting traffic."
}

export function noPinsSelectedMessage() {
  return "Select at least one pin"
}

export function noKeywordsSelectedMessage() {
  return "Add at least one keyword"
}

export function trafficAlreadyRunningMessage() {
  return "Traffic is already running for this campaign."
}

export function noRunningTrafficMessage() {
  return "No traffic job is running."
}

export function gridPinId(point: Pick<GridPointResult, "row" | "col">): string {
  return `${point.row}:${point.col}`
}

export function zoomFromCoordinate(value: string | undefined, fallback = 17): number {
  const parsed = value ? parseLocationCoordinate(value) : null
  return parsed?.zoom ?? fallback
}

export function mapsKeywordNearUrl(keyword: string, lat: number, lng: number, zoom = 17): string {
  const query = encodeURIComponent(keyword.trim())
  return `https://www.google.com/maps/search/${query}/@${lat},${lng},${zoom}z`
}

export function mapsKeywordAtPinUrl(
  keyword: string,
  pin: { lat: number; lng: number; locationCoordinate?: string },
): string {
  return mapsKeywordNearUrl(keyword, pin.lat, pin.lng, zoomFromCoordinate(pin.locationCoordinate))
}

export function normalizeTrafficSessions(raw: unknown): number {
  return normalizeTrafficSearches(raw)
}

export function normalizePinIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const item of raw) {
    const id = String(item ?? "").trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export type TrafficStartInput = {
  pinIds?: unknown
  keywords?: unknown
  keywordIds?: unknown
  searches?: unknown
  sessions?: unknown
  dwellSeconds?: unknown
  actionOrder?: unknown
  actions?: unknown
  device?: unknown
}

export function parseTrafficStartInput(raw: unknown): TrafficStartInput {
  if (Array.isArray(raw)) return { pinIds: raw }
  if (!raw || typeof raw !== "object") return {}
  const body = raw as TrafficStartInput
  return {
    pinIds: body.pinIds,
    keywords: body.keywords,
    keywordIds: body.keywordIds,
    searches: body.searches,
    sessions: body.sessions,
    dwellSeconds: body.dwellSeconds,
    actionOrder: body.actionOrder,
    actions: body.actions,
    device: body.device,
  }
}

export function visitOptionsFromStart(input: TrafficStartInput, fallback?: Partial<TrafficVisitOptions> | null): TrafficVisitOptions {
  return parseTrafficVisitOptions({
    dwellSeconds: input.dwellSeconds ?? fallback?.dwellSeconds,
    actionOrder: input.actionOrder ?? fallback?.actionOrder,
    actions: input.actions ?? fallback?.actions,
    device: input.device ?? fallback?.device,
  })
}

export function requestedTrafficSearches(input: TrafficStartInput, fallback?: unknown): number {
  return normalizeTrafficSearches(input.searches ?? input.sessions ?? fallback)
}

export function campaignKeywordId(keyword: string, index: number): string {
  return `${index}:${keyword.trim().toLowerCase()}`
}

export function listedTrafficKeywords(campaign: Campaign): string[] {
  if (campaign.keywords.length > 0) return campaign.keywords
  const fromScan = campaign.lastGridScan?.keywords?.length
    ? campaign.lastGridScan.keywords
    : (campaign.lastGridScan?.keyword || campaign.businessName || "").trim()
  return typeof fromScan === "string" ? (fromScan ? [fromScan] : []) : fromScan
}

function trafficKeywordTokens(raw: unknown): string[] {
  if (raw == null) return []
  if (typeof raw === "string") return parseKeywordText(raw)
  if (!Array.isArray(raw)) return []
  const tokens: string[] = []
  for (const item of raw) {
    const token = String(item ?? "").trim()
    if (!token) continue
    if (/^\d+$/.test(token) || /^\d+:/.test(token)) {
      tokens.push(token)
      continue
    }
    tokens.push(...parseKeywordText(token))
  }
  return tokens
}

export function selectTrafficKeywords(
  campaign: Campaign,
  input?: { keywords?: unknown; keywordIds?: unknown },
): string[] {
  const listed = listedTrafficKeywords(campaign)
  const specified = Boolean(input && (input.keywords !== undefined || input.keywordIds !== undefined))
  if (!specified) return listed
  if (input?.keywords === undefined && input?.keywordIds === undefined) return []
  if (
    input?.keywords !== undefined &&
    !Array.isArray(input.keywords) &&
    typeof input.keywords !== "string" &&
    input?.keywordIds === undefined
  ) {
    return []
  }
  if (
    input?.keywordIds !== undefined &&
    !Array.isArray(input.keywordIds) &&
    typeof input.keywordIds !== "string" &&
    input?.keywords === undefined
  ) {
    return []
  }

  const requested = [...trafficKeywordTokens(input?.keywordIds), ...trafficKeywordTokens(input?.keywords)]
  if (requested.length === 0) return []

  const byLower = new Map(listed.map((keyword) => [keyword.toLowerCase(), keyword]))
  const picked = new Set<string>()
  const extras: string[] = []
  for (const token of requested) {
    if (/^\d+$/.test(token)) {
      const match = listed[Number(token)]
      if (match) picked.add(match.toLowerCase())
      continue
    }
    const indexed = token.match(/^(\d+):(.+)$/)
    if (indexed) {
      const match = listed[Number(indexed[1])] || byLower.get(indexed[2]!.toLowerCase())
      if (match) picked.add(match.toLowerCase())
      continue
    }
    const match = byLower.get(token.toLowerCase())
    if (match) {
      picked.add(match.toLowerCase())
      continue
    }
    if (!extras.some((row) => row.toLowerCase() === token.toLowerCase())) extras.push(token)
  }
  return [...listed.filter((keyword) => picked.has(keyword.toLowerCase())), ...extras]
}

export function pinCoordLabel(pin: { lat: number; lng: number }): string {
  return `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
}

export function trafficPairLabel(keyword: string, pin: { lat: number; lng: number }): string {
  return `“${keyword}” · ${pinCoordLabel(pin)}`
}

export type TrafficPair = TrafficOrigin & {
  keyword: string
}

export function pairsForTraffic(pins: TrafficOrigin[], keywords: string[]): TrafficPair[] {
  const pairs: TrafficPair[] = []
  for (const pin of pins) {
    for (const keyword of keywords) {
      pairs.push({ ...pin, keyword })
    }
  }
  return pairs
}

export function confirmedListingForTraffic(campaign: Campaign): {
  title: string
  mapsUrl: string
  keyword: string
  placeId: string
  cid: string | null
} | null {
  const placeId = campaign.placeId?.trim() ?? ""
  const scanned = Boolean(campaign.lastGridScan || campaign.lastScan)
  if (!placeId || !scanned) return null

  const grid = campaign.lastGridScan
  const foundPoint = grid?.points.find((point) => point.rank != null && (point.placeId === placeId || point.mapsUrl))
  const scanHit = campaign.lastScan?.results.find((row) => row.rank != null && row.mapsUrl)
  const title = campaign.listingTitle || foundPoint?.listingTitle || scanHit?.listingTitle || campaign.businessName
  const mapsUrl = mapsPlaceUrlFromCampaign(
    campaign,
    title,
    foundPoint?.address || scanHit?.address || campaign.listingAddress || "",
  ) || foundPoint?.mapsUrl || scanHit?.mapsUrl
  if (!mapsUrl) return null
  return {
    title,
    mapsUrl,
    placeId,
    cid: foundPoint?.cid ?? null,
    keyword: grid?.keyword || campaign.keywords[0] || campaign.businessName,
  }
}

export type TrafficOrigin = {
  pinId: string
  row: number
  col: number
  lat: number
  lng: number
  locationCoordinate?: string
}

export function pinsForTraffic(campaign: Campaign, pinIds: string[]): TrafficOrigin[] {
  const points = campaign.lastGridScan?.points ?? []
  const byId = new Map(points.map((point) => [gridPinId(point), point]))
  const selected: TrafficOrigin[] = []
  for (const pinId of pinIds) {
    const point = byId.get(pinId)
    if (!point) continue
    selected.push({
      pinId,
      row: point.row,
      col: point.col,
      lat: point.lat,
      lng: point.lng,
      locationCoordinate: point.locationCoordinate,
    })
  }
  return selected
}

export function pickTrafficOrigins(campaign: Campaign, sessions: number): TrafficOrigin[] {
  const points = campaign.lastGridScan?.points ?? []
  const found = points.filter((point) => point.rank != null)
  const rest = points.filter((point) => point.rank == null)
  const pool = [...found, ...rest]
  const fallback = campaign.center || campaign.lastGridScan?.center || null
  const origins: TrafficOrigin[] = []
  for (let index = 0; index < sessions; index += 1) {
    if (pool.length > 0) {
      const pick = pool[Math.floor((index * pool.length) / sessions) % pool.length]!
      origins.push({
        pinId: gridPinId(pick),
        row: pick.row,
        col: pick.col,
        lat: pick.lat,
        lng: pick.lng,
        locationCoordinate: pick.locationCoordinate,
      })
    } else if (fallback) {
      origins.push({
        pinId: `center:${index}`,
        row: 0,
        col: 0,
        lat: fallback.lat,
        lng: fallback.lng,
      })
    }
  }
  return origins
}

export function emptyTrafficJob(): TrafficJob {
  return {
    id: "",
    status: "error",
    startedAt: "",
    finishedAt: null,
    sessionsRequested: 0,
    sessionsAttempted: 0,
    sessionsOk: 0,
    sessionsFailed: 0,
    requestCount: 0,
    lastError: null,
    pinIds: [],
    keywords: [],
    keywordIds: [],
    log: [],
    results: [],
  }
}

export function normalizeTrafficJob(job: TrafficJob | null | undefined): TrafficJob | null {
  if (!job) return null
  return {
    ...emptyTrafficJob(),
    ...job,
    pinIds: Array.isArray(job.pinIds) ? job.pinIds : [],
    keywords: Array.isArray(job.keywords) ? job.keywords : [],
    keywordIds: Array.isArray(job.keywordIds) ? job.keywordIds : [],
    log: Array.isArray(job.log) ? job.log.slice(-MAX_TRAFFIC_LOG_LINES) : [],
    results: Array.isArray(job.results) ? job.results : [],
  }
}

export function appendTrafficLog(job: TrafficJob, message: string, pinId?: string, keyword?: string): TrafficJob {
  const line: TrafficLogLine = {
    at: new Date().toISOString(),
    message: publicTrafficMessage(message),
    ...(pinId ? { pinId } : {}),
    ...(keyword ? { keyword } : {}),
  }
  const log = [...(job.log ?? []), line].slice(-MAX_TRAFFIC_LOG_LINES)
  return { ...job, log }
}

async function runPool<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let next = 0
  const width = Math.max(1, Math.min(limit, items.length || 1))
  await Promise.all(
    Array.from({ length: width }, async () => {
      while (next < items.length) {
        const index = next
        next += 1
        await worker(items[index]!, index)
      }
    }),
  )
}

function publicJobError(message: string | null): string | null {
  if (!message) return null
  return isSellerMode() ? message : publicTrafficMessage(message)
}

function persistJob(campaignId: string, jobId: string, mutate: (job: TrafficJob, campaign: Campaign) => TrafficJob): TrafficJob | null {
  const campaign = getCampaign(campaignId)
  if (!campaign) return null
  const current = normalizeTrafficJob(campaign.lastTrafficJob)
  if (!current || current.id !== jobId) return null
  let nextJob = mutate(current, campaign)
  if (current.status === "stopped" && nextJob.status !== "stopped") {
    nextJob = { ...nextJob, status: "stopped", finishedAt: nextJob.finishedAt || current.finishedAt }
  }
  saveCampaign({ ...campaign, lastTrafficJob: nextJob, updatedAt: new Date().toISOString() })
  return nextJob
}

function handleFor(campaignId: string, jobId: string): RunningHandle | null {
  const handle = runningJobs.get(campaignId)
  if (!handle || handle.jobId !== jobId) return null
  return handle
}

export function getCampaignTraffic(
  id: string,
  userId?: string | null,
): { campaign: Campaign; traffic: TrafficJob | null } {
  const campaign = getCampaign(id, userId)
  if (!campaign) throw new CampaignError("That campaign was not found.", 404)
  return { campaign, traffic: normalizeTrafficJob(campaign.lastTrafficJob) }
}

export function stopCampaignTraffic(
  id: string,
  userId?: string | null,
): { campaign: Campaign; traffic: TrafficJob } {
  const campaign = getCampaign(id, userId)
  if (!campaign) throw new CampaignError("That campaign was not found.", 404)
  const job = normalizeTrafficJob(campaign.lastTrafficJob)
  if (!job || job.status !== "running") {
    throw new CampaignError(noRunningTrafficMessage(), 400)
  }

  const handle = handleFor(campaign.id, job.id)
  if (handle) {
    handle.stopRequested = true
    handle.abort.abort()
  }

  const now = new Date().toISOString()
  const nextJob = persistJob(campaign.id, job.id, (current) => {
    const results = (current.results ?? []).map((row) =>
      row.status === "pending" || row.status === "running"
        ? { ...row, status: "cancelled" as const, finishedAt: row.finishedAt || now }
        : row,
    )
    return appendTrafficLog(
      {
        ...current,
        status: "stopped",
        finishedAt: now,
        results,
      },
      "Stop requested. Remaining keyword and pin pairs were cancelled.",
    )
  })
  const latest = getCampaign(id, userId)
  if (!latest || !nextJob) throw new CampaignError(noRunningTrafficMessage(), 400)
  return { campaign: latest, traffic: nextJob }
}

function createPendingResults(pairs: TrafficPair[]): TrafficPinResult[] {
  return pairs.map((pair) => ({
    pinId: pair.pinId,
    keyword: pair.keyword,
    row: pair.row,
    col: pair.col,
    lat: pair.lat,
    lng: pair.lng,
    status: "pending",
    finishedAt: null,
  }))
}

function snapshotFromSessions(
  job: TrafficJob,
  sessionResults: Array<TrafficSessionResult | undefined>,
  pinResults: TrafficPinResult[],
): TrafficJob {
  const done = sessionResults.filter((row): row is TrafficSessionResult => Boolean(row))
  const lastFail = [...done].reverse().find((row) => !row.ok)
  return {
    ...job,
    sessionsAttempted: done.length,
    sessionsOk: done.filter((row) => row.ok).length,
    sessionsFailed: done.filter((row) => !row.ok).length,
    requestCount: done.reduce((sum, row) => sum + row.requestCount, 0),
    lastError: lastFail ? publicJobError(lastFail.error) : job.lastError,
    results: pinResults,
  }
}

function cancelRemainingPairs(
  pairs: TrafficPair[],
  pinResults: TrafficPinResult[],
  pinId: string,
  fromIndex: number,
  now: string,
): TrafficPair[] {
  const cancelled: TrafficPair[] = []
  for (let index = fromIndex; index < pairs.length; index += 1) {
    const pair = pairs[index]
    if (!pair || pair.pinId !== pinId) continue
    const current = pinResults[index]
    if (!current || current.status === "ok" || current.status === "fail" || current.status === "cancelled") continue
    pinResults[index] = { ...current, status: "cancelled", finishedAt: now }
    cancelled.push(pair)
  }
  return cancelled
}

async function executeTrafficJob(input: {
  campaignId: string
  jobId: string
  key: string
  listing: { title: string; mapsUrl: string; placeId: string; cid: string | null }
  pins: TrafficOrigin[]
  keywords: string[]
  pairs: TrafficPair[]
  availablePairCount: number
  visit: TrafficVisitOptions
  signal: AbortSignal
}) {
  const pairs = input.pairs
  const sessionResults: Array<TrafficSessionResult | undefined> = Array.from({ length: pairs.length })
  const pinResults = createPendingResults(pairs)

  persistJob(input.campaignId, input.jobId, (job) =>
    appendTrafficLog(
      job,
      input.availablePairCount > input.pairs.length
        ? `Traffic started: ${input.pairs.length} of ${input.availablePairCount} searches (${input.pins.length} pin${input.pins.length === 1 ? "" : "s"} × ${input.keywords.length} keyword${input.keywords.length === 1 ? "" : "s"}, first pairs in listed order). Stop cancels remaining searches.`
        : `Traffic started for ${input.pins.length} selected pin${input.pins.length === 1 ? "" : "s"} × ${input.keywords.length} keyword${input.keywords.length === 1 ? "" : "s"}. Each pin searches keywords in listed order, then opens the confirmed listing.`,
    ),
  )

  await runPool(input.pins, TRAFFIC_CONCURRENCY, async (pin) => {
    const pinPairs = input.pairs
      .map((pair, index) => ({ pair, index }))
      .filter((row) => row.pair.pinId === pin.pinId)
    for (const { pair, index } of pinPairs) {
      const keyword = pair.keyword
      const label = trafficPairLabel(keyword, pin)
      const handle = handleFor(input.campaignId, input.jobId)
      if (handle?.stopRequested || input.signal.aborted) {
        const now = new Date().toISOString()
        const remaining = cancelRemainingPairs(pairs, pinResults, pin.pinId, index, now)
        persistJob(input.campaignId, input.jobId, (job) => {
          let next = snapshotFromSessions(job, sessionResults, pinResults)
          for (const cancelled of remaining.length ? remaining : [pair]) {
            next = appendTrafficLog(
              next,
              `${trafficPairLabel(cancelled.keyword, cancelled)} · cancelled.`,
              cancelled.pinId,
              cancelled.keyword,
            )
          }
          return next
        })
        return
      }

      pinResults[index] = { ...pinResults[index]!, status: "running" }
      persistJob(input.campaignId, input.jobId, (job) =>
        appendTrafficLog(
          snapshotFromSessions(job, sessionResults, pinResults),
          `Started pin ${pin.pinId} at ${pinCoordLabel(pin)} · “${keyword}”.`,
          pin.pinId,
          keyword,
        ),
      )
      persistJob(input.campaignId, input.jobId, (job) =>
        appendTrafficLog(
          job,
          `searching ${keyword} at ${pin.lat},${pin.lng}`,
          pin.pinId,
          keyword,
        ),
      )

      const device = resolveTrafficDevice(input.visit)
      const result = await runMapsTrafficSession({
        key: input.key,
        searchUrl: mapsKeywordAtPinUrl(keyword, pin),
        listingUrl: input.listing.mapsUrl,
        listingTitle: input.listing.title,
        listingPlaceId: input.listing.placeId,
        listingCid: input.listing.cid,
        profileId: campaignTrafficProfileId(input.campaignId, device),
        sessionId: `pf-traffic-${input.campaignId.slice(0, 8)}-${index}-${newId().slice(0, 6)}`,
        dwellSeconds: input.visit.dwellSeconds,
        actionOrder: input.visit.actionOrder,
        actions: input.visit.actions,
        device: input.visit.device,
        signal: input.signal,
      })
      sessionResults[index] = result
      const now = new Date().toISOString()
      pinResults[index] = {
        ...pinResults[index]!,
        status: result.ok ? "ok" : handleFor(input.campaignId, input.jobId)?.stopRequested ? "cancelled" : "fail",
        finishedAt: now,
      }

      persistJob(input.campaignId, input.jobId, (job) => {
        let next = snapshotFromSessions(job, sessionResults, pinResults)
        if (result.ok) {
          next = appendTrafficLog(next, `opened ${result.openedTitle || input.listing.title} · ${pinCoordLabel(pin)}`, pin.pinId, keyword)
          next = appendTrafficLog(
            next,
            result.visitError
              ? `${result.visitError} · ${pinCoordLabel(pin)}`
              : `${trafficVisitLogCopy(input.visit, device)} · ${pinCoordLabel(pin)}`,
            pin.pinId,
            keyword,
          )
          next = appendTrafficLog(next, `${label} · Session finished.`, pin.pinId, keyword)
        } else {
          const fail = publicJobError(result.error) || listingNotFoundMessage()
          if (fail === listingNotInAreaMessage() || fail === listingNotFoundMessage()) {
            next = appendTrafficLog(next, `${fail} · ${pinCoordLabel(pin)}`, pin.pinId, keyword)
          }
          next = appendTrafficLog(next, `${label} · Session failed. ${fail}`, pin.pinId, keyword)
        }
        return next
      })
    }
  })

  persistJob(input.campaignId, input.jobId, (job) => {
    if (job.status === "stopped") {
      return snapshotFromSessions(job, sessionResults, pinResults)
    }
    const next = snapshotFromSessions(job, sessionResults, pinResults)
    const ok = next.sessionsOk > 0
    return {
      ...next,
      status: ok ? "ok" : "error",
      finishedAt: new Date().toISOString(),
      lastError: ok ? next.lastError : next.lastError || publicTrafficMessage("Traffic runner could not finish."),
    }
  })
}

export function startCampaignTraffic(
  id: string,
  rawKeys: ApiKeys,
  pinIds?: string[] | TrafficStartInput | unknown,
  userId?: string | null,
): { campaign: Campaign; traffic: TrafficJob } {
  const campaign = getCampaign(id, userId)
  if (!campaign) throw new CampaignError("That campaign was not found.", 404)

  const listing = confirmedListingForTraffic(campaign)
  if (!listing) throw new CampaignError(listingNotReadyForTrafficMessage(), 400)

  const keys = mergeHostedKeys(rawKeys)
  if (!trafficRunnerConfigured(rawKeys) || !keys.scrappeyKey) {
    throw new CampaignError(trafficRunnerMissingMessage(), 400)
  }

  const startInput = parseTrafficStartInput(pinIds)
  const requestedIds = normalizePinIds(startInput.pinIds)
  const pins = pinsForTraffic(campaign, requestedIds)
  if (pins.length === 0) throw new CampaignError(noPinsSelectedMessage(), 400)

  const keywords = selectTrafficKeywords(campaign, startInput)
  if (keywords.length === 0) throw new CampaignError(noKeywordsSelectedMessage(), 400)
  if (keywords.length > MAX_KEYWORDS) throw new CampaignError(keywordCapMessage())

  const persistedKeywords = mergeKeywordLists(campaign.keywords, keywords)
  if (persistedKeywords.length > MAX_KEYWORDS) throw new CampaignError(keywordCapMessage())

  const current = normalizeTrafficJob(campaign.lastTrafficJob)
  if (current?.status === "running" && runningJobs.has(campaign.id)) {
    throw new CampaignError(trafficAlreadyRunningMessage(), 409)
  }

  const searches = requestedTrafficSearches(startInput, campaign.trafficSchedule?.lastSearchCount)
  const visit = visitOptionsFromStart(startInput, {
    dwellSeconds: campaign.trafficSchedule?.lastDwellSeconds,
    actionOrder: campaign.trafficSchedule?.lastActionOrder,
    actions: campaign.trafficSchedule?.lastActions,
    device: campaign.trafficSchedule?.lastDevice,
  })
  const availablePairs = pairsForTraffic(pins, keywords)
  const pairs = planTrafficPairs(availablePairs, searches)
  try {
    consumeMonthlyUsage(userId || campaign.userId, "trafficCampaigns")
  } catch (error) {
    if (error instanceof QuotaError) throw new CampaignError(error.message, error.status)
    throw error
  }
  const startedAt = new Date().toISOString()
  const job: TrafficJob = {
    id: newId(),
    status: "running",
    startedAt,
    finishedAt: null,
    sessionsRequested: pairs.length,
    sessionsAttempted: 0,
    sessionsOk: 0,
    sessionsFailed: 0,
    requestCount: 0,
    lastError: null,
    pinIds: pins.map((pin) => pin.pinId),
    keywords,
    keywordIds: keywords.map((keyword, index) => campaignKeywordId(keyword, index)),
    log: [],
    results: createPendingResults(pairs),
    dwellSeconds: visit.dwellSeconds,
    actionOrder: visit.actionOrder,
    actions: visit.actions,
    device: visit.device,
  }
  const trafficSchedule = {
    ...(campaign.trafficSchedule ?? defaultTrafficSchedule()),
    lastSelectedPinIds: pins.map((pin) => pin.pinId),
    lastSelectedKeywords: keywords,
    lastSearchCount: searches,
    ...trafficScheduleVisitFields(visit),
  }
  const next = saveCampaign({
    ...campaign,
    keywords: persistedKeywords,
    lastTrafficJob: job,
    trafficSchedule,
    updatedAt: startedAt,
  })

  const abort = new AbortController()
  const handle: RunningHandle = {
    jobId: job.id,
    abort,
    stopRequested: false,
    done: Promise.resolve(),
  }
  handle.done = executeTrafficJob({
    campaignId: next.id,
    jobId: job.id,
    key: keys.scrappeyKey,
    listing,
    pins,
    keywords,
    pairs,
    availablePairCount: availablePairs.length,
    visit,
    signal: abort.signal,
  }).catch((error) => {
    persistJob(next.id, job.id, (currentJob) =>
      appendTrafficLog(
        {
          ...currentJob,
          status: currentJob.status === "stopped" ? "stopped" : "error",
          finishedAt: currentJob.finishedAt || new Date().toISOString(),
          lastError: publicJobError(error instanceof Error ? error.message : "Traffic runner could not finish."),
        },
        "Traffic stopped with an unexpected error.",
      ),
    )
  })
  runningJobs.set(next.id, handle)
  void handle.done.finally(() => {
    const currentHandle = runningJobs.get(next.id)
    if (currentHandle?.jobId === job.id) runningJobs.delete(next.id)
  })

  return { campaign: next, traffic: job }
}

export async function runCampaignTraffic(
  id: string,
  rawKeys: ApiKeys,
  pinIds?: string[] | unknown,
  userId?: string | null,
): Promise<{ campaign: Campaign; traffic: TrafficJob }> {
  const started = startCampaignTraffic(id, rawKeys, pinIds, userId)
  const handle = runningJobs.get(started.campaign.id)
  if (handle) await handle.done
  const campaign = getCampaign(id, userId)
  if (!campaign?.lastTrafficJob) return started
  return { campaign, traffic: normalizeTrafficJob(campaign.lastTrafficJob)! }
}

export function recoverStaleTrafficJobs(): number {
  let recovered = 0
  for (const campaign of readCampaigns()) {
    const job = normalizeTrafficJob(campaign.lastTrafficJob)
    if (!job || job.status !== "running") continue
    if (runningJobs.has(campaign.id)) continue
    const now = new Date().toISOString()
    persistJob(campaign.id, job.id, (current) =>
      appendTrafficLog(
        {
          ...current,
          status: "error",
          finishedAt: now,
          lastError: "Traffic stopped because the server restarted. Start again if you still want those searches.",
          results: (current.results ?? []).map((row) =>
            row.status === "pending" || row.status === "running"
              ? { ...row, status: "cancelled" as const, finishedAt: row.finishedAt || now }
              : row,
          ),
        },
        "Traffic stopped because the server restarted. Remaining searches were cancelled.",
      ),
    )
    recovered += 1
  }
  return recovered
}

export async function resetTrafficRuntimeForTests() {
  for (const handle of runningJobs.values()) {
    handle.stopRequested = true
    handle.abort.abort()
  }
  await Promise.allSettled([...runningJobs.values()].map((handle) => handle.done))
  runningJobs.clear()
}
