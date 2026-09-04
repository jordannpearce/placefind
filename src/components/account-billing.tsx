import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { PLANS } from "@/lib/plans"
import { subscriptionGrantsAccess } from "@/lib/paddle-access"
import type { PaddleSubscription, PlanId } from "@/lib/types"

export type AccountBillingProps = {
  customerId: string
  subscription: PaddleSubscription | null
  plan: PlanId
  missing: boolean
}

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "Active"
    case "trialing":
      return "Trial"
    case "past_due":
      return "Past due — update your payment method"
    case "paused":
      return "Paused"
    case "canceled":
      return "Canceled"
    default:
      return status
  }
}

export function AccountBilling({ customerId, subscription, plan, missing }: AccountBillingProps) {
  const paid = subscriptionGrantsAccess(subscription)
  const scheduled =
    subscription?.scheduledChangeAction && subscription.scheduledChangeAt
      ? `${subscription.scheduledChangeAction} on ${new Date(subscription.scheduledChangeAt).toLocaleDateString()}`
      : null

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <h2 className="font-heading text-2xl">Billing</h2>
      <p className="text-sm text-muted-foreground">
        Payment method, invoices, and cancellation are handled by Paddle, our payment processor.
        You stay signed in here even if a subscription is paused or canceled.
      </p>
      <p className="text-sm">
        Current plan: <span className="font-medium">{PLANS[plan].name}</span>
        {subscription ? ` · ${statusLabel(subscription.status)}` : ""}
        {scheduled ? ` · Scheduled ${scheduled}` : ""}
        {paid ? "" : " · Entry limits apply until a subscription is active"}
      </p>
      {missing || !customerId ? (
        <div className="rounded-xl border bg-background p-4">
          <p className="text-sm">
            No Paddle billing profile is linked to this account yet. Subscribe from pricing — we
            will not invent a customer for you.
          </p>
          <Link href="/pricing" className={buttonVariants({ className: "mt-3" })}>
            See plans
          </Link>
        </div>
      ) : (
        <form action="/api/billing/portal" method="POST">
          <button type="submit" className={buttonVariants({ size: "lg" })}>
            Manage billing
          </button>
        </form>
      )}
    </section>
  )
}
