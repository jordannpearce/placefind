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
const SAMPLE_BRAND_ID = "ai_brand_admin_sample"

function trimText(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

export function normalizeWebsite(value: unknown) {
  const raw = trimText(value, 200)
  if (!raw) return ""
  if (/^https?:\/\//i.test(raw)) return raw
  return raw
}

export function normalizeDomain(value: unknown) {
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

export type AiBrandInput = {
  name?: string
  address?: string
  phone?: string
  website?: string
  domain?: string
  competitors?: unknown
  subscriptionId?: string
  status?: AiBrandStatus
  id?: string
  promptsUsed?: number
  promptPeriodStart?: string | null
  createdAt?: string
}

export function normalizeAiBrand(raw: Partial<AiBrand> | AiBrandInput | null | undefined): AiBrand | null {
  if (!raw || typeof raw !== "object") return null
  const id = trimText(raw.id, 80)
  if (id === SAMPLE_BRAND_ID) return null
  const name = trimText(raw.name, 80)
  if (!name) return null
  const status = STATUSES.includes(raw.status as AiBrandStatus) ? (raw.status as AiBrandStatus) : "active"
  const competitors = Array.isArray(raw.competitors)
    ? raw.competitors.map(normalizeCompetitor).filter((item): item is AiCompetitor => Boolean(item)).slice(0, 8)
    : []
  const website = normalizeWebsite("website" in raw ? raw.website : "")
  return {
    id: id || `ai_brand_${Date.now()}`,
    name,
    address: trimText("address" in raw ? raw.address : "", 200),
    phone: trimText("phone" in raw ? raw.phone : "", 40),
    website,
    domain: normalizeDomain(website || raw.domain),
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
    .slice(0, MAX_AI_SCANS)
    .map((item) => {
      const scan = item as AiScanRun
      return {
        ...scan,
        models: (scan.models || []).map((model) => ({
          ...model,
          signals: model.signals ?? { name: false, address: false, phone: false, website: false },
        })),
      }
    })
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

export function parseBrandForm(body: {
  name?: string
  companyName?: string
  address?: string
  phone?: string
  website?: string
  brandName?: string
  brandDomain?: string
  competitors?: unknown
}) {
  return {
    name: body.companyName || body.name || body.brandName || "",
    address: body.address || "",
    phone: body.phone || "",
    website: body.website || body.brandDomain || "",
    competitors: parseCompetitorsInput(body.competitors),
  }
}
