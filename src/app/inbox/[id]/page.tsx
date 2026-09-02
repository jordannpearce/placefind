import Link from "next/link"
import { notFound } from "next/navigation"

import { requireAdmin, requireUser } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export default async function InboxPage({ params }: Params) {
  const { id } = await params
  const record = readDb().emails.find((item) => item.id === id)
  if (!record) notFound()

  const user = await requireUser()
  const admin = await requireAdmin()
  const allowed =
    record.provider === "preview" ||
    Boolean(admin) ||
    Boolean(user && (user.id === record.userId || user.email === record.to))
  if (!allowed) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={admin ? "/admin/emails" : "/dashboard"} className="text-sm text-primary hover:underline">
        Back
      </Link>
      <p className="mt-6 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {record.kind} · {record.provider}
      </p>
      <h1 className="font-heading mt-2 text-3xl">{record.subject}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        To {record.to} · {new Date(record.createdAt).toLocaleString()}
      </p>
      <div className="mt-6 overflow-hidden rounded-2xl border bg-white">
        <iframe title={record.subject} className="min-h-[640px] w-full" srcDoc={record.html} />
      </div>
    </div>
  )
}
