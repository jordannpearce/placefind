import type { PaddleCustomer, PaddleSubscription, User, UserRole, UserStatus } from "./types"

type AccessUser = Pick<User, "id" | "email" | "role" | "paddleCustomerId" | "trialEndsAt"> & {
  status?: UserStatus | string
}

export const BILLING_REQUIRED_CODE = "billing_required"

export type TrialUnit = "hours" | "days"

export function isTrialUnit(value: unknown): value is TrialUnit {
  return value === "hours" || value === "days"
}

/** Compute `trial_ends_at` from a duration starting at `from` (default now). 0 or invalid → null. */
export function computeTrialEndsAt(
  amount: number,
  unit: TrialUnit,
  from: Date = new Date()
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null
  const ms = unit === "hours" ? amount * 3_600_000 : amount * 86_400_000
  return new Date(from.getTime() + ms).toISOString()
}

export function parseTrialEndsAt(value: unknown): string | null {
  if (value == null || value === "") return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const ends = Date.parse(trimmed)
  return Number.isFinite(ends) ? new Date(ends).toISOString() : null
}

/** True when an admin-granted `trialEndsAt` is still in the future. */
export function trialStillOpen(
  user: Pick<User, "trialEndsAt"> | { trialEndsAt?: string | null },
  now: number = Date.now()
): boolean {
  const raw = user.trialEndsAt
  if (!raw) return false
  const ends = Date.parse(raw)
  return Number.isFinite(ends) && ends > now
}

/**
 * Whether a mirrored Paddle subscription currently grants paid GridPins access.
 *
 * Grants software access:
 * - `active` — current paying subscription
 *
 * Does not grant software access:
 * - no subscription / missing customer
 * - `canceled`, `paused`, `past_due`, `expired`, or any other status
 * - `trialing` — GridPins does not offer trials
 *
 * A `scheduled_change` to cancel or pause does **not** revoke access. Status stays
 * `active` until the change date; only then does Paddle flip status. Revoke only
 * when `status` is actually no longer `active`.
 *
 * Unpaid users stay signed in so they can reach Account, pricing, and the portal.
 */
export function subscriptionGrantsAccess(
  subscription: Pick<PaddleSubscription, "status"> | { status: string } | null | undefined
): boolean {
  if (!subscription) return false
  return subscription.status.trim().toLowerCase() === "active"
}

export function subscriptionRevokesAccess(
  subscription: Pick<PaddleSubscription, "status"> | { status: string } | null | undefined
): boolean {
  if (!subscription) return false
  const status = subscription.status.trim().toLowerCase()
  return status === "canceled" || status === "paused" || status === "expired"
}

export function pickAccessSubscription(subscriptions: PaddleSubscription[]): PaddleSubscription | null {
  const planSubs = subscriptions.filter((row) => row.kind !== "ai_visibility")
  const granting = planSubs.filter(subscriptionGrantsAccess)
  if (granting.length > 0) {
    return granting.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  }
  const latest = [...planSubs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return latest[0] ?? null
}

/** Admin-suspended accounts stay signed in for billing, but the tracker/scans lock. Admins are never blocked. */
export function accountIsSuspended(
  user: { role?: UserRole | string; status?: UserStatus | string } | null | undefined
): boolean {
  if (!user || user.role === "admin") return false
  return user.status === "suspended"
}

export function hasComplimentarySoftwareAccess(
  user:
    | Pick<User, "id" | "email" | "role" | "trialEndsAt">
    | { id?: string; email: string; role: UserRole | string; trialEndsAt?: string | null; status?: UserStatus | string }
): boolean {
  if (accountIsSuspended(user)) return false
  return user.role === "admin" || trialStillOpen(user)
}

export function findCustomerIdForUser(
  user: Pick<User, "email" | "paddleCustomerId">,
  customers: Array<Pick<PaddleCustomer, "customerId" | "email">>
): string {
  if (user.paddleCustomerId) return user.paddleCustomerId
  const email = user.email.trim().toLowerCase()
  return customers.find((row) => row.email === email)?.customerId || ""
}

export type BillingMirror = {
  customers: Array<Pick<PaddleCustomer, "customerId" | "email">>
  subscriptions: PaddleSubscription[]
}

export function subscriptionsForUser(
  user: Pick<User, "email" | "paddleCustomerId">,
  mirror: BillingMirror
): PaddleSubscription[] {
  const customerId = findCustomerIdForUser(user, mirror.customers)
  if (!customerId) return []
  return mirror.subscriptions.filter((row) => row.customerId === customerId)
}

/** True when this account may use the tracker, scans, and workspace product. */
export function userHasSoftwareAccess(user: AccessUser, mirror: BillingMirror): boolean {
  if (accountIsSuspended(user)) return false
  if (hasComplimentarySoftwareAccess(user)) return true
  return subscriptionGrantsAccess(pickAccessSubscription(subscriptionsForUser(user, mirror)))
}

/**
 * Where to send a signed-in user who is not current.
 * Never-subscribed → pricing. Existing Paddle customer → account (portal).
 */
export function billingPathForUser(user: AccessUser, mirror: BillingMirror): string {
  if (userHasSoftwareAccess(user, mirror)) return "/dashboard"
  const customerId = findCustomerIdForUser(user, mirror.customers)
  return customerId ? "/account?billing=required" : "/pricing?billing=required"
}

const ALLOWED_UNPAID_PREFIXES = [
  "/pricing",
  "/welcome",
  "/account",
  "/forgot-password",
  "/reset-password",
  "/contact",
  "/get-found",
  "/terms",
  "/privacy",
  "/email-policy",
  "/refunds",
  "/why-grids",
  "/ai-visibility",
  "/login",
  "/signup",
  "/verify",
]

export function isSafeInternalPath(path: string | null | undefined): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\"))
}

export function isAllowedUnpaidPath(path: string): boolean {
  return ALLOWED_UNPAID_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function postLoginPath(input: {
  next?: string | null
  current: boolean
  role: UserRole | string
  billingPath: string
}): string {
  const next = isSafeInternalPath(input.next) ? input.next : null
  if (input.current) {
    if (next) return next
    return input.role === "admin" ? "/admin" : "/dashboard"
  }
  if (next && isAllowedUnpaidPath(next)) return next
  return input.billingPath
}

export function billingRequiredPayload(user: AccessUser, mirror: BillingMirror) {
  return {
    error:
      "An active GridPins subscription is required to use the tracker, run ranking scans, or change workspace campaigns.",
    code: BILLING_REQUIRED_CODE,
    billingUrl: billingPathForUser(user, mirror),
  }
}
