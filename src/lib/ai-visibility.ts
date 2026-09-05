import { canonicalAiLocation, normalizeBrandLocation } from "./maps-location"
import { AI_PROMPTS_PER_BRAND, AI_SCANS_PER_PROMPT, MAX_AI_SCANS } from "./plans"
import type {
  AiBrand,
  AiBrandStatus,
  AiCompetitor,
  AiPromptQuota,
  AiSavedPrompt,
  AiScanRun,
  User,
} from "./types"

export const AI_BRAND_STATUSES: AiBrandStatus[] = ["active", "canceled", "past_due", "paused", "suspended"]
export const ADMIN_AI_BRAND_STATUSES: AiBrandStatus[] = ["active", "paused", "suspended", "canceled"]
const STATUSES = AI_BRAND_STATUSES

export function isAiBrandStatus(value: unknown): value is AiBrandStatus {
  return typeof value === "string" && STATUSES.includes(value as AiBrandStatus)
}

export function isAdminAiBrandStatus(value: unknown): value is AiBrandStatus {
  return typeof value === "string" && ADMIN_AI_BRAND_STATUSES.includes(value as AiBrandStatus)
}

export function aiBrandStatusLabel(status: AiBrandStatus) {
  if (status === "active") return "Active"
  if (status === "paused") return "Paused"
  if (status === "suspended") return "Suspended"
  if (status === "canceled") return "Canceled"
  return "Past due"
}

export function aiBrandStatusCopy(status: AiBrandStatus) {
  if (status === "paused") return "This brand is paused. History stays available; new scans are blocked."
  if (status === "suspended") return "This brand is suspended. History stays available; new scans are blocked."
  if (status === "canceled") return "This brand is canceled. History stays available; new scans are blocked."
  if (status === "past_due") return "This brand is past due. History stays available; new scans are blocked."
  return ""
}

export function aiBrandScanBlockedMessage(status: AiBrandStatus) {
  if (status === "paused") {
    return "This brand is paused. New scans are blocked until an administrator enables it."
  }
  if (status === "suspended") {
    return "This brand is suspended. New scans are blocked until an administrator enables it."
  }
  if (status === "canceled") {
    return "This brand is canceled. New scans are blocked."
  }
  if (status === "past_due") {
    return "This brand is past due. New scans are blocked."
  }
  return "This brand is not active. New scans are blocked."
}
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
  street?: string
  city?: string
  state?: string
  zip?: string
  address?: string
  lat?: number | null
  lng?: number | null
  location?: string
  phone?: string
  website?: string
  domain?: string
  competitors?: unknown
  prompts?: unknown
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
  const place = normalizeBrandLocation(raw)
  return {
    id: id || `ai_brand_${Date.now()}`,
    name,
    street: place.street,
    city: place.city,
    state: place.state,
    zip: place.zip,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    location: place.location,
    phone: trimText("phone" in raw ? raw.phone : "", 40),
    website,
    domain: normalizeDomain(website || raw.domain),
    competitors,
    prompts: normalizeAiPrompts("prompts" in raw ? raw.prompts : []),
    subscriptionId: trimText(raw.subscriptionId, 80),
    status,
    promptsUsed: Math.max(0, Math.round(Number(raw.promptsUsed) || 0)),
    promptPeriodStart: typeof raw.promptPeriodStart === "string" ? raw.promptPeriodStart : null,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  }
}

export function normalizeAiPrompt(raw: Partial<AiSavedPrompt> | null | undefined): AiSavedPrompt | null {
  if (!raw || typeof raw !== "object") return null
  const text = typeof raw.text === "string" ? raw.text.trim().slice(0, 2000) : ""
  if (text.length < 8) return null
  const now = new Date().toISOString()
  return {
    id: trimText(raw.id, 80) || `ai_prompt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text,
    scansUsed: Math.max(0, Math.round(Number(raw.scansUsed) || 0)),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  }
}

export function normalizeAiPrompts(raw: unknown): AiSavedPrompt[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => normalizeAiPrompt(item as Partial<AiSavedPrompt>))
    .filter((item): item is AiSavedPrompt => Boolean(item))
    .slice(0, AI_PROMPTS_PER_BRAND)
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
        promptId: typeof scan.promptId === "string" ? scan.promptId : "",
        location: typeof scan.location === "string" ? scan.location : "",
        models: (scan.models || []).map((model) => ({
          ...model,
          answer: typeof model.answer === "string" ? model.answer : "",
          excerpt: typeof model.excerpt === "string" ? model.excerpt : "",
          signals: model.signals ?? { name: false, address: false, phone: false, website: false },
          competitors: Array.isArray(model.competitors) ? model.competitors : [],
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

export function aiPromptQuota(brand: AiBrand): AiPromptQuota {
  const used = (brand.prompts ?? []).length
  return {
    included: AI_PROMPTS_PER_BRAND,
    used,
    remaining: Math.max(0, AI_PROMPTS_PER_BRAND - used),
    scansPerPrompt: AI_SCANS_PER_PROMPT,
    periodStart: brand.promptPeriodStart,
  }
}

export function upsertBrandPrompt(
  brand: AiBrand,
  text: string,
  promptId?: string
): { ok: true; prompt: AiSavedPrompt } | { ok: false; error: string } {
  if (!Array.isArray(brand.prompts)) brand.prompts = []
  const trimmed = text.trim()
  if (trimmed.length < 8) return { ok: false, error: "Enter a prompt of at least 8 characters." }
  if (trimmed.length > 2000) return { ok: false, error: "Keep the prompt under 2,000 characters." }
  const now = new Date().toISOString()
  if (promptId) {
    const existing = brand.prompts.find((item) => item.id === promptId)
    if (!existing) return { ok: false, error: "Prompt not found." }
    existing.text = trimmed
    existing.updatedAt = now
    return { ok: true, prompt: existing }
  }
  if (brand.prompts.length >= AI_PROMPTS_PER_BRAND) {
    return { ok: false, error: `This brand already has ${AI_PROMPTS_PER_BRAND} prompts.` }
  }
  const created: AiSavedPrompt = {
    id: `ai_prompt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text: trimmed,
    scansUsed: 0,
    createdAt: now,
    updatedAt: now,
  }
  brand.prompts.push(created)
  return { ok: true, prompt: created }
}

export function consumePromptScan(
  brand: AiBrand,
  promptId: string
): { ok: true; prompt: AiSavedPrompt } | { ok: false; error: string } {
  if (brand.status !== "active") {
    return { ok: false, error: aiBrandScanBlockedMessage(brand.status) }
  }
  const prompt = (brand.prompts ?? []).find((item) => item.id === promptId)
  if (!prompt) return { ok: false, error: "Save this prompt before scanning." }
  if (prompt.scansUsed >= AI_SCANS_PER_PROMPT) {
    return {
      ok: false,
      error: `This prompt already has ${AI_SCANS_PER_PROMPT} scans. Compare the saved history.`,
    }
  }
  prompt.scansUsed += 1
  return { ok: true, prompt: { ...prompt } }
}

export function refundPromptScan(brand: AiBrand, promptId: string) {
  const prompt = (brand.prompts ?? []).find((item) => item.id === promptId)
  if (prompt && prompt.scansUsed > 0) prompt.scansUsed -= 1
}

export function promptScanView(prompt: AiSavedPrompt) {
  return {
    ...prompt,
    scansRemaining: Math.max(0, AI_SCANS_PER_PROMPT - prompt.scansUsed),
    scansIncluded: AI_SCANS_PER_PROMPT,
  }
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
    prompts: (brand.prompts ?? []).map(promptScanView),
    quota,
  }
}

export function competitorsInputValue(competitors: AiCompetitor[]) {
  return competitors.map((item) => item.name).join(", ")
}

export function promptSlotsForBrand(brand: Pick<AiBrand, "prompts">) {
  const saved = (brand.prompts ?? []).map(promptScanView)
  return {
    empty: saved.length === 0,
    emptyMessage: saved.length === 0 ? "No prompts saved yet" : "",
    savedCount: saved.length,
    included: AI_PROMPTS_PER_BRAND,
    slots: Array.from({ length: AI_PROMPTS_PER_BRAND }, (_, index) => {
      const prompt = saved[index]
      if (!prompt) {
        return {
          index,
          saved: false,
          id: "",
          text: "",
          scansUsed: 0,
          scansRemaining: AI_SCANS_PER_PROMPT,
          scansIncluded: AI_SCANS_PER_PROMPT,
        }
      }
      return {
        index,
        saved: true,
        id: prompt.id,
        text: prompt.text,
        scansUsed: prompt.scansUsed,
        scansRemaining: prompt.scansRemaining,
        scansIncluded: prompt.scansIncluded,
      }
    }),
  }
}

export type BrandProfileUpdate = ReturnType<typeof parseBrandForm> & {
  lat?: number | null
  lng?: number | null
  location?: string
}

/** Update NAP and Maps location on a brand the caller already owns. Never changes billing or prompts. */
export function applyBrandProfileUpdate(existing: AiBrand, located: BrandProfileUpdate): AiBrand | null {
  const name = located.name.trim()
  if (name.length < 2) return null
  return normalizeAiBrand({
    ...existing,
    name,
    street: located.street,
    city: located.city,
    state: located.state,
    zip: located.zip,
    address: located.address,
    phone: located.phone,
    website: located.website,
    competitors: located.competitors,
    lat: located.lat ?? null,
    lng: located.lng ?? null,
    location: located.location || "",
    id: existing.id,
    subscriptionId: existing.subscriptionId,
    status: existing.status,
    prompts: existing.prompts,
    promptsUsed: existing.promptsUsed,
    promptPeriodStart: existing.promptPeriodStart,
    createdAt: existing.createdAt,
  })
}

export function setAiBrandStatus(user: User, brandId: string, status: AiBrandStatus): AiBrand | null {
  if (!isAiBrandStatus(status)) return null
  if (!Array.isArray(user.aiBrands)) user.aiBrands = []
  const brand = user.aiBrands.find((item) => item.id === brandId.trim())
  if (!brand) return null
  brand.status = status
  return brand
}

export function updateAssignedBrandProfile(
  user: User,
  brandId: string,
  located: BrandProfileUpdate
): AiBrand | null {
  if (!Array.isArray(user.aiBrands)) user.aiBrands = []
  const id = brandId.trim()
  const index = user.aiBrands.findIndex((brand) => brand.id === id)
  if (index < 0) return null
  const updated = applyBrandProfileUpdate(user.aiBrands[index], located)
  if (!updated) return null
  user.aiBrands[index] = updated
  return updated
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

/** Remove any brand from a workspace. Does not cancel Paddle. */
export function removeAssignedBrand(user: User, brandId: string) {
  const id = brandId.trim()
  if (!id) return null
  if (!Array.isArray(user.aiBrands)) user.aiBrands = []
  const index = user.aiBrands.findIndex((brand) => brand.id === id)
  if (index < 0) return null
  const [removed] = user.aiBrands.splice(index, 1)
  if (removed && Array.isArray(user.aiScans)) {
    user.aiScans = user.aiScans.filter((scan) => scan.brandId !== id)
  }
  return removed ?? null
}

export function removeComplimentaryBrand(user: User, brandId: string) {
  const id = brandId.trim()
  const brand = (user.aiBrands ?? []).find((item) => item.id === id)
  if (!brand || brand.subscriptionId !== "complimentary") return null
  return removeAssignedBrand(user, id)
}

export type BrandAssignmentTarget =
  | { ok: true; users: User[]; label: string }
  | { ok: false; error: string }

/** Complimentary brands are first-class on every plan, including unpaid Starter. */
export function isBrandAssignableAccount(user: Pick<User, "role" | "status">) {
  return user.role !== "admin" && user.status !== "pending"
}

export function brandAssignmentTargets(
  users: User[],
  agencies: Array<{ id: string; name: string }>,
  input: { userId?: string; agencyId?: string }
): BrandAssignmentTarget {
  const userId = input.userId?.trim() || ""
  const agencyId = input.agencyId?.trim() || ""
  if (userId && agencyId) {
    return { ok: false, error: "Choose either an account or an agency, not both." }
  }
  if (userId) {
    const user = users.find((row) => row.id === userId)
    if (!user) return { ok: false, error: "Account not found." }
    if (user.role === "admin") return { ok: false, error: "Assign brands to an account or an agency, not staff." }
    if (user.status === "pending") return { ok: false, error: "That account is not active yet." }
    return { ok: true, users: [user], label: user.company || user.name }
  }
  if (agencyId) {
    const agency = agencies.find((row) => row.id === agencyId)
    if (!agency) return { ok: false, error: "Agency not found." }
    const members = users.filter((row) => row.agencyId === agencyId && isBrandAssignableAccount(row))
    if (!members.length) return { ok: false, error: "That agency has no accounts to assign." }
    return { ok: true, users: members, label: agency.name }
  }
  return { ok: false, error: "Choose an account or an agency." }
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
  street?: string
  city?: string
  state?: string
  zip?: string
  address?: string
  phone?: string
  website?: string
  brandName?: string
  brandDomain?: string
  competitors?: unknown
  lat?: number | null
  lng?: number | null
  location?: string
}) {
  const place = normalizeBrandLocation({
    street: body.street,
    city: body.city,
    state: body.state,
    zip: body.zip,
    address: body.address,
    lat: body.lat,
    lng: body.lng,
    location: body.location,
  })
  return {
    name: body.companyName || body.name || body.brandName || "",
    street: place.street,
    city: place.city,
    state: place.state,
    zip: place.zip,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    location: place.location,
    phone: body.phone || "",
    website: body.website || body.brandDomain || "",
    competitors: parseCompetitorsInput(body.competitors),
  }
}

export function missingBrandLocation(parsed: Pick<ReturnType<typeof parseBrandForm>, "city" | "state">) {
  if (parsed.city.trim().length < 2) return "Enter the city."
  if (!parsed.state.trim()) return "Choose a state."
  return ""
}

export function scanLocationForBrand(brand: Pick<AiBrand, "city" | "state" | "location">) {
  return brand.location || (brand.city && brand.state ? canonicalAiLocation(brand.city, brand.state) : "")
}
