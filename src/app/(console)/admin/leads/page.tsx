import Link from "next/link"

import { AdminLeads } from "@/components/admin-leads"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth-guard"

export default async function AdminLeadsPage() {
  const admin = await requireAdmin()
  if (!admin) return null

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Get Found opt-ins. Assign Pro or Advanced agencies and invoice the current cost per lead.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
            Users
          </Link>
          <Link href="/admin/emails" className={buttonVariants({ variant: "outline" })}>
            Emails
          </Link>
        </div>
      </div>
      <div className="mt-8">
        <AdminLeads />
      </div>
    </div>
  )
}
