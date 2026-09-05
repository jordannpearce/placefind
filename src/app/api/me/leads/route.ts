import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { canViewAssignedLeads, leadsForAccount, publicLeadForAgency } from "@/lib/leads"

export async function GET() {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const db = await readDb()
  if (!canViewAssignedLeads(auth.user, db.users, db.leads)) {
    return NextResponse.json({ error: "No assigned leads on this account." }, { status: 403 })
  }
  const leads = leadsForAccount(auth.user, db.users, db.leads).map((lead) =>
    publicLeadForAgency(lead, db.users, auth.user.id)
  )
  return NextResponse.json({
    leads,
    agencyName:
      (auth.user.agencyId && db.agencies.find((agency) => agency.id === auth.user.agencyId)?.name) ||
      auth.user.company ||
      auth.user.name,
  })
}
