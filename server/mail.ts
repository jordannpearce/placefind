import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { maskSecret } from "./keygen.ts"

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

const DATA_DIR = path.resolve(process.cwd(), ".data")
const CONFIG_FILE = path.join(DATA_DIR, "mail.json")
const OUTBOX_FILE = path.join(DATA_DIR, "mail-outbox.json")

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
  try {
    if (!existsSync(OUTBOX_FILE)) return []
    const rows = JSON.parse(readFileSync(OUTBOX_FILE, "utf8")) as OutboundMail[]
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

function writeOutbox(rows: OutboundMail[]) {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(OUTBOX_FILE, JSON.stringify(rows.slice(0, 50), null, 2))
}

export function welcomeEmail(input: { name: string; product: string; price: string }): MailMessage {
  const first = input.name.split(" ")[0] || "there"
  return {
    to: "",
    subject: `Welcome to ${input.product}`,
    text: `Hi ${first},\n\nYour ${input.product} account is ready. Buy a license from your account page to get a Keygen key and the Windows setup.\n\nPlaceFind costs $${input.price} for one Windows license.\n`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Your ${escapeHtml(input.product)} account is ready. Buy a license to get a Keygen key and the Windows setup.</p><p>PlaceFind costs $${escapeHtml(input.price)} for one Windows license.</p>`,
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
    subject: `Your ${input.product} license key`,
    text: `Hi ${first},\n\nThanks for buying ${input.product}. Here is your license key:\n\n${input.key}\n\n1. Download the Windows setup: ${input.downloadUrl}\n2. Install PlaceFind on Windows 10 or 11.\n3. Paste this key when the app asks you to unlock.\n\nKeep this email. The key is tied to your purchase.\n`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Thanks for buying ${escapeHtml(input.product)}. Here is your license key:</p><p style="font-family:ui-monospace,monospace;font-size:16px;padding:12px;border:1px solid #3d362c;background:#17140f;color:#f3ead8">${escapeHtml(input.key)}</p><ol><li>Download the Windows setup: <a href="${escapeHtml(input.downloadUrl)}">${escapeHtml(input.downloadUrl)}</a></li><li>Install PlaceFind on Windows 10 or 11.</li><li>Paste this key when the app asks you to unlock.</li></ol><p>Keep this email. The key is tied to your purchase.</p>`,
  }
}

export function pendingLicenseEmail(input: { name: string; product: string }): MailMessage {
  const first = input.name.split(" ")[0] || "there"
  return {
    to: "",
    subject: `We received your ${input.product} order`,
    text: `Hi ${first},\n\nYour ${input.product} order is in. We will email your license key as soon as it is issued.\n`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Your ${escapeHtml(input.product)} order is in. We will email your license key as soon as it is issued.</p>`,
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
