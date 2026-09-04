import { BillingRequired } from "@/components/billing-required"
import { TrackerApp } from "@/components/tracker-app"
import { requireUserOrRedirect } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { findCustomerIdForUser, pickAccessSubscription, subscriptionsForUser, userHasSoftwareAccess } from "@/lib/paddle-access"

export default async function TrackPage() {
  const auth = await requireUserOrRedirect()
  const db = await readDb()
  if (userHasSoftwareAccess(auth.user, db)) {
    return <TrackerApp />
  }
  return (
    <BillingRequired
      hasCustomer={Boolean(findCustomerIdForUser(auth.user, db.customers))}
      subscription={pickAccessSubscription(subscriptionsForUser(auth.user, db))}
    />
  )
}
