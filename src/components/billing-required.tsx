import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import type { PaddleSubscription } from "@/lib/types"

export function BillingRequired({
  hasCustomer,
  subscription,
  compact = false,
}: {
  hasCustomer: boolean
  subscription?: PaddleSubscription | null
  compact?: boolean
}) {
  const status = subscription?.status.trim().toLowerCase() || ""
  const title = heading(status, hasCustomer)
  const body = explanation(status, hasCustomer)

  return (
    <div className={compact ? "" : "mx-auto flex max-w-2xl flex-col justify-center px-4 py-16"}>
      <section className="space-y-4 rounded-2xl border bg-card p-6">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Billing
        </p>
        <h1 className="font-heading text-3xl tracking-tight">{title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{body}</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/pricing" className={buttonVariants({ size: "lg" })}>
            {hasCustomer ? "See plans" : "Subscribe"}
          </Link>
          {hasCustomer ? (
            <form action="/api/billing/portal" method="POST">
              <button type="submit" className={buttonVariants({ variant: "outline", size: "lg" })}>
                Manage billing
              </button>
            </form>
          ) : compact ? null : (
            <Link href="/account" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Account
            </Link>
          )}
        </div>
      </section>
    </div>
  )
}

function heading(status: string, hasCustomer: boolean) {
  if (status === "past_due") return "Update your payment method"
  if (status === "paused") return "Your subscription is paused"
  if (status === "canceled" || status === "expired") return "Your subscription has ended"
  if (hasCustomer) return "Billing is not current"
  return "Subscribe to use GridPins"
}

function explanation(status: string, hasCustomer: boolean) {
  if (status === "past_due") {
    return "Your last payment did not go through, so the tracker and ranking scans are paused. Open billing to update your card. You can still sign in, manage your account, and reach pricing."
  }
  if (status === "paused") {
    return "Billing is paused, so the tracker is locked. Resume from the billing portal to run scans and campaigns again. A scheduled change does not lock you out until the pause actually starts."
  }
  if (status === "canceled" || status === "expired") {
    return "This workspace no longer has an active subscription. Subscribe again to open the tracker. If payment is already on file, manage billing to restart."
  }
  if (hasCustomer) {
    return "GridPins needs an active subscription before you can open the tracker, run ranking scans, or change workspace campaigns. Subscribe or open the billing portal to fix payment."
  }
  return "You can sign in and keep your workspace, including any starter campaign data. The map, scans, and live ranking checks stay locked until Paddle shows an active subscription. There is no trial."
}
