import { randomBytes } from "node:crypto"
import type { PublicUser } from "./auth.ts"
import { licenseStatus } from "./keygen.ts"
import { sendMail, welcomeEmail } from "./mail.ts"
import { readProduct } from "./product.ts"
import { readCollection, writeCollection } from "./store.ts"

export type OrderStatus = "paid" | "pending"

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
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    status: row.status === "paid" ? "paid" : "pending",
  }))
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
    status: order.status === "pending_license" ? "pending" : order.status,
    createdAt: order.createdAt,
    emailedAt: order.emailedAt,
  }
}

export async function checkout(user: PublicUser): Promise<{ order: Order; error?: string }> {
  const product = readProduct()
  const welcome = welcomeEmail({ name: user.name, product: product.name, price: product.price })
  const sent = await sendMail({ ...welcome, to: user.email })
  const order: Order = {
    id: randomBytes(8).toString("hex"),
    userId: user.id,
    name: user.name,
    email: user.email,
    amount: product.price || "150",
    status: "paid",
    licenseId: null,
    licenseKey: null,
    createdAt: new Date().toISOString(),
    emailedAt: sent.createdAt,
  }
  writeOrders([order, ...readOrders()])
  return { order }
}

export async function issueAndDeliver(): Promise<{ error: string }> {
  return { error: "PlaceFind does not issue product licenses. Use a signed-in account." }
}

export function shopSummary() {
  const orders = readOrders()
  return {
    orderCount: orders.length,
    paidCount: orders.filter((order) => order.status === "paid").length,
    pendingCount: orders.filter((order) => order.status === "pending" || order.status === "pending_license").length,
  }
}

export function licenseKeysFromOrders(orders: Order[]): string[] {
  const seen = new Set<string>()
  const keys: string[] = []
  for (const order of orders) {
    const key = order.licenseKey?.trim() ?? ""
    if (!key || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  return keys
}

export async function attachUserLicense(_user?: PublicUser) {
  return licenseStatus()
}
