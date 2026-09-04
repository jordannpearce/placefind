import { AccountBilling } from "@/components/account-billing"
import { AccountForm } from "@/components/account-form"
import { BillingRequired } from "@/components/billing-required"
import { requireUser } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { pickAccessSubscription, userHasSoftwareAccess } from "@/lib/paddle-access"
import { findPaddleCustomerId } from "@/lib/paddle-fulfillment"
import { publicUser } from "@/lib/session"

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>
}) {
  const auth = await requireUser()
  if (!auth) return null
  const params = await searchParams
  const billing = params.billing
  const missing = billing === "missing" || (Array.isArray(billing) && billing.includes("missing"))
  const locked = billing === "required" || (Array.isArray(billing) && billing.includes("required"))
  const db = await readDb()
  const customerId = findPaddleCustomerId(db, auth.user)
  const subscription = pickAccessSubscription(
    db.subscriptions.filter((row) => row.customerId === customerId)
  )
  const current = userHasSoftwareAccess(auth.user, db)
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-heading text-4xl tracking-tight">Account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Profile, plan, extra campaign slots, DataForSEO keys, and email preferences. Changing plan
        or extras sends a billing email. Paid access is provisioned from Paddle webhooks.
      </p>
      {locked || !current ? (
        <div className="mt-6">
          <BillingRequired hasCustomer={Boolean(customerId)} subscription={subscription} compact />
        </div>
      ) : null}
      <div className="mt-8 space-y-6">
        <AccountBilling
          customerId={customerId}
          subscription={subscription}
          plan={auth.user.plan}
          missing={missing}
        />
        <AccountForm user={publicUser(auth.user)} />
      </div>
    </div>
  )
}
