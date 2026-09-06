import { randomBytes } from "node:crypto"
import {
  CampaignError,
  getCampaign,
  mapsPlaceUrlFromCampaign,
  saveCampaign,
  type Campaign,
  type GeoPoint,
  type TrafficJob,
} from "./campaigns.ts"
import { mergeHostedKeys, trafficRunnerConfigured } from "./hosted-keys.ts"
import { publicTrafficMessage } from "./public-copy.ts"
import { isSellerMode } from "./runtime.ts"
import { runMapsTrafficSession, type TrafficSessionResult } from "./scrappey-runner.ts"
import type { ApiKeys } from "./types.ts"

export const DEFAULT_TRAFFIC_SESSIONS = 3
export const MAX_TRAFFIC_SESSIONS = 20
export const TRAFFIC_REQUESTS_PER_SESSION = 2
export const TRAFFIC_CONCURRENCY = 2

function newId(): string {
  return randomBytes(8).toString("hex")
}

export function trafficRunnerMissingMessage() {
  return "Traffic runner is not configured."
}

export function listingNotReadyForTrafficMessage() {
  return "Confirm a Maps listing and finish a grid scan before starting traffic."
}

export function mapsKeywordNearUrl(keyword: string, lat: number, lng: number): string {
  const query = `${keyword.trim()} near ${lat},${lng}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function normalizeTrafficSessions(raw: unknown): number {
  if (raw == null || raw === "") return DEFAULT_TRAFFIC_SESSIONS
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) return DEFAULT_TRAFFIC_SESSIONS
  return Math.min(MAX_TRAFFIC_SESSIONS, value)
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

export function pickTrafficOrigins(campaign: Campaign, sessions: number): GeoPoint[] {
  const points = campaign.lastGridScan?.points ?? []
  const found = points.filter((point) => point.rank != null)
  const rest = points.filter((point) => point.rank == null)
  const pool = [...found, ...rest]
  const fallback = campaign.center || campaign.lastGridScan?.center || null
  const origins: GeoPoint[] = []
  for (let index = 0; index < sessions; index += 1) {
    if (pool.length > 0) {
      const pick = pool[Math.floor((index * pool.length) / sessions) % pool.length]!
      origins.push({ lat: pick.lat, lng: pick.lng })
    } else if (fallback) {
      origins.push(fallback)
    }
  }
  return origins
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

export async function runCampaignTraffic(
  id: string,
  rawKeys: ApiKeys,
  requestedSessions?: number,
  userId?: string | null,
): Promise<{ campaign: Campaign; traffic: TrafficJob }> {
  const campaign = getCampaign(id, userId)
  if (!campaign) throw new CampaignError("That campaign was not found.", 404)

  const listing = confirmedListingForTraffic(campaign)
  if (!listing) throw new CampaignError(listingNotReadyForTrafficMessage(), 400)

  const keys = mergeHostedKeys(rawKeys)
  if (!trafficRunnerConfigured(rawKeys) || !keys.scrappeyKey) {
    throw new CampaignError(trafficRunnerMissingMessage(), 400)
  }

  const sessions = normalizeTrafficSessions(requestedSessions)
  const origins = pickTrafficOrigins(campaign, sessions)
  if (origins.length === 0) throw new CampaignError(listingNotReadyForTrafficMessage(), 400)

  const startedAt = new Date().toISOString()
  let job: TrafficJob = {
    id: newId(),
    status: "running",
    startedAt,
    finishedAt: null,
    sessionsRequested: sessions,
    sessionsAttempted: 0,
    sessionsOk: 0,
    sessionsFailed: 0,
    requestCount: 0,
    lastError: null,
  }
  let next = saveCampaign({ ...campaign, lastTrafficJob: job, updatedAt: startedAt })

  const sessionResults: Array<TrafficSessionResult | undefined> = Array.from({ length: origins.length })
  const snapshotJob = () => {
    const done = sessionResults.filter((row): row is TrafficSessionResult => Boolean(row))
    const lastFail = [...done].reverse().find((row) => !row.ok)
    job = {
      ...job,
      sessionsAttempted: done.length,
      sessionsOk: done.filter((row) => row.ok).length,
      sessionsFailed: done.filter((row) => !row.ok).length,
      requestCount: done.reduce((sum, row) => sum + row.requestCount, 0),
      lastError: lastFail ? publicJobError(lastFail.error) : null,
    }
    next = saveCampaign({ ...next, lastTrafficJob: job, updatedAt: new Date().toISOString() })
  }

  await runPool(origins, TRAFFIC_CONCURRENCY, async (origin, index) => {
    sessionResults[index] = await runMapsTrafficSession({
      key: keys.scrappeyKey,
      searchUrl: mapsKeywordNearUrl(listing.keyword, origin.lat, origin.lng),
      listingUrl: listing.mapsUrl,
      listingTitle: listing.title,
      profileId: `pf-maps-${campaign.id.slice(0, 8)}-${index}-${newId().slice(0, 6)}`,
      sessionId: `pf-traffic-${campaign.id.slice(0, 8)}-${index}-${newId().slice(0, 6)}`,
    })
    snapshotJob()
  })

  job = {
    ...job,
    status: job.sessionsOk > 0 ? "ok" : "error",
    finishedAt: new Date().toISOString(),
    lastError: job.sessionsOk > 0 ? job.lastError : job.lastError || publicTrafficMessage("Traffic runner could not finish."),
  }
  next = saveCampaign({ ...next, lastTrafficJob: job, updatedAt: job.finishedAt })
  return { campaign: next, traffic: job }
}
