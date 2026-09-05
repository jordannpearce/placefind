import Link from "next/link"

import { AdminAgencies } from "@/components/admin-agencies"
import { AdminAiBrands } from "@/components/admin-ai-brands"
import { AdminCloro } from "@/components/admin-cloro"
import { AdminUsers } from "@/components/admin-users"
import { buttonVariants } from "@/components/ui/button"
import { isAgencyAccount } from "@/lib/agency-account"
import { isBrandAssignableAccount, listAssignedBrands } from "@/lib/ai-visibility"
import { requireAdmin } from "@/lib/auth-guard"
import { resolveCloroApiKey } from "@/lib/cloro"
import { readDb } from "@/lib/db"
import { maskSecret } from "@/lib/mail"
import { userHasSoftwareAccess } from "@/lib/paddle-access"
import { publicUser } from "@/lib/session"

export default async function AdminPage() {
  const admin = await requireAdmin()
  if (!admin) return null
  const db = await readDb()
  const agenciesById = Object.fromEntries(db.agencies.map((agency) => [agency.id, agency.name]))
  const users = db.users.map((user) => ({
    ...publicUser(user),
    agencyName: (user.agencyId && agenciesById[user.agencyId]) || "Independent",
    campaignCount: db.workspaces[user.id]?.campaigns.length ?? 0,
  }))
  const agencies = db.agencies.map((agency) => ({
    ...agency,
    userCount: db.users.filter((user) => user.agencyId === agency.id).length,
  }))
  const cloroKey = await resolveCloroApiKey(db.settings.cloroApiKey)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {db.users.length} accounts · {db.agencies.length} agencies · {db.emails.length} emails in
            the outbox. Add, edit, or delete users and any AI brand below. Get Found leads live under
            Leads.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/leads" className={buttonVariants({ variant: "outline" })}>
            Leads
          </Link>
          <Link href="/admin/emails" className={buttonVariants({ variant: "outline" })}>
            Emails & Resend
          </Link>
        </div>
      </div>
      <div className="mt-8">
        <AdminAiBrands
          initial={{
            brands: listAssignedBrands(db.users, db.agencies),
            users: db.users
              .filter((user) => user.role !== "admin")
              .map((user) => ({
                id: user.id,
                name: user.name,
                email: user.email,
                company: user.company,
                plan: user.plan,
                status: user.status,
                agencyId: user.agencyId,
                softwareAccess: userHasSoftwareAccess(user, db),
              })),
            agencies: db.agencies.map((agency) => ({
              id: agency.id,
              name: agency.name,
              userCount: db.users.filter((user) => user.agencyId === agency.id && isBrandAssignableAccount(user))
                .length,
            })),
          }}
        />
      </div>
      <div className="mt-8">
        <AdminCloro
          initial={{
            hasCloroKey: Boolean(cloroKey),
            cloroKeyLast4: maskSecret(cloroKey),
            cloroSource: db.settings.cloroApiKey.trim() ? "admin" : cloroKey ? "env" : "none",
            aiVisibilityPriceId: db.settings.aiVisibilityPriceId,
            aiVisibilityProductId: db.settings.aiVisibilityProductId,
          }}
        />
      </div>
      <div className="mt-8">
        <AdminAgencies
          agencies={agencies}
          users={users.filter((user) => isAgencyAccount(user))}
          currentUserId={admin.user.id}
        />
      </div>
      <div className="mt-8">
        <AdminUsers users={users} agencies={db.agencies} currentUserId={admin.user.id} />
      </div>
    </div>
  )
}
