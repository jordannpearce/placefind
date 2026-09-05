import type {
  CustomerCreatedEvent,
  CustomerUpdatedEvent,
  EventEntity,
  SubscriptionCanceledEvent,
  SubscriptionCreatedEvent,
  SubscriptionUpdatedEvent,
  TransactionCompletedEvent,
} from "@paddle/paddle-node-sdk"
import { EventName } from "@paddle/paddle-node-sdk"

import type { Database } from "./db"
import { getPaddle } from "./paddle"
import {
  findCustomerIdForUser,
  pickAccessSubscription,
  subscriptionGrantsAccess,
  subscriptionRevokesAccess,
} from "./paddle-access"
import {
  aiVisibilityCatalogFromSettings,
  isAiVisibilityPurchase,
} from "./ai-visibility-catalog"
import { extraScanCatalogFromSettings, isExtraScanPurchase } from "./extra-scan-catalog"
import {
  normalizeAiBrand,
  normalizeDomain,
  normalizeWebsite,
  parseCompetitorsInput,
  periodStartIso,
} from "./ai-visibility"
import { resolvePlanFromCatalog } from "./paddle-catalog"
import { clampExtraCampaigns } from "./plans"
import { grantExtraScanCredits } from "./scan-quota"
import { markLeadPaid } from "./leads"
import type { AiBrandStatus, PaddleCustomer, PaddleSubscription, PlanId, User } from "./types"

function nowIso() {
  return new Date().toISOString()
}

function asIso(value: string | Date | null | undefined, fallback = nowIso()) {
  if (!value) return fallback
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString()
}

function upsertCustomer(db: Database, customerId: string, email: string, createdAt?: string) {
  const id = customerId.trim()
  if (!id) return null
  const normalizedEmail = email.trim().toLowerCase()
  const existing = db.customers.find((row) => row.customerId === id)
  const stamp = nowIso()
  if (existing) {
    if (normalizedEmail) existing.email = normalizedEmail
    existing.updatedAt = stamp
    return existing
  }
  const created: PaddleCustomer = {
    customerId: id,
    email: normalizedEmail,
    createdAt: createdAt ? asIso(createdAt) : stamp,
    updatedAt: stamp,
  }
  db.customers.push(created)
  return created
}

function upsertSubscription(db: Database, next: Omit<PaddleSubscription, "createdAt" | "updatedAt"> & {
  createdAt?: string
}) {
  const stamp = nowIso()
  const existing = db.subscriptions.find((row) => row.subscriptionId === next.subscriptionId)
  if (existing) {
    existing.customerId = next.customerId
    existing.status = next.status
    if (next.priceId) existing.priceId = next.priceId
    if (next.productId) existing.productId = next.productId
    if (next.kind) existing.kind = next.kind
    existing.scheduledChangeAction = next.scheduledChangeAction
    existing.scheduledChangeAt = next.scheduledChangeAt
    existing.updatedAt = stamp
    return existing
  }
  const created: PaddleSubscription = {
    subscriptionId: next.subscriptionId,
    customerId: next.customerId,
    status: next.status,
    priceId: next.priceId,
    productId: next.productId,
    kind: next.kind === "ai_visibility" ? "ai_visibility" : "plan",
    scheduledChangeAction: next.scheduledChangeAction,
    scheduledChangeAt: next.scheduledChangeAt,
    createdAt: next.createdAt ? asIso(next.createdAt) : stamp,
    updatedAt: stamp,
  }
  db.subscriptions.push(created)
  return created
}

export function findPaddleCustomerId(db: Database, user: Pick<User, "email" | "paddleCustomerId">) {
  return findCustomerIdForUser(user, db.customers)
}

export function linkUserToPaddleCustomer(db: Database, customerId: string, email: string): User | null {
  const id = customerId.trim()
  if (!id) return null
  const byId = db.users.find((user) => user.paddleCustomerId === id)
  if (byId) return byId
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null
  const byEmail = db.users.find((user) => user.email === normalized)
  if (byEmail) {
    byEmail.paddleCustomerId = id
    return byEmail
  }
  return null
}

function brandStatusFromSubscription(status: string): AiBrandStatus {
  const normalized = status.trim().toLowerCase()
  if (normalized === "active") return "active"
  if (normalized === "paused") return "paused"
  if (normalized === "past_due") return "past_due"
  return "canceled"
}

function upsertAiBrandFromSubscription(
  user: User,
  input: {
    subscriptionId: string
    status: string
    brandName?: string
    brandDomain?: string
    address?: string
    phone?: string
    website?: string
    competitors?: unknown
  }
) {
  const existing = user.aiBrands.find((brand) => brand.subscriptionId === input.subscriptionId)
  const status = brandStatusFromSubscription(input.status)
  const website = normalizeWebsite(input.website || input.brandDomain)
  if (existing) {
    existing.status = status
    if (input.brandName?.trim()) existing.name = input.brandName.trim().slice(0, 80)
    if (input.address?.trim()) existing.address = input.address.trim().slice(0, 200)
    if (input.phone?.trim()) existing.phone = input.phone.trim().slice(0, 40)
    if (website) {
      existing.website = website
      existing.domain = normalizeDomain(website)
    } else if (input.brandDomain?.trim()) {
      existing.domain = normalizeDomain(input.brandDomain)
    }
    const competitors = parseCompetitorsInput(input.competitors)
    if (competitors.length) existing.competitors = competitors
    return existing
  }
  const created = normalizeAiBrand({
    id: `ai_brand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: input.brandName?.trim() || "Brand",
    address: input.address || "",
    phone: input.phone || "",
    website,
    domain: input.brandDomain || "",
    competitors: parseCompetitorsInput(input.competitors),
    subscriptionId: input.subscriptionId,
    status,
    promptsUsed: 0,
    promptPeriodStart: periodStartIso(),
    createdAt: nowIso(),
  })
  if (created) user.aiBrands.push(created)
  return created
}

function customText(custom: Record<string, unknown> | null | undefined, key: string) {
  const value = custom?.[key]
  return typeof value === "string" ? value : ""
}

function applyPlanToUser(user: User, plan: PlanId) {
  user.plan = plan
  user.extraCampaigns = clampExtraCampaigns(plan, user.extraCampaigns)
}

function applySubscriptionToUser(db: Database, user: User) {
  const customerId = findPaddleCustomerId(db, user)
  if (!customerId) return
  const subs = db.subscriptions.filter((row) => row.customerId === customerId)
  const chosen = pickAccessSubscription(subs)
  if (!chosen) return
  if (subscriptionGrantsAccess(chosen)) {
    const plan = resolvePlanFromCatalog({
      priceId: chosen.priceId,
      productId: chosen.productId,
    })
    if (plan) applyPlanToUser(user, plan)
    return
  }
  if (subscriptionRevokesAccess(chosen)) {
    applyPlanToUser(user, "starter")
  }
}

export function provisionUserFromPaddle(db: Database, user: User) {
  const customerId = findPaddleCustomerId(db, user)
  if (customerId && !user.paddleCustomerId) user.paddleCustomerId = customerId
  applySubscriptionToUser(db, user)
}

export function linkCustomersByEmail(db: Database) {
  for (const customer of db.customers) {
    if (!customer.email) continue
    const user = db.users.find((item) => item.email === customer.email)
    if (user && !user.paddleCustomerId) user.paddleCustomerId = customer.customerId
  }
}

async function resolvePlan(input: {
  priceId?: string | null
  productId?: string | null
  customData?: unknown
  priceName?: string | null
  productName?: string | null
}): Promise<PlanId | null> {
  const local = resolvePlanFromCatalog(input)
  if (local) return local
  const priceId = input.priceId?.trim()
  if (!priceId) return null
  try {
    const paddle = getPaddle()
    const price = await paddle.prices.get(priceId)
    const fromPrice = resolvePlanFromCatalog({
      priceId: price.id,
      productId: price.productId,
      customData: price.customData,
      priceName: price.name,
    })
    if (fromPrice) return fromPrice
    if (price.productId) {
      const product = await paddle.products.get(price.productId)
      return resolvePlanFromCatalog({
        priceId: price.id,
        productId: product.id,
        customData: product.customData,
        productName: product.name,
      })
    }
  } catch {
    return null
  }
  return null
}

function itemsFromSubscription(
  event: SubscriptionCreatedEvent | SubscriptionUpdatedEvent | SubscriptionCanceledEvent
) {
  const item = event.data.items[0]
  return {
    priceId: item?.price?.id || "",
    productId: item?.price?.productId || item?.product?.id || "",
    customData: item?.price?.customData ?? event.data.customData,
    priceName: item?.price?.name,
    productName: item?.product?.name,
  }
}

export async function handleCustomerEvent(db: Database, event: CustomerCreatedEvent | CustomerUpdatedEvent) {
  const customer = upsertCustomer(db, event.data.id, event.data.email, event.data.createdAt)
  if (!customer) return
  const user = linkUserToPaddleCustomer(db, customer.customerId, customer.email)
  if (user) applySubscriptionToUser(db, user)
}

export async function handleSubscriptionEvent(
  db: Database,
  event: SubscriptionCreatedEvent | SubscriptionUpdatedEvent | SubscriptionCanceledEvent
) {
  const catalog = itemsFromSubscription(event)
  const aiCatalog = aiVisibilityCatalogFromSettings(db.settings)
  const custom = customDataRecord(event.data.customData) ?? customDataRecord(catalog.customData)
  const isAi = isAiVisibilityPurchase({
    kind: custom?.kind,
    priceId: catalog.priceId,
    productId: catalog.productId,
    priceName: catalog.priceName,
    productName: catalog.productName,
    aiVisibilityPriceId: aiCatalog.priceId,
    aiVisibilityProductId: aiCatalog.productId,
  })
  upsertCustomer(db, event.data.customerId, "")
  const subscription = upsertSubscription(db, {
    subscriptionId: event.data.id,
    customerId: event.data.customerId,
    status: event.data.status,
    priceId: catalog.priceId,
    productId: catalog.productId,
    kind: isAi ? "ai_visibility" : "plan",
    scheduledChangeAction: event.data.scheduledChange?.action ?? null,
    scheduledChangeAt: event.data.scheduledChange?.effectiveAt ?? null,
    createdAt: event.data.createdAt,
  })
  const userId = typeof custom?.userId === "string" ? custom.userId : ""
  const user =
    (userId ? db.users.find((row) => row.id === userId) : null) ||
    linkUserToPaddleCustomer(db, event.data.customerId, "")
  if (isAi) {
    if (user) {
      upsertAiBrandFromSubscription(user, {
        subscriptionId: event.data.id,
        status: event.data.status,
        brandName: customText(custom, "brandName"),
        brandDomain: customText(custom, "brandDomain"),
        address: customText(custom, "address"),
        phone: customText(custom, "phone"),
        website: customText(custom, "website"),
        competitors: custom?.competitors,
      })
    }
    return
  }
  const plan = await resolvePlan(catalog)
  if (user) {
    if (plan && subscriptionGrantsAccess(subscription)) applyPlanToUser(user, plan)
    else applySubscriptionToUser(db, user)
  }
}

function customDataRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

export async function handleTransactionCompleted(db: Database, event: TransactionCompletedEvent) {
  const customerId = event.data.customerId || ""
  if (customerId) upsertCustomer(db, customerId, "")

  const custom = customDataRecord(event.data.customData)
  const catalog = extraScanCatalogFromSettings(db.settings)
  const item = event.data.items[0]
  const extraQuantity = Math.max(
    1,
    event.data.items.reduce((sum, line) => sum + Math.max(1, Number(line.quantity) || 1), 0)
  )
  if (
    isExtraScanPurchase({
      kind: custom?.kind,
      priceId: item?.price?.id,
      productId: item?.price?.productId,
      extraScanPriceId: catalog.priceId,
      extraScanProductId: catalog.productId,
    })
  ) {
    const userId = typeof custom?.userId === "string" ? custom.userId : ""
    const user =
      (userId ? db.users.find((row) => row.id === userId) : null) ||
      (customerId ? linkUserToPaddleCustomer(db, customerId, "") : null)
    if (user) grantExtraScanCredits(user, extraQuantity)
    return
  }

  const leadId = typeof custom?.leadId === "string" ? custom.leadId : ""
  if (custom?.kind === "get_found_lead" && leadId) {
    const lead = db.leads.find((item) => item.id === leadId)
    if (lead) {
      markLeadPaid(lead)
      if (event.data.id) lead.paddleTransactionId = event.data.id
      if (event.data.invoiceId) lead.paddleInvoiceId = event.data.invoiceId
    }
    return
  }

  const aiCatalog = aiVisibilityCatalogFromSettings(db.settings)
  const priceId = item?.price?.id || ""
  const productId = item?.price?.productId || ""
  const isAi = isAiVisibilityPurchase({
    kind: custom?.kind,
    priceId,
    productId,
    priceName: item?.price?.name,
    aiVisibilityPriceId: aiCatalog.priceId,
    aiVisibilityProductId: aiCatalog.productId,
  })
  if (isAi) {
    const userId = typeof custom?.userId === "string" ? custom.userId : ""
    const user =
      (userId ? db.users.find((row) => row.id === userId) : null) ||
      (customerId ? linkUserToPaddleCustomer(db, customerId, "") : null)
    const subscriptionId = event.data.subscriptionId || ""
    if (subscriptionId && customerId) {
      upsertSubscription(db, {
        subscriptionId,
        customerId,
        status: "active",
        priceId,
        productId,
        kind: "ai_visibility",
        scheduledChangeAction: null,
        scheduledChangeAt: null,
      })
    }
    if (user && subscriptionId) {
      upsertAiBrandFromSubscription(user, {
        subscriptionId,
        status: "active",
        brandName: customText(custom, "brandName"),
        brandDomain: customText(custom, "brandDomain"),
        address: customText(custom, "address"),
        phone: customText(custom, "phone"),
        website: customText(custom, "website"),
        competitors: custom?.competitors,
      })
    }
    return
  }
  const plan = await resolvePlan({
    priceId,
    productId,
    customData: item?.price?.customData ?? event.data.customData,
    priceName: item?.price?.name,
  })

  const subscriptionId = event.data.subscriptionId
  if (subscriptionId && customerId) {
    const existing = db.subscriptions.find((row) => row.subscriptionId === subscriptionId)
    if (!existing) {
      upsertSubscription(db, {
        subscriptionId,
        customerId,
        status: "active",
        priceId,
        productId,
        kind: "plan",
        scheduledChangeAction: null,
        scheduledChangeAt: null,
      })
    } else if (subscriptionRevokesAccess(existing)) {
      const user = linkUserToPaddleCustomer(db, customerId, "")
      if (user) applySubscriptionToUser(db, user)
      return
    } else {
      if (priceId) existing.priceId = priceId
      if (productId) existing.productId = productId
      existing.updatedAt = nowIso()
    }
  }

  const user = customerId ? linkUserToPaddleCustomer(db, customerId, "") : null
  if (user && plan) {
    const customerSubs = db.subscriptions.filter((row) => row.customerId === customerId)
    const chosen = pickAccessSubscription(customerSubs)
    if (!chosen || subscriptionGrantsAccess(chosen)) applyPlanToUser(user, plan)
    else applySubscriptionToUser(db, user)
  } else if (user) {
    applySubscriptionToUser(db, user)
  }
}

export async function processPaddleEvent(db: Database, event: EventEntity) {
  switch (event.eventType) {
    case EventName.CustomerCreated:
    case EventName.CustomerUpdated:
      await handleCustomerEvent(db, event)
      return
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionUpdated:
    case EventName.SubscriptionCanceled:
      await handleSubscriptionEvent(db, event)
      return
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(db, event)
      return
    default:
      return
  }
}
