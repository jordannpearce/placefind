import type { PaddleSubscription } from "./types"

/**
 * Whether a mirrored Paddle subscription currently grants paid GridPins access.
 *
 * Grants access:
 * - `active` — current paying subscription
 * - `trialing` — in a trial period
 * - `past_due` — latest charge failed; Paddle is retrying (keep access during dunning)
 *
 * Does not grant access:
 * - `paused` — billing and service are stopped
 * - `canceled` — cancellation has taken effect
 * - any other / unknown status
 *
 * A `scheduled_change` to cancel or pause does **not** revoke access. Status stays
 * `active` until the change date; only then does Paddle flip status to `canceled`
 * or `paused`. Revoke only when `status` is actually `canceled` or `paused`.
 *
 * Unpaid GridPins users stay on the Entry (`starter`) plan so they can still sign
 * in and reach Account / billing. Campaign limits follow `users.plan`.
 */
export function subscriptionGrantsAccess(
  subscription: Pick<PaddleSubscription, "status"> | { status: string } | null | undefined
): boolean {
  if (!subscription) return false
  const status = subscription.status.trim().toLowerCase()
  return status === "active" || status === "trialing" || status === "past_due"
}

export function subscriptionRevokesAccess(
  subscription: Pick<PaddleSubscription, "status"> | { status: string } | null | undefined
): boolean {
  if (!subscription) return false
  const status = subscription.status.trim().toLowerCase()
  return status === "canceled" || status === "paused"
}

export function pickAccessSubscription(subscriptions: PaddleSubscription[]): PaddleSubscription | null {
  const granting = subscriptions.filter(subscriptionGrantsAccess)
  if (granting.length > 0) {
    return granting.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  }
  const latest = [...subscriptions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return latest[0] ?? null
}
