import { catalogPriceEnv, catalogProductEnv, LIVE_TIER_PRICE_IDS, LIVE_TIER_PRODUCT_IDS } from "./pricing-tiers"
import { isPlanId } from "./plans"
import type { PlanId } from "./types"

/**
 * Maps existing Paddle price/product IDs (the live 3-tier catalog) onto GridPins plans.
 * Price ID env names live in pricing-tiers.ts so checkout and fulfillment share one list.
 */
const PRICE_ENV: Array<[PlanId, string[]]> = catalogPriceEnv()
const PRODUCT_ENV: Array<[PlanId, string[]]> = catalogProductEnv()

const LIVE_PRICE_IDS: Record<string, PlanId> = {
  [LIVE_TIER_PRICE_IDS.starter.month]: "starter",
  [LIVE_TIER_PRICE_IDS.starter.year]: "starter",
  [LIVE_TIER_PRICE_IDS.agency.month]: "agency",
  [LIVE_TIER_PRICE_IDS.agency.year]: "agency",
  [LIVE_TIER_PRICE_IDS.enterprise.month]: "enterprise",
  [LIVE_TIER_PRICE_IDS.enterprise.year]: "enterprise",
}

const LIVE_PRODUCT_IDS: Record<string, PlanId> = {
  [LIVE_TIER_PRODUCT_IDS.starter]: "starter",
  [LIVE_TIER_PRODUCT_IDS.agency]: "agency",
  [LIVE_TIER_PRODUCT_IDS.enterprise]: "enterprise",
}

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
  return LIVE_PRICE_IDS[id] ?? null
}

export function planFromProductId(productId: string | null | undefined): PlanId | null {
  const id = productId?.trim()
  if (!id) return null
  for (const [plan, names] of PRODUCT_ENV) {
    if (idsFromEnv(names).includes(id)) return plan
  }
  return LIVE_PRODUCT_IDS[id] ?? null
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
  if (n.includes("entry") || n.includes("starter") || n.includes("single brand")) return "starter"
  if (n.includes("growth") || /(^|[^a-z])pro([^a-z]|$)/.test(n)) return "agency"
  if (n.includes("advanced") || n.includes("enterprise")) return "enterprise"
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
