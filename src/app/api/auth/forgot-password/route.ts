import { NextResponse } from "next/server"

import { createHashedToken, RESET_TOKEN_TTL_MS } from "@/lib/auth-tokens"
import { appUrl, passwordResetEmail } from "@/lib/email-templates"
import { sendAuthMail } from "@/lib/mail"
import { updateDb } from "@/lib/db"
import { clientIp, consumeRateLimit } from "@/lib/rate-limit"

const GENERIC_MESSAGE = "If that email is on file, we sent a reset link."

export async function POST(request: Request) {
  let body: { email?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase() || ""
  if (!email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 })
  }

  const limited = consumeRateLimit(`forgot:${clientIp(request)}:${email}`, 8, 15 * 60 * 1000)
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many reset requests. Wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    )
  }

  let resetUrl: string | null = null
  let userId: string | null = null
  let name = ""
  await updateDb((db) => {
    const user = db.users.find((item) => item.email === email)
    if (!user || user.status === "pending") return
    const token = createHashedToken(db, user.id, "reset", RESET_TOKEN_TTL_MS)
    resetUrl = `${appUrl()}/reset-password?token=${token}`
    userId = user.id
    name = user.name
  })

  if (resetUrl) {
    try {
      const template = passwordResetEmail(name, resetUrl)
      await sendAuthMail({
        to: email,
        subject: template.subject,
        html: template.html,
        kind: "password_reset",
        userId,
      })
    } catch {
      // Same response as an unknown address so we do not reveal whether the account exists.
    }
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE })
}
