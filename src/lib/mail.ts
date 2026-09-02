import { Resend } from "resend"

import { updateDb } from "./db"
import type { EmailKind, MailRecord } from "./types"
import { randomToken } from "./password"

export async function sendMail(input: {
  to: string
  subject: string
  html: string
  kind: EmailKind
  userId?: string | null
}): Promise<MailRecord> {
  const id = `mail_${Date.now()}_${randomToken().slice(0, 8)}`
  const apiKey = process.env.RESEND_API_KEY?.trim()
  let provider: MailRecord["provider"] = "preview"

  if (apiKey) {
    const resend = new Resend(apiKey)
    const from = process.env.RESEND_FROM?.trim() || "GridPin <beth.t@example.com>"
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
