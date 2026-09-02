import { Resend } from "resend"

import { readDb, updateDb } from "./db"
import type { EmailKind, MailRecord } from "./types"
import { randomToken } from "./password"

export function maskSecret(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (trimmed.length <= 4) return "••••"
  return `••••${trimmed.slice(-4)}`
}

export async function resolveResendConfig() {
  const db = await readDb()
  const apiKey = db.settings.resendApiKey.trim() || process.env.RESEND_API_KEY?.trim() || ""
  const from =
    db.settings.resendFrom.trim() ||
    process.env.RESEND_FROM?.trim() ||
    "GridPins <beth.t@example.com>"
  return {
    apiKey,
    from,
    source: db.settings.resendApiKey.trim() ? ("admin" as const) : apiKey ? ("env" as const) : ("none" as const),
  }
}

export async function sendMail(input: {
  to: string
  subject: string
  html: string
  kind: EmailKind
  userId?: string | null
}): Promise<MailRecord> {
  const id = `mail_${Date.now()}_${randomToken().slice(0, 8)}`
  const { apiKey, from } = await resolveResendConfig()
  let provider: MailRecord["provider"] = "preview"

  if (apiKey) {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    })
    if (result.error) {
      throw new Error(result.error.message)
    }
    provider = "resend"
  }

  const record: MailRecord = {
    id,
    to: input.to,
    subject: input.subject,
    html: input.html,
    kind: input.kind,
    userId: input.userId ?? null,
    provider,
    createdAt: new Date().toISOString(),
  }

  await updateDb((db) => {
    db.emails.unshift(record)
    db.emails = db.emails.slice(0, 200)
  })

  return record
}

export function previewUrl(id: string) {
  return `/inbox/${id}`
}
