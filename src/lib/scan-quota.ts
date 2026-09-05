import {
  clampExtraScanCredits,
  STARTER_INCLUDED_SCANS,
} from "./plans"
import type { PlanId, ScanQuotaSnapshot, User, UserRole } from "./types"

export const SCAN_SESSION_MS = 45 * 60 * 1000

export const SCAN_QUOTA_EXHAUSTED =
  "You've used this month's 5 included scans. Buy extra scans for $5 each on Account."

export function usesHostedMaps(user: Pick<User, "role" | "plan">): boolean {
  return user.role !== "admin" && user.plan === "starter"
}

export function defaultScanQuotaFields() {
  return {
    extraScanCredits: 0,
    scansUsed: 0,
    scanPeriodStart: null as string | null,
    scanSessionUntil: null as string | null,
  }
}

export function currentScanPeriodStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

export function resetScanPeriodIfNeeded(user: User, now = new Date()) {
  const period = currentScanPeriodStart(now)
  if (user.scanPeriodStart !== period) {
    user.scanPeriodStart = period
    user.scansUsed = 0
  }
}

export function scanQuotaSnapshot(user: User, now = new Date()): ScanQuotaSnapshot {
  if (!usesHostedMaps(user)) {
    return {
      applies: false,
      included: 0,
      used: 0,
      extraCredits: clampExtraScanCredits(user.extraScanCredits),
      remaining: null,
      periodStart: user.scanPeriodStart,
    }
  }
  resetScanPeriodIfNeeded(user, now)
  const extraCredits = clampExtraScanCredits(user.extraScanCredits)
  const used = Math.max(0, Math.round(user.scansUsed || 0))
  const includedRemaining = Math.max(0, STARTER_INCLUDED_SCANS - used)
  return {
    applies: true,
    included: STARTER_INCLUDED_SCANS,
    used,
    extraCredits,
    remaining: includedRemaining + extraCredits,
    periodStart: user.scanPeriodStart,
  }
}

export function consumeScanCredit(
  user: User,
  now = new Date()
): { ok: true; quota: ScanQuotaSnapshot } | { ok: false; error: string; quota: ScanQuotaSnapshot } {
  user.scanSessionUntil = new Date(now.getTime() + SCAN_SESSION_MS).toISOString()
  if (!usesHostedMaps(user)) {
    return { ok: true, quota: scanQuotaSnapshot(user, now) }
  }
  const before = scanQuotaSnapshot(user, now)
  if ((before.remaining ?? 0) <= 0) {
    user.scanSessionUntil = null
    return { ok: false, error: SCAN_QUOTA_EXHAUSTED, quota: before }
  }
  if (user.scansUsed < STARTER_INCLUDED_SCANS) {
    user.scansUsed += 1
  } else {
    user.extraScanCredits = Math.max(0, clampExtraScanCredits(user.extraScanCredits) - 1)
  }
  return { ok: true, quota: scanQuotaSnapshot(user, now) }
}

export function hasActiveScanSession(user: User, now = new Date()) {
  if (!usesHostedMaps(user)) return true
  return Boolean(user.scanSessionUntil && Date.parse(user.scanSessionUntil) > now.getTime())
}

export function grantExtraScanCredits(user: User, quantity: unknown) {
  const n = clampExtraScanCredits(quantity)
  user.extraScanCredits = clampExtraScanCredits(user.extraScanCredits + n)
}

export function setExtraScanCredits(user: User, quantity: unknown) {
  user.extraScanCredits = clampExtraScanCredits(quantity)
}

export function scanQuotaForRole(role: UserRole, plan: PlanId, extras = 0): ScanQuotaSnapshot {
  return scanQuotaSnapshot({
    id: "",
    name: "",
    email: "",
    passwordHash: "",
    role,
    status: "active",
    plan,
    extraCampaigns: 0,
    extraScanCredits: extras,
    scansUsed: 0,
    scanPeriodStart: null,
    scanSessionUntil: null,
    marketingOptIn: false,
    company: "",
    agencyId: "",
    paddleCustomerId: "",
    createdAt: "",
    lastLoginAt: null,
    dfsLogin: "",
    dfsPassword: "",
    trialEndsAt: null,
  })
}
