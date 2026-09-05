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
import { resolvePlanFromCatalog } from "./paddle-catalog"
import { clampExtraCampaigns } from "./plans"
import { markLeadPaid } from "./leads"
import type { PaddleCustomer, PaddleSubscription, PlanId, User } from "./types"

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
  upsertCustomer(db, event.data.customerId, "")
  const subscription = upsertSubscription(db, {
    subscriptionId: event.data.id,
    customerId: event.data.customerId,
    status: event.data.status,
    priceId: catalog.priceId,
    productId: catalog.productId,
    scheduledChangeAction: event.data.scheduledChange?.action ?? null,
    scheduledChangeAt: event.data.scheduledChange?.effectiveAt ?? null,
    createdAt: event.data.createdAt,
  })
  const plan = await resolvePlan(catalog)
  const user = linkUserToPaddleCustomer(db, event.data.customerId, "")
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

  const item = event.data.items[0]
  const priceId = item?.price?.id || ""
  const productId = item?.price?.productId || ""
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
