import type { PlanId } from "./types"

export const PLANS: Record<
  PlanId,
  {
    id: PlanId
    name: string
    price: number
    blurb: string
    campaigns: number
    keywords: number
    grid: number
    features: string[]
  }
> = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 49,
    blurb: "One brand, a handful of locations, weekly ranking checks.",
    campaigns: 5,
    keywords: 3,
    grid: 7,
    features: [
      "5 campaigns",
      "3 keywords per campaign",
      "Grids up to 7×7",
      "Daily or weekly schedules",
      "Your own DataForSEO key",
    ],
  },
  agency: {
    id: "agency",
    name: "Agency",
    price: 149,
    blurb: "Multi-location clients, denser grids, keyword comparison.",
    campaigns: 40,
    keywords: 8,
    grid: 13,
    features: [
      "40 campaigns",
      "8 keywords per campaign",
      "Grids up to 13×13",
      "Keyword comparison dashboards",
      "Billing and activation emails",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: 399,
    blurb: "High-volume tracking, admin reporting, and priority support.",
    campaigns: 200,
    keywords: 8,
    grid: 13,
    features: [
      "200 campaigns",
      "Admin workspace access",
      "Marketing and info email sends",
      "Invoice-ready billing emails",
      "Priority onboarding",
    ],
  },
}

export const PLAN_ORDER: PlanId[] = ["starter", "agency", "enterprise"]
