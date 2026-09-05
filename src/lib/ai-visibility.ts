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
    .filter((item) => (item as AiScanRun).brandId !== SAMPLE_BRAND_ID)
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

export function grantComplimentaryBrand(user: User, input: AiBrandInput) {
  const created = normalizeAiBrand({
    ...input,
    subscriptionId: "complimentary",
    status: "active",
    id: input.id || `ai_brand_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    promptsUsed: 0,
    promptPeriodStart: periodStartIso(),
    createdAt: new Date().toISOString(),
  })
  if (!created) return null
  if (!Array.isArray(user.aiBrands)) user.aiBrands = []
  user.aiBrands.push(created)
  return created
}

export function userHasMatchingBrand(user: Pick<User, "aiBrands">, input: Pick<AiBrandInput, "name" | "website" | "domain">) {
  const name = (input.name || "").trim().toLowerCase()
  if (!name) return false
  const domain = normalizeDomain(input.website || input.domain)
  return (user.aiBrands ?? []).some((brand) => {
    if (brand.name.trim().toLowerCase() !== name) return false
    if (!domain) return true
    return brand.domain === domain || normalizeDomain(brand.website) === domain
  })
}

export function removeComplimentaryBrand(user: User, brandId: string) {
  const id = brandId.trim()
  const index = (user.aiBrands ?? []).findIndex(
    (brand) => brand.id === id && brand.subscriptionId === "complimentary"
  )
  if (index < 0) return null
  const [removed] = user.aiBrands.splice(index, 1)
  return removed ?? null
}

export type BrandAssignmentTarget =
  | { ok: true; users: User[]; label: string }
  | { ok: false; error: string }

export function brandAssignmentTargets(
  users: User[],
  agencies: Array<{ id: string; name: string }>,
  input: { userId?: string; agencyId?: string }
): BrandAssignmentTarget {
  const userId = input.userId?.trim() || ""
  const agencyId = input.agencyId?.trim() || ""
  if (userId && agencyId) {
    return { ok: false, error: "Choose either a user account or an agency, not both." }
  }
  if (userId) {
    const user = users.find((row) => row.id === userId)
    if (!user) return { ok: false, error: "Account not found." }
    if (user.role === "admin") return { ok: false, error: "Assign brands to a user or agency account, not staff." }
    if (user.status === "pending") return { ok: false, error: "That account is not active yet." }
    return { ok: true, users: [user], label: user.company || user.name }
  }
  if (agencyId) {
    const agency = agencies.find((row) => row.id === agencyId)
    if (!agency) return { ok: false, error: "Agency not found." }
    const members = users.filter(
      (row) => row.agencyId === agencyId && row.role !== "admin" && row.status !== "pending"
    )
    if (!members.length) return { ok: false, error: "That agency has no accounts to assign." }
    return { ok: true, users: members, label: agency.name }
  }
  return { ok: false, error: "Choose a user account or an agency." }
}

export function listAssignedBrands(
  users: User[],
  agencies: Array<{ id: string; name: string }>
) {
  const agencyName = Object.fromEntries(agencies.map((agency) => [agency.id, agency.name]))
  return users
    .flatMap((user) =>
      (user.aiBrands ?? []).map((brand) => ({
        ...brandQuotaView(brand),
        ownerUserId: user.id,
        ownerName: user.name,
        ownerEmail: user.email,
        ownerCompany: user.company,
        ownerPlan: user.plan,
        agencyId: user.agencyId,
        agencyName: (user.agencyId && agencyName[user.agencyId]) || "Independent",
        complimentary: brand.subscriptionId === "complimentary",
      }))
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
