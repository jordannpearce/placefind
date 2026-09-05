import { getPaddle, paddleApiKey } from "./paddle"
import { AI_VISIBILITY_PRICE } from "./plans"
import type { Database } from "./db"
import type { PaddleSubscription } from "./types"

const PRODUCT_ENV = ["PADDLE_AI_VISIBILITY_PRODUCT_ID", "NEXT_PUBLIC_PADDLE_PRODUCT_AI_VISIBILITY"]
const PRICE_ENV = ["PADDLE_AI_VISIBILITY_PRICE_ID", "NEXT_PUBLIC_PADDLE_PRICE_AI_VISIBILITY"]

function firstEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ""
}

export function aiVisibilityCatalogFromSettings(settings: {
  aiVisibilityProductId?: string
  aiVisibilityPriceId?: string
}) {
  return {
    productId: firstEnv(PRODUCT_ENV) || settings.aiVisibilityProductId?.trim() || "",
    priceId: firstEnv(PRICE_ENV) || settings.aiVisibilityPriceId?.trim() || "",
  }
}

function isAiCustomData(value: unknown) {
  if (!value || typeof value !== "object") return false
  const kind = (value as Record<string, unknown>).kind
  return kind === "ai_visibility" || kind === "ai_mentions"
}

export function isAiVisibilityPurchase(input: {
  kind?: unknown
  priceId?: string | null
  productId?: string | null
  priceName?: string | null
  productName?: string | null
  aiVisibilityPriceId?: string
  aiVisibilityProductId?: string
}) {
  if (input.kind === "ai_visibility" || input.kind === "ai_mentions") return true
  const priceId = input.priceId?.trim() || ""
  const productId = input.productId?.trim() || ""
  if (priceId && (priceId === firstEnv(PRICE_ENV) || priceId === input.aiVisibilityPriceId)) return true
  if (productId && (productId === firstEnv(PRODUCT_ENV) || productId === input.aiVisibilityProductId)) {
    return true
  }
  const name = `${input.priceName || ""} ${input.productName || ""}`.toLowerCase()
  return name.includes("ai visibility") || name.includes("ai mention")
}

export function isAiVisibilitySubscription(
  subscription: Pick<PaddleSubscription, "kind" | "priceId" | "productId">,
  settings?: { aiVisibilityProductId?: string; aiVisibilityPriceId?: string }
) {
  if (subscription.kind === "ai_visibility") return true
  return isAiVisibilityPurchase({
    priceId: subscription.priceId,
    productId: subscription.productId,
    aiVisibilityPriceId: settings?.aiVisibilityPriceId,
    aiVisibilityProductId: settings?.aiVisibilityProductId,
  })
}

async function findExistingCatalog() {
  const paddle = getPaddle()
  const products = paddle.products.list({ perPage: 50 })
  for await (const product of products) {
    if (!isAiCustomData(product.customData) && !/ai visibility/i.test(product.name || "")) continue
    const prices = paddle.prices.list({ productId: [product.id], perPage: 20 })
    for await (const price of prices) {
      if (price.status !== "active") continue
      const amount = Number(price.unitPrice?.amount || 0)
      if (amount === AI_VISIBILITY_PRICE * 100 || isAiCustomData(price.customData)) {
        return { productId: product.id, priceId: price.id }
      }
    }
  }
  return null
}

async function createCatalog() {
  const paddle = getPaddle()
  const product = await paddle.products.create({
    name: "GridPins AI Visibility",
    taxCategory: "standard",
    description: "Monthly AI prompt scans for one brand across major AI models.",
    customData: { kind: "ai_visibility" },
  })
  const price = await paddle.prices.create({
    productId: product.id,
    name: "AI Visibility — one brand",
    description: "10 AI prompt scans per month for one brand",
    type: "standard",
    billingCycle: { interval: "month", frequency: 1 },
    unitPrice: { amount: String(AI_VISIBILITY_PRICE * 100), currencyCode: "USD" },
    quantity: { minimum: 1, maximum: 1 },
    customData: { kind: "ai_visibility" },
  })
  return { productId: product.id, priceId: price.id }
}

export async function ensureAiVisibilityCatalog(db: Database) {
  const existing = aiVisibilityCatalogFromSettings(db.settings)
  if (existing.productId && existing.priceId) return existing
  if (!paddleApiKey()) {
    throw new Error("Paddle is not configured for AI Visibility checkout.")
  }
  const found = await findExistingCatalog()
  const catalog = found ?? (await createCatalog())
  db.settings.aiVisibilityProductId = catalog.productId
  db.settings.aiVisibilityPriceId = catalog.priceId
  return catalog
}
