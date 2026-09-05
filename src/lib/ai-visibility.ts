import { AI_PROMPTS_PER_BRAND, MAX_AI_SCANS } from "./plans"
import type {
  AiBrand,
  AiBrandStatus,
  AiCompetitor,
  AiPromptQuota,
  AiScanRun,
  User,
} from "./types"

const STATUSES: AiBrandStatus[] = ["active", "canceled", "past_due", "paused"]

function trimText(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function normalizeDomain(value: unknown) {
  const raw = trimText(value, 200).toLowerCase()
  if (!raw) return ""
  return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || ""
}

function normalizeCompetitor(raw: Partial<AiCompetitor> | string | null | undefined): AiCompetitor | null {
  if (typeof raw === "string") {
    const name = raw.trim()
    if (!name) return null
    return { name: name.slice(0, 80), domain: "" }
  }
  if (!raw || typeof raw !== "object") return null
  const name = trimText(raw.name, 80)
  if (!name) return null
  return { name, domain: normalizeDomain(raw.domain) }
}

export function defaultAiVisibilityFields() {
  return {
    aiBrands: [] as AiBrand[],
    aiScans: [] as AiScanRun[],
  }
}

export function normalizeAiBrand(raw: Partial<AiBrand> | null | undefined): AiBrand | null {
  if (!raw || typeof raw !== "object") return null
  const name = trimText(raw.name, 80)
  if (!name) return null
  const status = STATUSES.includes(raw.status as AiBrandStatus) ? (raw.status as AiBrandStatus) : "active"
  const competitors = Array.isArray(raw.competitors)
    ? raw.competitors.map(normalizeCompetitor).filter((item): item is AiCompetitor => Boolean(item)).slice(0, 8)
    : []
  return {
    id: trimText(raw.id, 80) || `ai_brand_${Date.now()}`,
    name,
    domain: normalizeDomain(raw.domain),
    competitors,
    subscriptionId: trimText(raw.subscriptionId, 80),
    status,
    promptsUsed: Math.max(0, Math.round(Number(raw.promptsUsed) || 0)),
    promptPeriodStart: typeof raw.promptPeriodStart === "string" ? raw.promptPeriodStart : null,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  }
}

export function normalizeAiBrands(raw: unknown): AiBrand[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => normalizeAiBrand(item as Partial<AiBrand>)).filter((item): item is AiBrand => Boolean(item))
}

export function normalizeAiScans(raw: unknown): AiScanRun[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item) => item && typeof item === "object" && typeof (item as AiScanRun).id === "string")
    .slice(0, MAX_AI_SCANS) as AiScanRun[]
}

export function periodStartIso(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`
}

export function resetAiBrandPeriod(brand: AiBrand, now = new Date()) {
  const start = periodStartIso(now)
  if (brand.promptPeriodStart !== start) {
    brand.promptPeriodStart = start
    brand.promptsUsed = 0
  }
  return brand
}

export function aiPromptQuota(brand: AiBrand, now = new Date()): AiPromptQuota {
  resetAiBrandPeriod(brand, now)
  const remaining = Math.max(0, AI_PROMPTS_PER_BRAND - brand.promptsUsed)
  return {
    included: AI_PROMPTS_PER_BRAND,
    used: brand.promptsUsed,
    remaining,
    periodStart: brand.promptPeriodStart,
  }
}

export function consumeAiPrompt(brand: AiBrand, now = new Date()): { ok: true } | { ok: false; error: string } {
  const quota = aiPromptQuota(brand, now)
  if (quota.remaining <= 0) {
    return {
      ok: false,
      error: `This brand has used its ${AI_PROMPTS_PER_BRAND} AI prompt scans for the month.`,
    }
  }
  brand.promptsUsed += 1
  return { ok: true }
}

export function activeAiBrands(user: Pick<User, "aiBrands" | "role">) {
  return (user.aiBrands ?? []).filter((brand) => brand.status === "active")
}

export function canManageAiComplimentary(user: Pick<User, "role">) {
  return user.role === "admin"
}

export function complimentaryAiBrand(now = new Date()): AiBrand {
  return {
    id: "ai_brand_admin_sample",
    name: "Houndstooth Coffee",
    domain: "houndstoothcoffee.com",
    competitors: [
      { name: "Jo's Coffee", domain: "joscoffee.com" },
      { name: "Starbucks", domain: "starbucks.com" },
    ],
    subscriptionId: "complimentary",
    status: "active",
    promptsUsed: 0,
    promptPeriodStart: periodStartIso(now),
    createdAt: now.toISOString(),
  }
}

export function ensureAdminSampleBrand(user: User) {
  if (user.role !== "admin") return user
  if (user.aiBrands.some((brand) => brand.id === "ai_brand_admin_sample" || brand.status === "active")) {
    return user
  }
  user.aiBrands = [complimentaryAiBrand(), ...user.aiBrands]
  return user
}

export function storeAiScan(user: User, run: AiScanRun) {
  user.aiScans = [run, ...user.aiScans].slice(0, MAX_AI_SCANS)
}

export function parseCompetitorsInput(value: unknown): AiCompetitor[] {
  if (Array.isArray(value)) {
    return value.map(normalizeCompetitor).filter((item): item is AiCompetitor => Boolean(item)).slice(0, 8)
  }
  if (typeof value !== "string") return []
  return value
    .split(/[\n,]/)
    .map((part) => normalizeCompetitor(part))
    .filter((item): item is AiCompetitor => Boolean(item))
    .slice(0, 8)
}

export function brandQuotaView(brand: AiBrand) {
  const quota = aiPromptQuota(brand)
  return {
    ...brand,
    quota,
  }
}
