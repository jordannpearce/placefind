import Link from "next/link"

import { AdminAgencies } from "@/components/admin-agencies"
import { AdminUsers } from "@/components/admin-users"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { publicUser } from "@/lib/session"

export default async function AdminPage() {
  const admin = await requireAdmin()
  if (!admin) return null
  const db = await readDb()
  const agenciesById = Object.fromEntries(db.agencies.map((agency) => [agency.id, agency.name]))
  const users = db.users.map((user) => ({
    ...publicUser(user),
    agencyName: agenciesById[user.agencyId] || user.company || "Independent",
    campaignCount: db.workspaces[user.id]?.campaigns.length ?? 0,
  }))
  const agencies = db.agencies.map((agency) => ({
    ...agency,
    userCount: db.users.filter((user) => user.agencyId === agency.id).length,
  }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {db.users.length} accounts · {db.agencies.length} agencies · {db.emails.length} emails in the
            outbox
          </p>
        </div>
        <Link href="/admin/emails" className={buttonVariants({ variant: "outline" })}>
          Emails & Resend
        </Link>
      </div>
      <div className="mt-8">
        <AdminAgencies agencies={agencies} />
      </div>
      <div className="mt-8">
        <AdminUsers users={users} agencies={db.agencies} currentUserId={admin.user.id} />
      </div>
    </div>
  )
}
