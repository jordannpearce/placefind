import { findUserById, type UserRole } from "./auth.ts"
import { readCollection, writeCollection } from "./store.ts"
import {
  quotaExceededMessage,
  quotaLimit,
  usageMeter,
  usageMonthUtc,
  type AccountUsage,
  type UsageKind,
} from "../src/lib/quotas.ts"

export type UsageRow = {
  id: string
  userId: string
  month: string
  rankScans: number
  aiPrompts: number
  trafficCampaigns: number
}

export class QuotaError extends Error {
  status = 429

  constructor(message: string) {
    super(message)
    this.name = "QuotaError"
  }
}

export function usageRowId(userId: string, month: string) {
  return `${userId}:${month}`
}

function emptyRow(userId: string, month: string): UsageRow {
  return {
    id: usageRowId(userId, month),
    userId,
    month,
    rankScans: 0,
    aiPrompts: 0,
    trafficCampaigns: 0,
  }
}

function normalizeCount(value: unknown) {
  const count = Number(value)
  if (!Number.isFinite(count) || count < 0) return 0
  return Math.floor(count)
}

function normalizeRow(row: Partial<UsageRow> | null | undefined, fallbackUserId = "", fallbackMonth = ""): UsageRow {
  const userId = String(row?.userId ?? fallbackUserId)
  const month = String(row?.month ?? fallbackMonth)
  return {
    id: String(row?.id ?? usageRowId(userId, month)),
    userId,
    month,
    rankScans: normalizeCount(row?.rankScans),
    aiPrompts: normalizeCount(row?.aiPrompts),
    trafficCampaigns: normalizeCount(row?.trafficCampaigns),
  }
}

function readUsageRows(): UsageRow[] {
  const rows = readCollection<UsageRow>("usage")
  return Array.isArray(rows) ? rows.map((row) => normalizeRow(row)) : []
}

export function roleForUsage(userId: string): UserRole {
  return findUserById(userId)?.role === "admin" ? "admin" : "customer"
}

export function deleteUsageForUser(userId: string) {
  writeCollection(
    "usage",
    readUsageRows().filter((row) => row.userId !== userId),
  )
}

export function readMonthlyUsage(userId: string, now: Date = new Date()): UsageRow {
  const month = usageMonthUtc(now)
  const existing = readUsageRows().find((row) => row.userId === userId && row.month === month)
  return existing ?? emptyRow(userId, month)
}

export function accountUsageFor(userId: string, role?: UserRole, now: Date = new Date()): AccountUsage {
  const resolved = role ?? roleForUsage(userId)
  const row = readMonthlyUsage(userId, now)
  return {
    month: usageMonthUtc(now),
    monthTimeZone: "UTC",
    rankScans: usageMeter(row.rankScans, quotaLimit("rankScans", resolved)),
    aiPrompts: usageMeter(row.aiPrompts, quotaLimit("aiPrompts", resolved)),
    trafficCampaigns: usageMeter(row.trafficCampaigns, quotaLimit("trafficCampaigns", resolved)),
    unlimited: resolved === "admin",
  }
}

export function consumeMonthlyUsage(
  userId: string | null | undefined,
  kind: UsageKind,
  now: Date = new Date(),
): UsageRow {
  const id = String(userId ?? "").trim()
  const month = usageMonthUtc(now)
  if (!id) return emptyRow("", month)
  const role = roleForUsage(id)
  const rows = readUsageRows()
  let row = rows.find((item) => item.userId === id && item.month === month)
  if (!row) {
    row = emptyRow(id, month)
    rows.push(row)
  }
  const limit = quotaLimit(kind, role)
  if (row[kind] >= limit) {
    throw new QuotaError(quotaExceededMessage(kind))
  }
  row[kind] += 1
  writeCollection("usage", rows)
  return row
}
