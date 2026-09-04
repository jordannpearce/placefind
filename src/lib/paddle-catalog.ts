import { isPlanId } from "./plans"
import type { PlanId } from "./types"

/**
 * Maps existing Paddle price/product IDs (the live 3-tier catalog) onto GridPins plans.
 * Does not create products or prices. Fill the env vars with the IDs already used by checkout.
 */
const PRICE_ENV: Array<[PlanId, string[]]> = [
  [
    "starter",
    [
      "NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTHLY",
      "NEXT_PUBLIC_PADDLE_PRICE_STARTER_ANNUAL",
      "NEXT_PUBLIC_PADDLE_PRICE_ENTRY_MONTHLY",
      "NEXT_PUBLIC_PADDLE_PRICE_ENTRY_ANNUAL",
      "PADDLE_PRICE_STARTER_MONTHLY",
      "PADDLE_PRICE_STARTER_ANNUAL",
    ],
  ],
  [
    "agency",
    [
      "NEXT_PUBLIC_PADDLE_PRICE_AGENCY_MONTHLY",
      "NEXT_PUBLIC_PADDLE_PRICE_AGENCY_ANNUAL",
      "NEXT_PUBLIC_PADDLE_PRICE_GROWTH_MONTHLY",
      "NEXT_PUBLIC_PADDLE_PRICE_GROWTH_ANNUAL",
      "PADDLE_PRICE_AGENCY_MONTHLY",
      "PADDLE_PRICE_AGENCY_ANNUAL",
    ],
  ],
  [
    "enterprise",
    [
      "NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE_MONTHLY",
      "NEXT_PUBLIC_PADDLE_PRICE_ENTERPRISE_ANNUAL",
      "PADDLE_PRICE_ENTERPRISE_MONTHLY",
      "PADDLE_PRICE_ENTERPRISE_ANNUAL",
    ],
  ],
]

const PRODUCT_ENV: Array<[PlanId, string[]]> = [
  ["starter", ["NEXT_PUBLIC_PADDLE_PRODUCT_STARTER", "NEXT_PUBLIC_PADDLE_PRODUCT_ENTRY", "PADDLE_PRODUCT_STARTER"]],
  ["agency", ["NEXT_PUBLIC_PADDLE_PRODUCT_AGENCY", "NEXT_PUBLIC_PADDLE_PRODUCT_GROWTH", "PADDLE_PRODUCT_AGENCY"]],
  [
    "enterprise",
    ["NEXT_PUBLIC_PADDLE_PRODUCT_ENTERPRISE", "PADDLE_PRODUCT_ENTERPRISE"],
  ],
]

function envValue(name: string) {
  return process.env[name]?.trim() || ""
}

function idsFromEnv(names: string[]) {
  return names.map(envValue).filter(Boolean)
}

export function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  const id = priceId?.trim()
  if (!id) return null
  for (const [plan, names] of PRICE_ENV) {
    if (idsFromEnv(names).includes(id)) return plan
  }
  return null
}

export function planFromProductId(productId: string | null | undefined): PlanId | null {
  const id = productId?.trim()
  if (!id) return null
  for (const [plan, names] of PRODUCT_ENV) {
    if (idsFromEnv(names).includes(id)) return plan
  }
  return null
}

export function planFromCustomData(data: unknown): PlanId | null {
  if (!data || typeof data !== "object") return null
  const record = data as Record<string, unknown>
  const raw = record.plan ?? record.planId ?? record.plan_id
  return typeof raw === "string" && isPlanId(raw) ? raw : null
}

/** Match the existing GridPins product names on the live catalog — do not invent SKUs. */
export function planFromCatalogName(name: string | null | undefined): PlanId | null {
  const n = name?.trim().toLowerCase() || ""
  if (!n) return null
  if (n.includes("entry") || n.includes("starter")) return "starter"
  if (n.includes("growth")) return "agency"
  if (n.includes("enterprise")) return "enterprise"
  if (/(^|[^a-z])agency([^a-z]|$)/.test(n)) return "enterprise"
  return null
}

export function resolvePlanFromCatalog(input: {
  priceId?: string | null
  productId?: string | null
  customData?: unknown
  priceName?: string | null
  productName?: string | null
}): PlanId | null {
  return (
    planFromPriceId(input.priceId) ||
    planFromCustomData(input.customData) ||
    planFromProductId(input.productId) ||
    planFromCatalogName(input.priceName) ||
    planFromCatalogName(input.productName)
  )
}
