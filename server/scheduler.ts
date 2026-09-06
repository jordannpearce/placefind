import { emptyApiKeys, mapsScanConfigured, trafficRunnerConfigured } from "./hosted-keys.ts"
import {
  CampaignError,
  getCampaign,
  hasConfirmedListing,
  isScanRunning,
  readCampaigns,
  saveCampaign,
  scanCampaign,
  type Campaign,
} from "./campaigns.ts"
import { gridPinId } from "../src/lib/grid.ts"
import { nextRunAt, scheduleDue, type ScanSchedule, type TrafficSchedule } from "./schedule.ts"
import { startCampaignTraffic } from "./traffic.ts"

export const SCHEDULER_INTERVAL_MS = 60_000
export { nextRunAt, scheduleDue }

export function scheduledScanKeyword(campaign: Campaign): string {
  return (campaign.lastGridScan?.keyword || campaign.keywords[0] || "").trim()
}

export function scheduledTrafficPinIds(campaign: Campaign): string[] {
  const schedule = campaign.trafficSchedule
  if (!schedule) return []
  if (schedule.pinMode === "all_found") {
    return (campaign.lastGridScan?.points ?? [])
      .filter((point) => point.rank != null)
      .map((point) => gridPinId(point))
  }
  return Array.isArray(schedule.lastSelectedPinIds) ? schedule.lastSelectedPinIds.map(String) : []
}

function stampSchedule<T extends ScanSchedule | TrafficSchedule>(schedule: T, now: Date): T {
  return {
    ...schedule,
    lastRunAt: now.toISOString(),
    nextRunAt: nextRunAt(schedule, now).toISOString(),
  }
}

async function runDueScan(campaign: Campaign, now: Date) {
  if (!hasConfirmedListing(campaign)) {
    console.log(`PlaceFind scheduler: skip scan for ${campaign.id}; listing is not confirmed.`)
    return
  }
  if (isScanRunning(campaign.id)) {
    console.log(`PlaceFind scheduler: skip scan for ${campaign.id}; a scan is already running.`)
    return
  }
  const keyword = scheduledScanKeyword(campaign)
  if (!keyword) {
    console.log(`PlaceFind scheduler: skip scan for ${campaign.id}; no keyword.`)
    return
  }
  if (!mapsScanConfigured(emptyApiKeys())) {
    console.log(`PlaceFind scheduler: skip scan for ${campaign.id}; Maps search is not configured.`)
    return
  }
  const latest = getCampaign(campaign.id)
  if (!latest?.scanSchedule) return
  saveCampaign({
    ...latest,
    scanSchedule: stampSchedule(latest.scanSchedule, now),
    updatedAt: now.toISOString(),
  })
  console.log(`PlaceFind scheduler: starting scan for ${campaign.id} (${campaign.name}).`)
  try {
    await scanCampaign(campaign.id, emptyApiKeys(), [keyword], campaign.userId)
    const after = getCampaign(campaign.id)
    if (after?.scanSchedule) {
      saveCampaign({
        ...after,
        scanSchedule: { ...after.scanSchedule, nextRunAt: nextRunAt(after.scanSchedule, new Date()).toISOString() },
      })
    }
  } catch (error) {
    const message = error instanceof CampaignError ? error.message : "Scan failed."
    console.log(`PlaceFind scheduler: scan for ${campaign.id} failed. ${message}`)
  }
}

function runDueTraffic(campaign: Campaign, now: Date) {
  if (!hasConfirmedListing(campaign)) {
    console.log(`PlaceFind scheduler: skip traffic for ${campaign.id}; listing is not confirmed.`)
    return
  }
  if (campaign.lastTrafficJob?.status === "running") {
    console.log(`PlaceFind scheduler: skip traffic for ${campaign.id}; traffic is already running.`)
    return
  }
  if (!trafficRunnerConfigured(emptyApiKeys())) {
    console.log(`PlaceFind scheduler: skip traffic for ${campaign.id}; traffic runner is not configured.`)
    return
  }
  const pinIds = scheduledTrafficPinIds(campaign)
  if (pinIds.length === 0) {
    console.log(`PlaceFind scheduler: skip traffic for ${campaign.id}; no pins to run.`)
    return
  }
  const latest = getCampaign(campaign.id)
  if (!latest?.trafficSchedule) return
  saveCampaign({
    ...latest,
    trafficSchedule: stampSchedule(latest.trafficSchedule, now),
    updatedAt: now.toISOString(),
  })
  console.log(`PlaceFind scheduler: starting traffic for ${campaign.id} (${campaign.name}).`)
  try {
    startCampaignTraffic(campaign.id, emptyApiKeys(), pinIds, campaign.userId)
  } catch (error) {
    const message = error instanceof CampaignError ? error.message : "Traffic failed."
    console.log(`PlaceFind scheduler: traffic for ${campaign.id} failed. ${message}`)
  }
}

export async function tickScheduler(now = new Date()): Promise<{ scans: number; traffic: number }> {
  const campaigns = readCampaigns()
  let scans = 0
  let traffic = 0
  for (const campaign of campaigns) {
    if (campaign.scanSchedule && scheduleDue(campaign.scanSchedule, now)) {
      scans += 1
      await runDueScan(campaign, now)
    }
    const latest = getCampaign(campaign.id) ?? campaign
    if (latest.trafficSchedule && scheduleDue(latest.trafficSchedule, now)) {
      traffic += 1
      runDueTraffic(latest, now)
    }
  }
  return { scans, traffic }
}

export function startScheduler(): NodeJS.Timeout {
  console.log(
    "PlaceFind scheduler ticks every minute. Use a single web replica on Railway; multiple replicas would start the same scheduled scan or traffic job twice.",
  )
  return setInterval(() => {
    void tickScheduler().catch((error) => {
      console.error("PlaceFind scheduler tick failed.", error)
    })
  }, SCHEDULER_INTERVAL_MS)
}
