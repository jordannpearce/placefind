import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { infoEmail, marketingEmail } from "@/lib/email-templates"
import { sendMail } from "@/lib/mail"
import type { EmailKind } from "@/lib/types"

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const emails = readDb().emails.map((item) => ({
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
  let body: { kind?: EmailKind; headline?: string; body?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const kind = body.kind === "marketing" ? "marketing" : "info"
  const headline = body.headline?.trim()
  const text = body.body?.trim()
  if (!headline || !text) {
    return NextResponse.json({ error: "Headline and body are required." }, { status: 400 })
  }

  const db = readDb()
  const recipients = db.users.filter((user) => {
    if (user.status !== "active") return false
    if (kind === "marketing") return user.marketingOptIn
    return true
  })

  let sent = 0
  for (const user of recipients) {
    const template =
      kind === "marketing" ? marketingEmail(user.name, headline, text) : infoEmail(user.name, headline, text)
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
    message:
      kind === "marketing"
        ? `Sent to ${sent} opted-in accounts.`
        : `Sent a product update to ${sent} active accounts.`,
  })
}
