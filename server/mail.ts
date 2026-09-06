import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { maskSecret } from "./keygen.ts"
import { readCollection, writeCollection } from "./store.ts"

export type MailConfig = {
  resendApiKey: string
  fromEmail: string
  fromName: string
}

export type MailMessage = {
  to: string
  subject: string
  text: string
  html: string
}

export type OutboundMail = MailMessage & {
  id: string
  createdAt: string
  delivered: boolean
  detail: string
}

export const MAIL_TYPES = ["welcome", "activation", "marketing", "info", "updates"] as const
export type MailType = (typeof MAIL_TYPES)[number]

export type MailRecipient = {
  id: string
  name: string
  email: string
  status?: string
}

export type MailPreset = {
  type: MailType
  label: string
  subject: string
  text: string
}

export type SelectMailRecipientsInput = {
  users: MailRecipient[]
  userIds?: string[]
  all?: boolean
  includeSuspended?: boolean
}

const DATA_DIR = path.resolve(process.cwd(), ".data")
const CONFIG_FILE = path.join(DATA_DIR, "mail.json")

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback
    return { ...fallback, ...(JSON.parse(readFileSync(file, "utf8")) as Partial<T>) }
  } catch {
    return fallback
  }
}

export function readMailConfig(): MailConfig {
  const stored = readJson<MailConfig>(CONFIG_FILE, { resendApiKey: "", fromEmail: "", fromName: "" })
  return {
    resendApiKey: stored.resendApiKey || process.env.RESEND_API_KEY?.trim() || "",
    fromEmail: stored.fromEmail || process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev",
    fromName: stored.fromName || process.env.RESEND_FROM_NAME?.trim() || "PlaceFind",
  }
}

export function writeMailConfig(input: Partial<MailConfig>): MailConfig {
  const current = readMailConfig()
  const next: MailConfig = {
    resendApiKey: input.resendApiKey?.trim() || current.resendApiKey,
    fromEmail: input.fromEmail?.trim() || current.fromEmail,
    fromName: input.fromName?.trim() || current.fromName,
  }
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2))
  return next
}

export function mailStatus() {
  const config = readMailConfig()
  return {
    configured: Boolean(config.resendApiKey),
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    keyHint: maskSecret(config.resendApiKey),
  }
}

export function readOutbox(): OutboundMail[] {
  const rows = readCollection<OutboundMail>("mail_outbox")
  return Array.isArray(rows) ? rows : []
}

function writeOutbox(rows: OutboundMail[]) {
  writeCollection("mail_outbox", rows.slice(0, 200))
}

const BROADCAST_GAP_MS = 400

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there"
}

export function parseMailType(value?: string | null): MailType | "" {
  const next = String(value ?? "").trim().toLowerCase()
  if (next === "license" || next === "activation/license") return "activation"
  return MAIL_TYPES.includes(next as MailType) ? (next as MailType) : ""
}

export function mailPresets(product = { name: "PlaceFind", price: "49" }): MailPreset[] {
  return [
    {
      type: "welcome",
      label: "Welcome",
      subject: `Welcome to ${product.name}`,
      text: `Hi {{first}},\n\nYour ${product.name} account is ready. Sign in to add your business to the directory for $150 per month.\n`,
    },
    {
      type: "activation",
      label: "Confirm your listing",
      subject: `Confirm your ${product.name} listing`,
      text: `Hi {{first}},\n\nYour ${product.name} account is ready.\n\n1. Sign in and open your account.\n2. Create a listing with your business name, city, and state.\n3. Open Crawl Website to write the public profile.\n`,
    },
    {
      type: "marketing",
      label: "Marketing",
      subject: "Find local businesses in the PlaceFind directory",
      text: `Hi {{first}},\n\n${product.name} is a web directory for local businesses. Browse listings, or add your own for $150 per month.\n\nSign in when you are ready to publish a profile.\n`,
    },
    {
      type: "info",
      label: "Info",
      subject: `A note from ${product.name}`,
      text: `Hi {{first}},\n\nA quick note from the ${product.name} team. Sign in to manage your listings and scans.\n\nReply to this email if you need help with your account.\n`,
    },
    {
      type: "updates",
      label: "Updates",
      subject: `What's new in ${product.name}`,
      text: `Hi {{first}},\n\n${product.name} is a web directory. Sign in to manage listings, request a website crawl, and read reviews.\n`,
    },
  ]
}

export function textToHtml(text: string) {
  return text
    .split(/\n\n+/)
    .map((part) => `<p>${escapeHtml(part).replaceAll("\n", "<br>")}</p>`)
    .join("")
}

export function personalizeMail(template: string, user: Pick<MailRecipient, "name" | "email">) {
  return template
    .replaceAll("{{name}}", user.name)
    .replaceAll("{{first}}", firstName(user.name))
    .replaceAll("{{email}}", user.email)
}

export function resolveCampaignCopy(input: {
  type?: string
  subject?: string
  text?: string
  html?: string
  product?: { name: string; price: string }
}): { type: MailType | ""; subject: string; text: string; html: string; error?: string } {
  const type = parseMailType(input.type)
  const preset = type ? mailPresets(input.product).find((row) => row.type === type) : undefined
  const subject = (input.subject ?? "").trim() || preset?.subject || ""
  const text = (input.text ?? "").trim() || preset?.text || ""
  const html = (input.html ?? "").trim() || (text ? textToHtml(text) : "")
  if (!subject) return { type, subject, text, html, error: "Enter a subject." }
  if (!text && !html) return { type, subject, text, html, error: "Enter a message." }
  return { type, subject, text: text || subject, html }
}

export function selectMailRecipients(input: SelectMailRecipientsInput): {
  recipients: MailRecipient[]
  skipped: MailRecipient[]
  error?: string
} {
  const ids = Array.isArray(input.userIds) ? input.userIds.filter(Boolean) : []
  if (!input.all && ids.length === 0) {
    return { recipients: [], skipped: [], error: "Select at least one user, or send to all." }
  }
  const wanted = new Set(ids)
  const pool = input.all ? input.users : input.users.filter((user) => wanted.has(user.id))
  const skipped: MailRecipient[] = []
  const recipients: MailRecipient[] = []
  const seen = new Set<string>()
  for (const user of pool) {
    const email = user.email.trim().toLowerCase()
    if (!email || seen.has(email)) continue
    if (user.status === "suspended" && !input.includeSuspended) {
      skipped.push(user)
      continue
    }
    seen.add(email)
    recipients.push({ ...user, email })
  }
  if (recipients.length === 0) {
    return { recipients, skipped, error: "No matching users to email." }
  }
  return { recipients, skipped }
}

export async function sendBroadcast(input: {
  subject: string
  text: string
  html: string
  recipients: MailRecipient[]
  delayMs?: number
}): Promise<{ sent: OutboundMail[]; delivered: number; held: number }> {
  const delayMs = input.delayMs ?? BROADCAST_GAP_MS
  const sent: OutboundMail[] = []
  for (let index = 0; index < input.recipients.length; index += 1) {
    const user = input.recipients[index]
    if (index > 0 && delayMs > 0) await sleep(delayMs)
    sent.push(
      await sendMail({
        to: user.email,
        subject: personalizeMail(input.subject, user),
        text: personalizeMail(input.text, user),
        html: personalizeMail(input.html, user),
      }),
    )
  }
  return {
    sent,
    delivered: sent.filter((row) => row.delivered).length,
    held: sent.filter((row) => !row.delivered).length,
  }
}

export function welcomeEmail(input: { name: string; product: string; price: string }): MailMessage {
  const first = input.name.split(" ")[0] || "there"
  return {
    to: "",
    subject: `Welcome to ${input.product}`,
    text: `Hi ${first},\n\nYour ${input.product} account is ready. Sign in to add your business to the directory for $150 per month.\n`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Your ${escapeHtml(input.product)} account is ready. Sign in to add your business to the directory for $150 per month.</p>`,
  }
}

export function licenseEmail(input: {
  name: string
  product: string
  key: string
  downloadUrl: string
}): MailMessage {
  const first = input.name.split(" ")[0] || "there"
  return {
    to: "",
    subject: `Your ${input.product} account`,
    text: `Hi ${first},\n\nThanks for joining ${input.product}. Sign in to create a listing for $150 per month.\n`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Thanks for joining ${escapeHtml(input.product)}. Sign in to create a listing for $150 per month.</p>`,
  }
}

export function passwordResetEmail(input: { name: string; resetUrl: string }): MailMessage {
  const first = input.name.split(" ")[0] || "there"
  return {
    to: "",
    subject: "Reset your PlaceFind password",
    text: `Hi ${first},\n\nWe received a request to reset your PlaceFind password. This one-time link expires in one hour:\n\n${input.resetUrl}\n\nIf you did not ask for this, you can ignore this email. Your password will stay the same.\n`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>We received a request to reset your PlaceFind password. This one-time link expires in one hour:</p><p><a href="${escapeHtml(input.resetUrl)}">${escapeHtml(input.resetUrl)}</a></p><p>If you did not ask for this, you can ignore this email. Your password will stay the same.</p>`,
  }
}

export function pendingLicenseEmail(input: { name: string; product: string }): MailMessage {
  const first = input.name.split(" ")[0] || "there"
  return {
    to: "",
    subject: `We received your ${input.product} order`,
    text: `Hi ${first},\n\nYour ${input.product} account is in. Sign in to create a listing when you are ready.\n`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Your ${escapeHtml(input.product)} account is in. Sign in to create a listing when you are ready.</p>`,
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export async function sendMail(message: MailMessage): Promise<OutboundMail> {
  const config = readMailConfig()
  const record: OutboundMail = {
    ...message,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    delivered: false,
    detail: "",
  }
  if (!config.resendApiKey) {
    record.detail = "Saved to the outbox. Add a Resend API key to send email."
    writeOutbox([record, ...readOutbox()])
    return record
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${config.fromName} <${config.fromEmail}>`,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    })
    const payload = (await response.json()) as { id?: string; message?: string; name?: string }
    if (!response.ok) {
      record.detail = payload.message || payload.name || "Resend rejected the message."
    } else {
      record.delivered = true
      record.detail = payload.id || "Sent."
    }
  } catch {
    record.detail = "Could not reach Resend."
  }
  writeOutbox([record, ...readOutbox()])
  return record
}

export async function testResendConnection(input?: Partial<MailConfig>) {
  const config = {
    ...readMailConfig(),
    ...Object.fromEntries(Object.entries(input ?? {}).filter(([, value]) => value?.trim())),
  } as MailConfig
  if (!config.resendApiKey) return { ok: false, message: "Add a Resend API key." }
  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${config.resendApiKey}` },
    })
    if (response.status === 401) return { ok: false, message: "Resend rejected this API key." }
    if (!response.ok) return { ok: false, message: "Resend did not accept this key." }
    return { ok: true, message: `Resend is ready. From address: ${config.fromName} <${config.fromEmail}>.` }
  } catch {
    return { ok: false, message: "Could not reach Resend." }
  }
}
