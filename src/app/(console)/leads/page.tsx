import { redirect } from "next/navigation"

import { AgencyLeads } from "@/components/agency-leads"
import { requireUser } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { canViewAssignedLeads, leadsForAccount, publicLeadForAgency } from "@/lib/leads"

export default async function AgencyLeadsPage() {
  const auth = await requireUser()
  if (!auth) return null
  const db = await readDb()
  if (!canViewAssignedLeads(auth.user, db.users, db.leads)) {
    redirect("/dashboard")
  }

  const leads = leadsForAccount(auth.user, db.users, db.leads).map((lead) =>
    publicLeadForAgency(lead, db.users, auth.user.id)
  )
  const agencyName =
    (auth.user.agencyId && db.agencies.find((agency) => agency.id === auth.user.agencyId)?.name) ||
    auth.user.company ||
    auth.user.name

  return <AgencyLeads initial={{ leads, agencyName }} />
}
