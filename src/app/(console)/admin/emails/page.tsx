import Link from "next/link"

import { AdminMailer } from "@/components/admin-mailer"
import { AdminResend } from "@/components/admin-resend"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { maskSecret, resolveResendConfig } from "@/lib/mail"

export default async function AdminEmailsPage() {
  const admin = await requireAdmin()
  if (!admin) return null
  const db = await readDb()
  const emails = db.emails
  const resolved = await resolveResendConfig()
  const agencies = Object.fromEntries(db.agencies.map((agency) => [agency.id, agency.name]))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl tracking-tight">Email</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure Resend, then pick accounts for marketing, updates, and notifications.
          </p>
        </div>
        <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
          Users
        </Link>
      </div>
      <div className="mt-8">
        <AdminResend
          initial={{
            hasResendKey: Boolean(resolved.apiKey),
            resendKeyLast4: maskSecret(resolved.apiKey),
            resendFrom: db.settings.resendFrom || resolved.from,
            source: resolved.source,
          }}
        />
      </div>
      <div className="mt-8">
        <AdminMailer
          users={db.users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            status: user.status,
            marketingOptIn: user.marketingOptIn,
            company: user.company,
            agencyName: agencies[user.agencyId] || user.company,
          }))}
        />
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
                  <td className="px-3 py-2 capitalize">{email.kind.replaceAll("_", " ")}</td>
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
