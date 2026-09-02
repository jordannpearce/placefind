import { Resend } from "resend"

import { AUTH_FROM, SUPPORT_FROM, SUPPORT_INBOX } from "./company"
import { DEFAULT_RESEND_FROM, readDb, updateDb } from "./db"
import type { EmailKind, MailRecord } from "./types"
import { randomToken } from "./password"

export { AUTH_FROM, SUPPORT_FROM, SUPPORT_INBOX }

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
    DEFAULT_RESEND_FROM
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
  from?: string
  replyTo?: string
}): Promise<MailRecord> {
  const id = `mail_${Date.now()}_${randomToken().slice(0, 8)}`
  const { apiKey, from } = await resolveResendConfig()
  let provider: MailRecord["provider"] = "preview"
  const sender = input.from?.trim() || from

  if (apiKey) {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: sender,
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
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

/** Account mail (activation, reset, welcome) always from hello@info.gridpins.com. */
export async function sendAuthMail(input: {
  to: string
  subject: string
  html: string
  kind: Extract<EmailKind, "activation" | "account_created" | "password_reset">
  userId?: string | null
}): Promise<MailRecord> {
  return sendMail({
    ...input,
    from: AUTH_FROM,
  })
}

export function previewUrl(id: string) {
  return `/inbox/${id}`
}

/** Public contact / lead mail must actually send. Never fall back to a silent local drop. */
export async function sendSupportInbox(input: {
  subject: string
  html: string
  kind: EmailKind
  replyTo: string
}): Promise<MailRecord> {
  const { apiKey } = await resolveResendConfig()
  if (!apiKey) {
    throw new Error("MAIL_NOT_CONFIGURED")
  }
  return sendMail({
    to: SUPPORT_INBOX,
    from: SUPPORT_FROM,
    replyTo: input.replyTo,
    subject: input.subject,
    html: input.html,
    kind: input.kind,
  })
}
