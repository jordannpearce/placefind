import { PLANS } from "./plans"
import type { PlanId } from "./types"

export interface Tier {
  name: "Starter" | "Pro" | "Advanced"
  description: string
  features: string[]
  priceId: { month: string; year: string }
}

export type BillingInterval = "month" | "year"

/** Display name → fulfillment plan id used by webhooks and campaign limits. */
export const TIER_TO_PLAN: Record<Tier["name"], PlanId> = {
  Starter: "starter",
  Pro: "agency",
  Advanced: "enterprise",
}

export const PLAN_TO_TIER: Record<PlanId, Tier["name"]> = {
  starter: "Starter",
  agency: "Pro",
  enterprise: "Advanced",
}

export const TIER_PRICE_ENV: Record<PlanId, { month: string[]; year: string[] }> = {
  starter: {
    month: [
      "NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTH",
      "NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTHLY",
      "NEXT_PUBLIC_PADDLE_PRICE_ENTRY_MONTH",
      "NEXT_PUBLIC_PADDLE_PRICE_ENTRY_MONTHLY",
      "PADDLE_PRICE_STARTER_MONTH",
      "PADDLE_PRICE_STARTER_MONTHLY",
    ],
    year: [
      "NEXT_PUBLIC_PADDLE_PRICE_STARTER_YEAR",
      "NEXT_PUBLIC_PADDLE_PRICE_STARTER_ANNUAL",
      "NEXT_PUBLIC_PADDLE_PRICE_ENTRY_YEAR",
      "NEXT_PUBLIC_PADDLE_PRICE_ENTRY_ANNUAL",
      "PADDLE_PRICE_STARTER_YEAR",
      "PADDLE_PRICE_STARTER_ANNUAL",
    ],
  },
  agency: {
    month: [
      "NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTH",
      "NEXT_PUBLIC_PADDLE_PRICE_AGENCY_MONTHLY",
      "NEXT_PUBLIC_PADDLE_PRICE_GROWTH_MONTH",
      "NEXT_PUBLIC_PADDLE_PRICE_GROWTH_MONTHLY",
      "PADDLE_PRICE_PRO_MONTH",
      "PADDLE_PRICE_AGENCY_MONTHLY",
    ],
    year: [
      "NEXT_PUBLIC_PADDLE_PRICE_PRO_YEAR",
      "NEXT_PUBLIC_PADDLE_PRICE_AGENCY_ANNUAL",
      "NEXT_PUBLIC_PADDLE_PRICE_GROWTH_YEAR",
      "NEXT_PUBLIC_PADDLE_PRICE_GROWTH_ANNUAL",
      "PADDLE_PRICE_PRO_YEAR",
      "PADDLE_PRICE_AGENCY_ANNUAL",
    ],
  },
  enterprise: {
    month: [
      "NEXT_PUBLIC_PADDLE_PRICE_ADVANCED_MONTH",
      "NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE_MONTHLY",
      "PADDLE_PRICE_ADVANCED_MONTH",
      "PADDLE_PRICE_ENTERPRISE_MONTHLY",
    ],
    year: [
      "NEXT_PUBLIC_PADDLE_PRICE_ADVANCED_YEAR",
      "NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE_ANNUAL",
      "PADDLE_PRICE_ADVANCED_YEAR",
      "PADDLE_PRICE_ENTERPRISE_ANNUAL",
    ],
  },
}

export const TIER_PRODUCT_ENV: Record<PlanId, string[]> = {
  starter: [
    "NEXT_PUBLIC_PADDLE_PRODUCT_STARTER",
    "NEXT_PUBLIC_PADDLE_PRODUCT_ENTRY",
    "PADDLE_PRODUCT_STARTER",
  ],
  agency: [
    "NEXT_PUBLIC_PADDLE_PRODUCT_PRO",
    "NEXT_PUBLIC_PADDLE_PRODUCT_AGENCY",
    "NEXT_PUBLIC_PADDLE_PRODUCT_GROWTH",
    "PADDLE_PRODUCT_AGENCY",
  ],
  enterprise: [
    "NEXT_PUBLIC_PADDLE_PRODUCT_ADVANCED",
    "NEXT_PUBLIC_PADDLE_PRODUCT_ENTERPRISE",
    "PADDLE_PRODUCT_ENTERPRISE",
  ],
}

const TIER_ORDER: Tier["name"][] = ["Starter", "Pro", "Advanced"]

const TIER_COPY: Record<Tier["name"], { description: string; features: string[] }> = {
  Starter: {
    description: PLANS.starter.blurb,
    features: PLANS.starter.features,
  },
  Pro: {
    description: PLANS.agency.blurb,
    features: PLANS.agency.features,
  },
  Advanced: {
    description: PLANS.enterprise.blurb,
    features: PLANS.enterprise.features,
  },
}

export function firstEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ""
}

export function catalogPriceEnv(): Array<[PlanId, string[]]> {
  return (Object.keys(TIER_PRICE_ENV) as PlanId[]).map((plan) => [
    plan,
    [...TIER_PRICE_ENV[plan].month, ...TIER_PRICE_ENV[plan].year],
  ])
}

export function catalogProductEnv(): Array<[PlanId, string[]]> {
  return (Object.keys(TIER_PRODUCT_ENV) as PlanId[]).map((plan) => [plan, TIER_PRODUCT_ENV[plan]])
}

export function getPricingTiers(): Tier[] {
  return TIER_ORDER.map((name) => {
    const plan = TIER_TO_PLAN[name]
    return {
      name,
      description: TIER_COPY[name].description,
      features: TIER_COPY[name].features,
      priceId: {
        month: firstEnv(TIER_PRICE_ENV[plan].month),
        year: firstEnv(TIER_PRICE_ENV[plan].year),
      },
    }
  })
}

export function missingTierPriceIds(tiers: Tier[]) {
  return tiers.flatMap((tier) => {
    const missing: string[] = []
    if (!tier.priceId.month) missing.push(`${tier.name} month`)
    if (!tier.priceId.year) missing.push(`${tier.name} year`)
    return missing
  })
}
