import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { infoEmail, marketingEmail, notificationEmail } from "@/lib/email-templates"
import { sendMail } from "@/lib/mail"
import type { EmailKind } from "@/lib/types"

const BROADCAST_KINDS: EmailKind[] = ["info", "marketing", "notification"]

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const db = await readDb()
  const emails = db.emails.map((item) => ({
    id: item.id,
    to: item.to,
    subject: item.subject,
    kind: item.kind,
    provider: item.provider,
    createdAt: item.createdAt,
  }))
  return NextResponse.json({ emails })
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  let body: { kind?: EmailKind; headline?: string; body?: string; userIds?: string[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const kind = BROADCAST_KINDS.includes(body.kind as EmailKind) ? (body.kind as EmailKind) : "info"
  const headline = body.headline?.trim()
  const text = body.body?.trim()
  if (!headline || !text) {
    return NextResponse.json({ error: "Headline and body are required." }, { status: 400 })
  }
  const selected = new Set(body.userIds ?? [])
  if (selected.size === 0) {
    return NextResponse.json({ error: "Select at least one account." }, { status: 400 })
  }

  const db = await readDb()
  const recipients = db.users.filter((user) => selected.has(user.id) && user.status !== "suspended")
  if (recipients.length === 0) {
    return NextResponse.json({ error: "None of the selected accounts can receive mail." }, { status: 400 })
  }

  let sent = 0
  for (const user of recipients) {
    const template =
      kind === "marketing"
        ? marketingEmail(user.name, headline, text)
        : kind === "notification"
          ? notificationEmail(user.name, headline, text)
          : infoEmail(user.name, headline, text)
    await sendMail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      kind,
      userId: user.id,
    })
    sent += 1
  }

  return NextResponse.json({
    ok: true,
    sent,
    message: `Sent ${kind} email to ${sent} account${sent === 1 ? "" : "s"}.`,
  })
}
