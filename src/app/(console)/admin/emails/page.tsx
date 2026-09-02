import Link from "next/link"

import { AdminMailer } from "@/components/admin-mailer"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"

export default async function AdminEmailsPage() {
  const admin = await requireAdmin()
  if (!admin) return null
  const emails = readDb().emails

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl tracking-tight">Email outbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Activation, billing, info, and marketing. Preview messages are stored locally when Resend
            is not configured.
          </p>
        </div>
        <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
          Users
        </Link>
      </div>
      <div className="mt-8">
        <AdminMailer />
      </div>
      <div className="mt-8 overflow-x-auto rounded-2xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/70 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">To</th>
              <th className="px-3 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium">Via</th>
            </tr>
          </thead>
          <tbody>
            {emails.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={5}>
                  No mail yet. Sign up a user or send a broadcast.
                </td>
              </tr>
            ) : (
              emails.map((email) => (
                <tr key={email.id} className="border-t">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(email.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 capitalize">{email.kind}</td>
                  <td className="px-3 py-2">{email.to}</td>
                  <td className="px-3 py-2">
                    <Link href={`/inbox/${email.id}`} className="hover:underline">
                      {email.subject}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">{email.provider}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
