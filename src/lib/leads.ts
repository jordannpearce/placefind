import { canReceivePaidLeads } from "./agency-account"
import { PLAN_TO_TIER } from "./pricing-tiers"
import type { GetFoundInquiry } from "./public-forms"
import { randomToken } from "./password"
import type {
  AppSettings,
  LeadInvoiceStatus,
  LeadStatus,
  LocationCount,
  MarketingLead,
  PlanId,
  User,
} from "./types"

export const DEFAULT_COST_PER_LEAD_USD = 50
export const MAX_COST_PER_LEAD_USD = 10_000

export const LEAD_STATUSES: LeadStatus[] = ["new", "assigned", "invoiced", "paid"]
const INVOICE_STATUSES: LeadInvoiceStatus[] = ["none", "invoiced", "failed", "paid"]
const LOCATION_COUNTS: LocationCount[] = ["1", "2-5", "6+"]

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && LEAD_STATUSES.includes(value as LeadStatus)
}

export function parseCostPerLeadUsd(value: unknown): number {
  const n = typeof value === "number" ? value : Number(typeof value === "string" ? value.trim() : value)
  if (!Number.isFinite(n)) return DEFAULT_COST_PER_LEAD_USD
  const rounded = Math.round(n * 100) / 100
  if (rounded < 0) return DEFAULT_COST_PER_LEAD_USD
  return Math.min(MAX_COST_PER_LEAD_USD, rounded)
}

export function costPerLeadUsd(settings?: Pick<AppSettings, "costPerLeadUsd"> | null) {
  return parseCostPerLeadUsd(settings?.costPerLeadUsd)
}

function asLeadStatus(value: unknown): LeadStatus {
  return typeof value === "string" && LEAD_STATUSES.includes(value as LeadStatus)
    ? (value as LeadStatus)
    : "new"
}

function asInvoiceStatus(value: unknown): LeadInvoiceStatus {
  return typeof value === "string" && INVOICE_STATUSES.includes(value as LeadInvoiceStatus)
    ? (value as LeadInvoiceStatus)
    : "none"
}

function asLocationCount(value: unknown): LocationCount | "" {
  return typeof value === "string" && LOCATION_COUNTS.includes(value as LocationCount)
    ? (value as LocationCount)
    : ""
}

export function normalizeLead(raw: Partial<MarketingLead> | null | undefined): MarketingLead | null {
  if (!raw?.email?.trim()) return null
  const price =
    raw.leadPrice == null || raw.leadPrice === ("" as unknown)
      ? null
      : Number.isFinite(Number(raw.leadPrice))
        ? Number(raw.leadPrice)
        : null
  return {
    id: raw.id || `lead_${Date.now()}`,
    name: raw.name || "",
    email: raw.email.trim().toLowerCase(),
    phone: raw.phone || "",
    businessName: raw.businessName || "",
    city: raw.city || "",
    state: raw.state || "",
    comments: raw.comments || "",
    website: raw.website || "",
    gbpListing: raw.gbpListing || "",
    primaryCategory: raw.primaryCategory || "",
    keyword: raw.keyword || "",
    locationCount: asLocationCount(raw.locationCount),
    status: asLeadStatus(raw.status),
    assignedToUserId: raw.assignedToUserId || "",
    assignedAt: raw.assignedAt || null,
    leadPrice: price,
    invoiceStatus: asInvoiceStatus(raw.invoiceStatus),
    invoiceError: raw.invoiceError || "",
    invoiceDryRun: Boolean(raw.invoiceDryRun),
    paddleTransactionId: raw.paddleTransactionId || "",
    paddleInvoiceId: raw.paddleInvoiceId || "",
    paddleInvoiceUrl: raw.paddleInvoiceUrl || "",
    source: "get-found",
    audienceSynced: Boolean(raw.audienceSynced),
    createdAt: raw.createdAt || new Date().toISOString(),
  }
}

export function parseStoredLeads(value?: string): MarketingLead[] {
  if (!value?.trim()) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeLead(item as Partial<MarketingLead>))
      .filter((item): item is MarketingLead => Boolean(item))
  } catch {
    return []
  }
}

export function leadFromInquiry(inquiry: GetFoundInquiry, audienceSynced: boolean): MarketingLead {
  return {
    id: `lead_${Date.now()}_${randomToken().slice(0, 8)}`,
    name: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone,
    businessName: inquiry.businessName,
    city: inquiry.city,
    state: inquiry.state,
    comments: inquiry.comments,
    website: inquiry.website,
    gbpListing: inquiry.gbpListing,
    primaryCategory: inquiry.primaryCategory,
    keyword: inquiry.keyword,
    locationCount: inquiry.locationCount,
    status: "new",
    assignedToUserId: "",
    assignedAt: null,
    leadPrice: null,
    invoiceStatus: "none",
    invoiceError: "",
    invoiceDryRun: false,
    paddleTransactionId: "",
    paddleInvoiceId: "",
    paddleInvoiceUrl: "",
    source: "get-found",
    audienceSynced,
    createdAt: new Date().toISOString(),
  }
}

export function applyInquiryToLead(lead: MarketingLead, inquiry: GetFoundInquiry, audienceSynced: boolean) {
  lead.name = inquiry.name
  lead.email = inquiry.email
  lead.phone = inquiry.phone
  lead.businessName = inquiry.businessName
  lead.city = inquiry.city
  lead.state = inquiry.state
  lead.comments = inquiry.comments
  lead.website = inquiry.website
  lead.gbpListing = inquiry.gbpListing
  lead.primaryCategory = inquiry.primaryCategory
  lead.keyword = inquiry.keyword
  lead.locationCount = inquiry.locationCount
  lead.audienceSynced = audienceSynced || lead.audienceSynced
}

/** Admin-entered lead. Same Get Found fields, status `new`, no marketing audience sync. */
export function createAdminLead(inquiry: GetFoundInquiry): MarketingLead {
  return leadFromInquiry(inquiry, false)
}

export function applyLeadStatus(lead: MarketingLead, status: LeadStatus) {
  lead.status = status
  if (status === "paid") {
    lead.invoiceStatus = "paid"
    lead.invoiceError = ""
  }
}

/** Clear the agency assignment. Does not delete Paddle rows or invoice ids. */
export function unassignLead(lead: MarketingLead) {
  lead.assignedToUserId = ""
  lead.assignedAt = null
  if (lead.status === "assigned" || lead.status === "invoiced") {
    lead.status = "new"
  }
}

export function removeLead(leads: MarketingLead[], id: string): MarketingLead | null {
  const index = leads.findIndex((item) => item.id === id)
  if (index < 0) return null
  const [removed] = leads.splice(index, 1)
  return removed ?? null
}

export function paidLeadPlanLabel(plan: PlanId) {
  return PLAN_TO_TIER[plan]
}

export function assignableLeadAgencies(users: User[]) {
  return users
    .filter((user) => canReceivePaidLeads(user))
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      company: user.company,
      plan: user.plan,
      planLabel: paidLeadPlanLabel(user.plan),
      hasPaddleCustomer: Boolean(user.paddleCustomerId.trim()),
    }))
}

export function leadAssignmentBlockedReason(user: User | undefined) {
  if (!user) return "Choose a Pro or Advanced agency account."
  if (user.role === "admin") return "Staff accounts cannot receive paid leads."
  if (user.status !== "active") return "That agency account is not active."
  if (user.plan === "starter") {
    return "Starter / Entry accounts cannot receive paid leads. Assign to Pro or Advanced."
  }
  if (!canReceivePaidLeads(user)) {
    return "Only Pro and Advanced agency accounts can receive paid leads."
  }
  return null
}

export function applyLeadAssignment(
  lead: MarketingLead,
  user: User,
  amountUsd: number,
  invoice: {
    ok: boolean
    dryRun?: boolean
    error?: string
    transactionId?: string
    invoiceId?: string
    invoiceUrl?: string
  }
) {
  const now = new Date().toISOString()
  lead.assignedToUserId = user.id
  lead.assignedAt = now
  lead.leadPrice = amountUsd
  lead.invoiceDryRun = Boolean(invoice.dryRun)
  lead.paddleTransactionId = invoice.transactionId || ""
  lead.paddleInvoiceId = invoice.invoiceId || ""
  lead.paddleInvoiceUrl = invoice.invoiceUrl || ""
  if (invoice.ok) {
    lead.status = "invoiced"
    lead.invoiceStatus = "invoiced"
    lead.invoiceError = invoice.dryRun ? invoice.error || "" : ""
  } else {
    lead.status = "assigned"
    lead.invoiceStatus = "failed"
    lead.invoiceError = invoice.error || "Paddle invoice failed."
  }
}

export function agencyMemberIds(viewer: Pick<User, "id" | "agencyId" | "role">, users: User[]) {
  const ids = new Set<string>([viewer.id])
  if (!viewer.agencyId) return ids
  for (const user of users) {
    if (user.agencyId === viewer.agencyId && user.role !== "admin") ids.add(user.id)
  }
  return ids
}

/** Leads assigned (and therefore emailed) to this account or its agency group. */
export function leadsForAccount(viewer: Pick<User, "id" | "agencyId" | "role">, users: User[], leads: MarketingLead[]) {
  const ids = agencyMemberIds(viewer, users)
  return leads
    .filter((lead) => lead.assignedToUserId && ids.has(lead.assignedToUserId))
    .slice()
    .sort((a, b) => (b.assignedAt || b.createdAt).localeCompare(a.assignedAt || a.createdAt))
}

export function canViewAssignedLeads(viewer: Pick<User, "id" | "agencyId" | "role" | "plan" | "status">, users: User[], leads: MarketingLead[]) {
  if (canReceivePaidLeads(viewer)) return true
  return leadsForAccount(viewer, users, leads).length > 0
}

export function publicLeadForAgency(
  lead: MarketingLead,
  users: User[],
  viewerId: string
) {
  const assignee = users.find((user) => user.id === lead.assignedToUserId)
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    businessName: lead.businessName,
    city: lead.city,
    state: lead.state,
    comments: lead.comments,
    website: lead.website,
    gbpListing: lead.gbpListing,
    primaryCategory: lead.primaryCategory,
    keyword: lead.keyword,
    locationCount: lead.locationCount,
    status: lead.status,
    assignedAt: lead.assignedAt,
    assignedToUserId: lead.assignedToUserId,
    assignedToName: assignee?.name || "",
    assignedToEmail: assignee?.email || "",
    assignedToCompany: assignee?.company || "",
    emailedToViewer: lead.assignedToUserId === viewerId,
    leadPrice: lead.leadPrice,
    invoiceStatus: lead.invoiceStatus,
    invoiceDryRun: lead.invoiceDryRun,
    paddleInvoiceUrl: lead.paddleInvoiceUrl,
    createdAt: lead.createdAt,
  }
}

export type AgencyLead = ReturnType<typeof publicLeadForAgency>

export function markLeadPaid(lead: MarketingLead) {
  lead.status = "paid"
  lead.invoiceStatus = "paid"
  lead.invoiceError = ""
}
