import { NextResponse } from "next/server"

import { MISSING_MAIL_ERROR, SUPPORT_INBOX } from "@/lib/company"
import { leadInboxEmail } from "@/lib/email-templates"
import { sendSupportInbox } from "@/lib/mail"
import { isHoneypotTripped, parseGetFoundInquiry } from "@/lib/public-forms"
import { clientIp, consumeRateLimit } from "@/lib/rate-limit"
import { persistLead, upsertMarketingContact } from "@/lib/resend-audience"

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (isHoneypotTripped(body)) {
    return NextResponse.json({ ok: true })
  }

  const limited = consumeRateLimit(`get-found:${clientIp(request)}`)
  if (!limited.ok) {
    return NextResponse.json(
      {
        error: `Too many submissions. Wait a few minutes or email ${SUPPORT_INBOX}.`,
      },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    )
  }

  if (body.marketingConsent !== true) {
    return NextResponse.json(
      { error: "Agree to receive marketing and information emails from GridPins to submit." },
      { status: 400 }
    )
  }

  const parsed = parseGetFoundInquiry(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const audience = await upsertMarketingContact(parsed.data)
  await persistLead(parsed.data, audience.synced)

  if (audience.error === "MAIL_NOT_CONFIGURED") {
    return NextResponse.json({ error: MISSING_MAIL_ERROR }, { status: 503 })
  }

  const template = leadInboxEmail(parsed.data)
  try {
    await sendSupportInbox({
      subject: template.subject,
      html: template.html,
      kind: "lead",
      replyTo: parsed.data.email,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "MAIL_NOT_CONFIGURED") {
      return NextResponse.json({ error: MISSING_MAIL_ERROR }, { status: 503 })
    }
    if (!audience.synced) {
      return NextResponse.json(
        {
          error:
            error instanceof Error && error.message
              ? `We couldn’t complete your opt-in: ${error.message}`
              : MISSING_MAIL_ERROR,
        },
        { status: 502 }
      )
    }
  }

  return NextResponse.json({ ok: true, list: audience.synced ? "remote" : "local" })
}
