import { getPaddle, paddleApiKey } from "./paddle"
import { EXTRA_SCAN_PRICE } from "./plans"
import type { Database } from "./db"

const PRODUCT_ENV = ["PADDLE_EXTRA_SCAN_PRODUCT_ID", "NEXT_PUBLIC_PADDLE_PRODUCT_EXTRA_SCAN"]
const PRICE_ENV = ["PADDLE_EXTRA_SCAN_PRICE_ID", "NEXT_PUBLIC_PADDLE_PRICE_EXTRA_SCAN"]

function firstEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ""
}

export function extraScanCatalogFromSettings(settings: {
  extraScanProductId?: string
  extraScanPriceId?: string
}) {
  return {
    productId: firstEnv(PRODUCT_ENV) || settings.extraScanProductId?.trim() || "",
    priceId: firstEnv(PRICE_ENV) || settings.extraScanPriceId?.trim() || "",
  }
}

function isExtraScanCustomData(value: unknown) {
  if (!value || typeof value !== "object") return false
  return (value as Record<string, unknown>).kind === "extra_scan"
}

async function findExistingCatalog() {
  const paddle = getPaddle()
  const products = paddle.products.list({ perPage: 50 })
  for await (const product of products) {
    if (!isExtraScanCustomData(product.customData) && !/extra scan/i.test(product.name || "")) {
      continue
    }
    const prices = paddle.prices.list({ productId: [product.id], perPage: 20 })
    for await (const price of prices) {
      if (price.status !== "active") continue
      const amount = Number(price.unitPrice?.amount || 0)
      if (amount === EXTRA_SCAN_PRICE * 100 || isExtraScanCustomData(price.customData)) {
        return { productId: product.id, priceId: price.id }
      }
    }
  }
  return null
}

async function createCatalog() {
  const paddle = getPaddle()
  const product = await paddle.products.create({
    name: "GridPins extra scan",
    taxCategory: "standard",
    description: "One additional Starter plan Google Maps grid scan.",
    customData: { kind: "extra_scan" },
  })
  const price = await paddle.prices.create({
    productId: product.id,
    name: "Extra scan",
    description: "1 extra Maps grid scan",
    type: "standard",
    unitPrice: { amount: String(EXTRA_SCAN_PRICE * 100), currencyCode: "USD" },
    quantity: { minimum: 1, maximum: 20 },
    customData: { kind: "extra_scan" },
  })
  return { productId: product.id, priceId: price.id }
}

export async function ensureExtraScanCatalog(db: Database) {
  const existing = extraScanCatalogFromSettings(db.settings)
  if (existing.productId && existing.priceId) return existing
  if (!paddleApiKey()) {
    throw new Error("Paddle is not configured for extra scan checkout.")
  }
  const found = await findExistingCatalog()
  const catalog = found ?? (await createCatalog())
  db.settings.extraScanProductId = catalog.productId
  db.settings.extraScanPriceId = catalog.priceId
  return catalog
}

export function isExtraScanPurchase(input: {
  kind?: unknown
  priceId?: string | null
  productId?: string | null
  extraScanPriceId?: string
  extraScanProductId?: string
}) {
  if (input.kind === "extra_scan") return true
  const priceId = input.priceId?.trim() || ""
  const productId = input.productId?.trim() || ""
  if (priceId && (priceId === firstEnv(PRICE_ENV) || priceId === input.extraScanPriceId)) return true
  if (productId && (productId === firstEnv(PRODUCT_ENV) || productId === input.extraScanProductId)) {
    return true
  }
  return false
}
