/** Monthly SaaS quotas. Usage months are UTC calendar months (YYYY-MM). */

export const MONTHLY_RANK_SCANS = 4
export const MONTHLY_AI_PROMPTS = 10
export const MONTHLY_TRAFFIC_CAMPAIGNS = 30

/** Internal ceiling so admin accounts are effectively uncapped. */
export const ADMIN_MONTHLY_QUOTA = 10_000

export type UsageKind = "rankScans" | "aiPrompts" | "trafficCampaigns"

export type UsageMeter = {
  used: number
  remaining: number
  limit: number
}

export type AccountUsage = {
  /** UTC calendar month, e.g. 2026-09 */
  month: string
  monthTimeZone: "UTC"
  rankScans: UsageMeter
  aiPrompts: UsageMeter
  trafficCampaigns: UsageMeter
  unlimited: boolean
}

export const MONTHLY_LIMITS: Record<UsageKind, number> = {
  rankScans: MONTHLY_RANK_SCANS,
  aiPrompts: MONTHLY_AI_PROMPTS,
  trafficCampaigns: MONTHLY_TRAFFIC_CAMPAIGNS,
}

export function usageMonthUtc(now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

export function quotaLimit(kind: UsageKind, role: "customer" | "admin" = "customer"): number {
  if (role === "admin") return ADMIN_MONTHLY_QUOTA
  return MONTHLY_LIMITS[kind]
}

export function quotaExceededMessage(kind: UsageKind): string {
  if (kind === "rankScans") return `This account has used its ${MONTHLY_RANK_SCANS} rank scans for this month.`
  if (kind === "aiPrompts") return `This account has used its ${MONTHLY_AI_PROMPTS} AI prompts for this month.`
  return `This account has used its ${MONTHLY_TRAFFIC_CAMPAIGNS} traffic campaigns for this month.`
}

export function usageMeter(used: number, limit: number): UsageMeter {
  const safeUsed = Math.max(0, Math.floor(used) || 0)
  const safeLimit = Math.max(0, Math.floor(limit) || 0)
  return {
    used: safeUsed,
    remaining: Math.max(0, safeLimit - safeUsed),
    limit: safeLimit,
  }
}

export function formatUsageRemaining(meter: UsageMeter): string {
  return `${meter.remaining}/${meter.limit}`
}
