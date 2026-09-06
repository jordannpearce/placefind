import { randomBytes } from "node:crypto"
import type { PublicUser } from "./auth.ts"
import { findUserByEmail } from "./auth.ts"
import { createLicense, keygenPublicStatus, type IssuedLicense } from "./keygen.ts"
import { licenseEmail, pendingLicenseEmail, sendMail } from "./mail.ts"
import { readProduct } from "./product.ts"
import { readCollection, writeCollection } from "./store.ts"

export type OrderStatus = "paid" | "pending_license"

export type Order = {
  id: string
  userId: string
  name: string
  email: string
  amount: string
  status: OrderStatus
  licenseId: string | null
  licenseKey: string | null
  createdAt: string
  emailedAt: string | null
}

function readOrders(): Order[] {
  const rows = readCollection<Order>("orders")
  return Array.isArray(rows) ? rows : []
}

function writeOrders(orders: Order[]) {
  writeCollection("orders", orders.slice(0, 200))
}

export function listOrders() {
  return readOrders()
}

export function ordersForUser(userId: string) {
  return readOrders().filter((order) => order.userId === userId)
}

export function publicOrder(order: Order) {
  return {
    id: order.id,
    name: order.name,
    email: order.email,
    amount: order.amount,
    status: order.status,
    licenseKey: order.licenseKey,
    createdAt: order.createdAt,
    emailedAt: order.emailedAt,
  }
}

function downloadUrl() {
  return process.env.PLACEFIND_DOWNLOAD_URL?.trim() || "http://127.0.0.1:43141/download"
}

async function emailLicense(order: Order, key: string) {
  const product = readProduct()
  const message = licenseEmail({
    name: order.name,
    product: product.name,
    key,
    downloadUrl: downloadUrl(),
  })
  const sent = await sendMail({ ...message, to: order.email })
  return sent.createdAt
}

export async function checkout(user: PublicUser): Promise<{ order: Order; license?: IssuedLicense; error?: string }> {
  const product = readProduct()
  const order: Order = {
    id: randomBytes(8).toString("hex"),
    userId: user.id,
    name: user.name,
    email: user.email,
    amount: product.price,
    status: "pending_license",
    licenseId: null,
    licenseKey: null,
    createdAt: new Date().toISOString(),
    emailedAt: null,
  }

  const issued = keygenPublicStatus().canIssue ? await createLicense({ name: user.name, email: user.email }) : { error: "Keygen is not connected." }
  if (issued.license) {
    order.status = "paid"
    order.licenseId = issued.license.id
    order.licenseKey = issued.license.key
    order.emailedAt = await emailLicense(order, issued.license.key)
  } else {
    const message = pendingLicenseEmail({ name: user.name, product: product.name })
    const sent = await sendMail({ ...message, to: user.email })
    order.emailedAt = sent.createdAt
    order.status = "pending_license"
  }

  writeOrders([order, ...readOrders()])
  return { order, license: issued.license, error: issued.license ? undefined : issued.error }
}

export async function issueAndDeliver(input: {
  name: string
  email: string
  userId?: string
  sendEmail?: boolean
}): Promise<{ order?: Order; license?: IssuedLicense; error?: string }> {
  const created = await createLicense({ name: input.name, email: input.email })
  if (!created.license) return { error: created.error }

  const existing = findUserByEmail(input.email)
  const userId = input.userId || existing?.id || ""
  const product = readProduct()
  const order: Order = {
    id: randomBytes(8).toString("hex"),
    userId,
    name: input.name.trim() || existing?.name || input.email,
    email: input.email.trim().toLowerCase(),
    amount: product.price,
    status: "paid",
    licenseId: created.license.id,
    licenseKey: created.license.key,
    createdAt: new Date().toISOString(),
    emailedAt: null,
  }
  if (input.sendEmail !== false) {
    order.emailedAt = await emailLicense(order, created.license.key)
  }
  writeOrders([order, ...readOrders()])
  return { order, license: created.license }
}

export function shopSummary() {
  const orders = readOrders()
  return {
    orderCount: orders.length,
    paidCount: orders.filter((order) => order.status === "paid").length,
    pendingCount: orders.filter((order) => order.status === "pending_license").length,
  }
}
