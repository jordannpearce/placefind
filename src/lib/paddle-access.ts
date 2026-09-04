import type { PaddleCustomer, PaddleSubscription, User, UserRole } from "./types"

export const DEMO_EMAIL = "demo@gridpin.app"
export const DEMO_USER_ID = "user_demo"

export const BILLING_REQUIRED_CODE = "billing_required"

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
  const granting = subscriptions.filter(subscriptionGrantsAccess)
  if (granting.length > 0) {
    return granting.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  }
  const latest = [...subscriptions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return latest[0] ?? null
}

export function isDemoAccount(user: Pick<User, "id" | "email"> | { id?: string; email: string }): boolean {
  if (user.id === DEMO_USER_ID) return true
  return user.email.trim().toLowerCase() === DEMO_EMAIL
}

export function hasComplimentarySoftwareAccess(
  user: Pick<User, "id" | "email" | "role"> | { id?: string; email: string; role: UserRole | string }
): boolean {
  return user.role === "admin" || isDemoAccount(user)
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
export function userHasSoftwareAccess(
  user: Pick<User, "id" | "email" | "role" | "paddleCustomerId">,
  mirror: BillingMirror
): boolean {
  if (hasComplimentarySoftwareAccess(user)) return true
  return subscriptionGrantsAccess(pickAccessSubscription(subscriptionsForUser(user, mirror)))
}

/**
 * Where to send a signed-in user who is not current.
 * Never-subscribed → pricing. Existing Paddle customer → account (portal).
 */
export function billingPathForUser(
  user: Pick<User, "id" | "email" | "role" | "paddleCustomerId">,
  mirror: BillingMirror
): string {
  if (hasComplimentarySoftwareAccess(user)) return "/dashboard"
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

export function billingRequiredPayload(
  user: Pick<User, "id" | "email" | "role" | "paddleCustomerId">,
  mirror: BillingMirror
) {
  return {
    error:
      "An active GridPins subscription is required to use the tracker, run ranking scans, or change workspace campaigns.",
    code: BILLING_REQUIRED_CODE,
    billingUrl: billingPathForUser(user, mirror),
  }
}
