import { randomBytes } from "node:crypto"
import {
  CampaignError,
  getCampaign,
  mapsPlaceUrlFromCampaign,
  saveCampaign,
  type Campaign,
  type GridPointResult,
  type TrafficJob,
  type TrafficLogLine,
  type TrafficPinResult,
} from "./campaigns.ts"
import { parseLocationCoordinate } from "./grid.ts"
import { mergeHostedKeys, trafficRunnerConfigured } from "./hosted-keys.ts"
import { publicTrafficMessage } from "./public-copy.ts"
import { isSellerMode } from "./runtime.ts"
import { runMapsTrafficSession, type TrafficSessionResult } from "./scrappey-runner.ts"
import type { ApiKeys } from "./types.ts"

export const DEFAULT_TRAFFIC_SESSIONS = 3
export const MAX_TRAFFIC_SESSIONS = 49
export const TRAFFIC_REQUESTS_PER_SESSION = 2
export const TRAFFIC_CONCURRENCY = 2
export const MAX_TRAFFIC_LOG_LINES = 200

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
  if (raw == null || raw === "") return DEFAULT_TRAFFIC_SESSIONS
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) return DEFAULT_TRAFFIC_SESSIONS
  return Math.min(MAX_TRAFFIC_SESSIONS, value)
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

export function confirmedListingForTraffic(campaign: Campaign): {
  title: string
  mapsUrl: string
  keyword: string
} | null {
  const placeId = campaign.placeId?.trim() ?? ""
  const scanned = Boolean(campaign.lastGridScan || campaign.lastScan)
  if (!placeId || !scanned) return null

  const grid = campaign.lastGridScan
  const foundPoint = grid?.points.find((point) => point.rank != null && point.mapsUrl)
  const scanHit = campaign.lastScan?.results.find((row) => row.rank != null && row.mapsUrl)
  const title = foundPoint?.listingTitle || scanHit?.listingTitle || campaign.listingTitle || campaign.businessName
  const mapsUrl =
    foundPoint?.mapsUrl ||
    scanHit?.mapsUrl ||
    mapsPlaceUrlFromCampaign(campaign, title, foundPoint?.address || scanHit?.address || campaign.listingAddress || "")
  if (!mapsUrl) return null
  return {
    title,
    mapsUrl,
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
    log: Array.isArray(job.log) ? job.log.slice(-MAX_TRAFFIC_LOG_LINES) : [],
    results: Array.isArray(job.results) ? job.results : [],
  }
}

export function appendTrafficLog(job: TrafficJob, message: string, pinId?: string): TrafficJob {
  const line: TrafficLogLine = {
    at: new Date().toISOString(),
    message,
    ...(pinId ? { pinId } : {}),
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
      "Stop requested. Remaining sessions were cancelled.",
    )
  })
  const latest = getCampaign(id, userId)
  if (!latest || !nextJob) throw new CampaignError(noRunningTrafficMessage(), 400)
  return { campaign: latest, traffic: nextJob }
}

function createPendingResults(pins: TrafficOrigin[]): TrafficPinResult[] {
  return pins.map((pin) => ({
    pinId: pin.pinId,
    row: pin.row,
    col: pin.col,
    lat: pin.lat,
    lng: pin.lng,
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

async function executeTrafficJob(input: {
  campaignId: string
  jobId: string
  key: string
  listing: { title: string; mapsUrl: string; keyword: string }
  pins: TrafficOrigin[]
  signal: AbortSignal
}) {
  const sessionResults: Array<TrafficSessionResult | undefined> = Array.from({ length: input.pins.length })
  const pinResults = createPendingResults(input.pins)

  persistJob(input.campaignId, input.jobId, (job) =>
    appendTrafficLog(job, `Traffic started for ${input.pins.length} selected pin${input.pins.length === 1 ? "" : "s"}.`),
  )

  await runPool(input.pins, TRAFFIC_CONCURRENCY, async (pin, index) => {
    const handle = handleFor(input.campaignId, input.jobId)
    if (handle?.stopRequested || input.signal.aborted) {
      pinResults[index] = { ...pinResults[index]!, status: "cancelled", finishedAt: new Date().toISOString() }
      persistJob(input.campaignId, input.jobId, (job) =>
        appendTrafficLog(
          snapshotFromSessions(job, sessionResults, pinResults),
          `Pin ${pin.pinId} · ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)} · cancelled.`,
          pin.pinId,
        ),
      )
      return
    }

    pinResults[index] = { ...pinResults[index]!, status: "running" }
    persistJob(input.campaignId, input.jobId, (job) =>
      appendTrafficLog(
        snapshotFromSessions(job, sessionResults, pinResults),
        `Started pin ${pin.pinId} at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}.`,
        pin.pinId,
      ),
    )
    persistJob(input.campaignId, input.jobId, (job) =>
      appendTrafficLog(job, `Searching Maps for “${input.listing.keyword}” from this pin.`, pin.pinId),
    )

    const result = await runMapsTrafficSession({
      key: input.key,
      searchUrl: mapsKeywordAtPinUrl(input.listing.keyword, pin),
      listingUrl: input.listing.mapsUrl,
      listingTitle: input.listing.title,
      profileId: `pf-maps-${input.campaignId.slice(0, 8)}-${index}-${newId().slice(0, 6)}`,
      sessionId: `pf-traffic-${input.campaignId.slice(0, 8)}-${index}-${newId().slice(0, 6)}`,
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
        next = appendTrafficLog(next, "Listing opened.", pin.pinId)
        next = appendTrafficLog(next, "Session finished.", pin.pinId)
      } else {
        const fail = publicJobError(result.error) || "Session failed."
        next = appendTrafficLog(next, `Session failed. ${fail}`, pin.pinId)
      }
      return next
    })
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
  pinIds?: string[] | unknown,
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

  const requestedIds = normalizePinIds(pinIds)
  const pins = pinsForTraffic(campaign, requestedIds)
  if (pins.length === 0) throw new CampaignError(noPinsSelectedMessage(), 400)

  const current = normalizeTrafficJob(campaign.lastTrafficJob)
  if (current?.status === "running" && runningJobs.has(campaign.id)) {
    throw new CampaignError(trafficAlreadyRunningMessage(), 409)
  }

  const startedAt = new Date().toISOString()
  const job: TrafficJob = {
    id: newId(),
    status: "running",
    startedAt,
    finishedAt: null,
    sessionsRequested: pins.length,
    sessionsAttempted: 0,
    sessionsOk: 0,
    sessionsFailed: 0,
    requestCount: 0,
    lastError: null,
    pinIds: pins.map((pin) => pin.pinId),
    log: [],
    results: createPendingResults(pins),
  }
  const next = saveCampaign({ ...campaign, lastTrafficJob: job, updatedAt: startedAt })

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

export async function resetTrafficRuntimeForTests() {
  for (const handle of runningJobs.values()) {
    handle.stopRequested = true
    handle.abort.abort()
  }
  await Promise.allSettled([...runningJobs.values()].map((handle) => handle.done))
  runningJobs.clear()
}
