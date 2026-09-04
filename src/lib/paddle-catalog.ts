import { catalogPriceEnv, catalogProductEnv } from "./pricing-tiers"
import { isPlanId } from "./plans"
import type { PlanId } from "./types"

/**
 * Maps existing Paddle price/product IDs (the live 3-tier catalog) onto GridPins plans.
 * Price ID env names live in pricing-tiers.ts so checkout and fulfillment share one list.
 */
const PRICE_ENV: Array<[PlanId, string[]]> = catalogPriceEnv()
const PRODUCT_ENV: Array<[PlanId, string[]]> = catalogProductEnv()

/** Public IDs from the existing live 3-tier catalog. Env vars override when set. */
const LIVE_PRICE_IDS: Record<string, PlanId> = {
  pri_01m1ht34q60f3knaynzgyd1a8k: "starter",
  pri_01m1pnbv278gjjt76kzcmy1nt6: "starter",
  pri_01m1ht429v9as1gen5xhqdyymn: "agency",
  pri_01m1pnbv4j83wpxseqtzwst2ax: "agency",
  pri_01m1ht4rpb48x49wrwspd9s5g9: "enterprise",
  pri_01m1pnbv6marzjgt57jf2g1963: "enterprise",
}

const LIVE_PRODUCT_IDS: Record<string, PlanId> = {
  pro_01m1ht1bscp7wyjnnp8azj71qj: "starter",
  pro_01m1ht1xyrx1p1wmbjez5bddyy: "agency",
  pro_01m1ht2epjc5pzwcn1z66e4m11: "enterprise",
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
  if (n.includes("entry") || n.includes("starter")) return "starter"
  if (n.includes("growth")) return "agency"
  if (n.includes("enterprise") || n.includes("advanced")) return "enterprise"
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
