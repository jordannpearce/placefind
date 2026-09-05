import type { PlanId } from "./types"

export const EXTRA_SLOT_PRICE = 5
export const MAX_EXTRA_CAMPAIGNS = 5
export const STARTER_INCLUDED_SCANS = 5
export const EXTRA_SCAN_PRICE = 5
export const MAX_EXTRA_SCAN_CREDITS = 9999
export const AI_VISIBILITY_PRICE = 199
export const AI_PROMPTS_PER_BRAND = 10
export const AI_SCANS_PER_PROMPT = 4
export const MAX_AI_SCANS = 400

export const PLANS: Record<
  PlanId,
  {
    id: PlanId
    name: string
    price: number
    blurb: string
    campaigns: number
    maxCampaigns: number
    extraSlotPrice: number
    keywords: number
    grid: number
    features: string[]
  }
> = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 20,
    blurb: "One brand, one location. Five Maps scans each month.",
    campaigns: 1,
    maxCampaigns: 1,
    extraSlotPrice: 0,
    keywords: 3,
    grid: 7,
    features: [
      "1 campaign — one brand and one location",
      "Hard limit: you cannot add a second campaign",
      "5 Maps scans each month",
      "Extra scans $5 each when you need more",
      "3 keywords on that campaign",
      "Grids up to 7×7",
      "Maps scans included",
      `Optional AI Visibility $${AI_VISIBILITY_PRICE}/mo per brand · ${AI_PROMPTS_PER_BRAND} prompts`,
    ],
  },
  agency: {
    id: "agency",
    name: "Pro",
    price: 50,
    blurb: "Five campaigns included. Add extra slots at $5 each, up to ten campaigns.",
    campaigns: 5,
    maxCampaigns: 10,
    extraSlotPrice: EXTRA_SLOT_PRICE,
    keywords: 8,
    grid: 13,
    features: [
      "5 campaigns included",
      "Extra campaign slots $5 each (up to 5 extras, 10 total)",
      "8 keywords per campaign",
      "Grids up to 13×13",
      "Keyword comparison dashboards",
      "Billing emails when you change plan or extras",
      `Optional AI Visibility $${AI_VISIBILITY_PRICE}/mo per brand · ${AI_PROMPTS_PER_BRAND} prompts`,
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Advanced",
    price: 250,
    blurb: "Fifty campaigns for shops that run many brands and locations. No per-slot add-on.",
    campaigns: 50,
    maxCampaigns: 50,
    extraSlotPrice: 0,
    keywords: 8,
    grid: 13,
    features: [
      "50 campaigns included",
      "No $5 add-on on this tier",
      "Admin workspace access",
      "Marketing and info email sends",
      "Invoice-ready billing emails",
      "Priority onboarding",
      `Optional AI Visibility $${AI_VISIBILITY_PRICE}/mo per brand · ${AI_PROMPTS_PER_BRAND} prompts`,
    ],
  },
}

export const PLAN_ORDER: PlanId[] = ["starter", "agency", "enterprise"]

export function isPlanId(value: unknown): value is PlanId {
  return value === "starter" || value === "agency" || value === "enterprise"
}

export function clampExtraCampaigns(plan: PlanId, extras: unknown): number {
  if (plan !== "agency") return 0
  const n = typeof extras === "number" ? extras : Number(extras)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(MAX_EXTRA_CAMPAIGNS, Math.round(n)))
}

export function campaignLimit(plan: PlanId, extras = 0): number {
  const item = PLANS[plan]
  if (plan !== "agency") return item.maxCampaigns
  return Math.min(item.campaigns + clampExtraCampaigns(plan, extras), item.maxCampaigns)
}

/** Unpaid accounts cannot occupy a Starter slot. Limits apply only after billing is current. */
export function usableCampaignLimit(plan: PlanId, extras: number, current: boolean): number {
  if (!current) return 0
  return campaignLimit(plan, extras)
}

export function monthlyTotal(plan: PlanId, extras = 0): number {
  return PLANS[plan].price + clampExtraCampaigns(plan, extras) * EXTRA_SLOT_PRICE
}

export function canAddCampaign(plan: PlanId, extras: number, currentCount: number): boolean {
  return currentCount < campaignLimit(plan, extras)
}

export function clampExtraScanCredits(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(MAX_EXTRA_SCAN_CREDITS, Math.round(n)))
}

export function campaignLimitMessage(plan: PlanId, extras = 0): string {
  const limit = campaignLimit(plan, extras)
  if (plan === "starter") {
    return "The Starter plan includes 1 campaign (one brand and one location). Upgrade to Pro to add another."
  }
  if (plan === "agency") {
    return `The Pro plan allows ${limit} campaigns (${PLANS.agency.campaigns} included plus extras, hard cap ${PLANS.agency.maxCampaigns}). Remove a campaign or add extra slots on Account.`
  }
  return `The Advanced plan allows ${limit} campaigns.`
}
