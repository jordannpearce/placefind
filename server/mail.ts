import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { formatQuoteAddress } from "../src/lib/quotes.ts"
import { maskSecret } from "./keygen.ts"
import { readProduct } from "./product.ts"
import { dataDir, readCollection, writeCollection } from "./store.ts"

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

const MAIL_CONFIG_ROW = "default"
const MAIL_SEAL_SECRET = "placefind-mail-v1"
const TEST_ONLY_FROM = "onboarding@resend.dev"

let lastDatabaseWriteOk = false
let cachedMail: MailConfig | null = null

function emptyMailConfig(): MailConfig {
  return { resendApiKey: "", fromEmail: "", fromName: "" }
}

function rememberMail(config: Partial<MailConfig>): MailConfig {
  cachedMail = {
    resendApiKey: config.resendApiKey?.trim() || "",
    fromEmail: config.fromEmail?.trim() || "",
    fromName: config.fromName?.trim() || "",
  }
  return { ...cachedMail }
}

function pickMailField(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return undefined
}

export function normalizeMailInput(input?: Record<string, unknown> | null): Partial<MailConfig> {
  const raw = input ?? {}
  return {
    resendApiKey: pickMailField(raw, ["resendApiKey", "apiKey", "mailKey", "RESEND_API_KEY"]),
    fromEmail: pickMailField(raw, ["fromEmail", "from_email", "RESEND_FROM_EMAIL"]),
    fromName: pickMailField(raw, ["fromName", "from_name", "RESEND_FROM_NAME"]),
  }
}

function configFile() {
  return path.join(dataDir(), "mail.json")
}

function postgresUrl() {
  const url = process.env.DATABASE_URL?.trim() ?? ""
  return /^postgres(ql)?:\/\//i.test(url) ? url : ""
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback
    return { ...fallback, ...(JSON.parse(readFileSync(file, "utf8")) as Partial<T>) }
  } catch {
    return fallback
  }
}

function mailMaterial() {
  return scryptSync(MAIL_SEAL_SECRET, "placefind-mail-salt", 32)
}

export function sealMailConfig(config: MailConfig): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", mailMaterial(), iv)
  const encoded = Buffer.concat([cipher.update(JSON.stringify(config), "utf8"), cipher.final()])
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encoded.toString("base64"),
  })
}

export function openSealedMail(raw: string): Partial<MailConfig> | null {
  try {
    const parsed = JSON.parse(raw) as {
      v?: number
      iv?: string
      tag?: string
      data?: string
      resendApiKey?: string
      fromEmail?: string
      fromName?: string
    }
    if (parsed.v === 1 && parsed.iv && parsed.tag && parsed.data) {
      const decipher = createDecipheriv("aes-256-gcm", mailMaterial(), Buffer.from(parsed.iv, "base64"))
      decipher.setAuthTag(Buffer.from(parsed.tag, "base64"))
      const plain = Buffer.concat([
        decipher.update(Buffer.from(parsed.data, "base64")),
        decipher.final(),
      ]).toString("utf8")
      return JSON.parse(plain) as MailConfig
    }
    if (parsed.resendApiKey || parsed.fromEmail || parsed.fromName) {
      return parsed
    }
  } catch {
    return null
  }
  return null
}

export function isTestOnlyFromAddress(email: string) {
  return email.trim().toLowerCase() === TEST_ONLY_FROM
}

function redactMailSecrets(value: string) {
  return value
    .replace(/re_[A-Za-z0-9]+/g, "re_…")
    .replace(/Bearer\s+\S+/gi, "Bearer …")
}

export function readStoredMailConfig(): MailConfig {
  if (cachedMail) return { ...cachedMail }
  const stored = readJson<MailConfig>(configFile(), emptyMailConfig())
  return rememberMail(stored)
}

export function readMailConfig(): MailConfig {
  const stored = readStoredMailConfig()
  return {
    resendApiKey: stored.resendApiKey || process.env.RESEND_API_KEY?.trim() || "",
    fromEmail: stored.fromEmail || process.env.RESEND_FROM_EMAIL?.trim() || "",
    fromName: stored.fromName || process.env.RESEND_FROM_NAME?.trim() || "PlaceFind",
  }
}

async function withPostgres<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T | null> {
  const url = postgresUrl()
  if (!url) return null
  const pg = await import("pg")
  const pool = new pg.Pool({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === "0" ? undefined : { rejectUnauthorized: false },
  })
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS mail_config (
        id TEXT PRIMARY KEY,
        sealed TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)
    return await fn(client)
  } finally {
    client.release()
    await pool.end()
  }
}

export async function hydrateMailConfig(): Promise<boolean> {
  try {
    const sealed = await withPostgres(async (client) => {
      const result = await client.query<{ sealed: string }>("SELECT sealed FROM mail_config WHERE id = $1", [
        MAIL_CONFIG_ROW,
      ])
      return result.rows[0]?.sealed ?? ""
    })
    if (!sealed) return Boolean(readStoredMailConfig().resendApiKey)
    const opened = openSealedMail(sealed)
    if (!opened) return Boolean(readStoredMailConfig().resendApiKey)
    const existing = readStoredMailConfig()
    if (existing.resendApiKey) {
      lastDatabaseWriteOk = true
      rememberMail(existing)
      return true
    }
    const next = rememberMail({
      resendApiKey: opened.resendApiKey,
      fromEmail: opened.fromEmail || existing.fromEmail,
      fromName: opened.fromName || existing.fromName,
    })
    try {
      mkdirSync(dataDir(), { recursive: true })
      writeFileSync(configFile(), JSON.stringify(next, null, 2))
    } catch {
      console.error("PlaceFind could not write hydrated mail.json.")
    }
    lastDatabaseWriteOk = Boolean(next.resendApiKey || next.fromEmail)
    return Boolean(next.resendApiKey)
  } catch {
    console.error("PlaceFind could not read saved mail settings from Postgres.")
    return Boolean(readStoredMailConfig().resendApiKey)
  }
}

export async function writeMailConfig(input?: Partial<MailConfig> | Record<string, unknown> | null): Promise<MailConfig> {
  const parsed = normalizeMailInput(input)
  const stored = readStoredMailConfig()
  const next = rememberMail({
    resendApiKey: parsed.resendApiKey || stored.resendApiKey,
    fromEmail: parsed.fromEmail || stored.fromEmail,
    fromName: parsed.fromName || stored.fromName,
  })
  let fileOk = false
  try {
    mkdirSync(dataDir(), { recursive: true })
    writeFileSync(configFile(), JSON.stringify(next, null, 2))
    fileOk = true
  } catch {
    console.error("PlaceFind could not write mail.json.")
  }
  lastDatabaseWriteOk = false
  try {
    const wrote = await withPostgres(async (client) => {
      await client.query(
        `INSERT INTO mail_config (id, sealed, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO UPDATE SET sealed = EXCLUDED.sealed, updated_at = NOW()`,
        [MAIL_CONFIG_ROW, sealMailConfig(next)],
      )
      return true
    })
    lastDatabaseWriteOk = Boolean(wrote)
  } catch {
    console.error("PlaceFind could not persist mail settings to Postgres.")
  }
  if (!fileOk && !lastDatabaseWriteOk) {
    throw new Error("Could not save mail settings.")
  }
  return next
}

export function resetMailConfigForTests() {
  cachedMail = null
  lastDatabaseWriteOk = false
}

export function mailStatus() {
  const config = readMailConfig()
  const latest = readOutbox()[0]
  return {
    configured: Boolean(config.resendApiKey),
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    keyHint: maskSecret(config.resendApiKey),
    lastError: latest && !latest.delivered ? latest.detail : "",
    testOnlyFrom: isTestOnlyFromAddress(config.fromEmail),
    savedToDatabase: lastDatabaseWriteOk,
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
      text: `Hi {{first}},\n\nYour ${product.name} account is ready.\n\n1. Sign in and open your account.\n2. Create a listing with your business name, city, and state.\n3. Open Crawl Website to list pages from your shop site.\n`,
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

export function welcomeEmail(input: {
  name: string
  product: string
  price: string
  kind?: string
}): MailMessage {
  const first = input.name.split(" ")[0] || "there"
  if (input.kind === "member") {
    return {
      to: "",
      subject: `Welcome to ${input.product}`,
      text: `Hi ${first},\n\nYour ${input.product} account is free. An admin will review it before you can leave reviews. After approval, leave reviews and request quotes. PlaceFind does not charge this account $150 — that fee is only for a business listing.\n`,
      html: `<p>Hi ${escapeHtml(first)},</p><p>Your ${escapeHtml(input.product)} account is free. An admin will review it before you can leave reviews. After approval, leave reviews and request quotes. PlaceFind does not charge this account $150 — that fee is only for a business listing.</p>`,
    }
  }
  return {
    to: "",
    subject: `Welcome to ${input.product}`,
    text: `Hi ${first},\n\nYour ${input.product} account is ready for review. An admin will approve it before you can publish a listing. After approval, sign in to add your business to the directory for $150 per month.\n`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Your ${escapeHtml(input.product)} account is ready for review. An admin will approve it before you can publish a listing. After approval, sign in to add your business to the directory for $150 per month.</p>`,
  }
}

export function accountApprovedEmail(input: { name: string; product: string; kind?: string }): MailMessage {
  const first = input.name.split(" ")[0] || "there"
  if (input.kind === "member") {
    return {
      to: "",
      subject: `${input.product} approved your account`,
      text: `Hi ${first},\n\nYour ${input.product} neighbor account is approved. You can leave reviews and request quotes.\n`,
      html: `<p>Hi ${escapeHtml(first)},</p><p>Your ${escapeHtml(input.product)} neighbor account is approved. You can leave reviews and request quotes.</p>`,
    }
  }
  return {
    to: "",
    subject: `${input.product} approved your account`,
    text: `Hi ${first},\n\nYour ${input.product} business account is approved. You can publish a listing and use owner tools.\n`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Your ${escapeHtml(input.product)} business account is approved. You can publish a listing and use owner tools.</p>`,
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

export function quoteRequestEmail(input: {
  businessName: string
  firstName: string
  lastName: string
  name: string
  email: string
  phone: string
  street: string
  city: string
  state: string
  zip: string
  service: string
}): MailMessage {
  const business = input.businessName.trim() || "this business"
  const address = formatQuoteAddress(input)
  const text = `${business} received a quote request from PlaceFind.

${input.name} is asking ${business} for a quote.

First name: ${input.firstName}
Last name: ${input.lastName}
Phone: ${input.phone}
Email: ${input.email}
Street address: ${input.street}
City: ${input.city}
State: ${input.state}
ZIP: ${input.zip}
Address: ${address}

Service needed:
${input.service}

Reply to ${input.name} at ${input.email}. PlaceFind does not take a cut of the work.
`
  return {
    to: "",
    subject: `Quote request for ${business}`,
    text,
    html: textToHtml(text),
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

function describeFromAddressProblem(fromEmail: string) {
  if (!fromEmail) {
    return "Set a verified from email in admin. The sending service only delivers from a domain you have verified."
  }
  if (isTestOnlyFromAddress(fromEmail)) {
    return "The test-only from address can only send to the account owner. Use a verified address on placefind.to for customer welcome mail."
  }
  return ""
}

function describeSendFailure(message: string, fromEmail: string) {
  const clean = redactMailSecrets(message).trim() || "The sending service rejected the message."
  const hint = describeFromAddressProblem(fromEmail)
  if (hint && /domain|from|verified|not allowed|invalid/i.test(clean)) {
    return `${clean} ${hint}`
  }
  if (hint && isTestOnlyFromAddress(fromEmail)) return `${clean} ${hint}`
  return clean
}

async function readProviderPayload(response: Response): Promise<{ id?: string; message?: string; name?: string; error?: string }> {
  const raw = await response.text()
  try {
    return JSON.parse(raw) as { id?: string; message?: string; name?: string; error?: string }
  } catch {
    return { message: raw.slice(0, 300) }
  }
}

export async function sendSignupWelcome(user: { name: string; email: string; accountKind?: string }): Promise<OutboundMail> {
  const product = readProduct()
  const welcome = welcomeEmail({
    name: user.name,
    product: product.name,
    price: product.price,
    kind: user.accountKind,
  })
  return sendMail({ ...welcome, to: user.email })
}

export async function sendAccountApproved(user: { name: string; email: string; accountKind?: string }): Promise<OutboundMail> {
  const product = readProduct()
  const message = accountApprovedEmail({
    name: user.name,
    product: product.name,
    kind: user.accountKind,
  })
  return sendMail({ ...message, to: user.email })
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
  if (!message.to.trim()) {
    record.detail = "Saved to the outbox. The listing has no contact email yet."
    writeOutbox([record, ...readOutbox()])
    return record
  }
  if (!config.resendApiKey) {
    record.detail = "Saved to the outbox. Add a sending API key in admin."
    writeOutbox([record, ...readOutbox()])
    return record
  }
  if (!config.fromEmail) {
    record.detail = `Saved to the outbox. ${describeFromAddressProblem("")}`
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
    const payload = await readProviderPayload(response)
    if (!response.ok) {
      record.detail = describeSendFailure(
        payload.message || payload.error || payload.name || "The sending service rejected the message.",
        config.fromEmail,
      )
    } else {
      record.delivered = true
      record.detail = payload.id || "Sent."
    }
  } catch {
    record.detail = "Could not reach the sending service."
  }
  writeOutbox([record, ...readOutbox()])
  return record
}

export async function testResendConnection(input?: Partial<MailConfig>) {
  const config = {
    ...readMailConfig(),
    ...Object.fromEntries(Object.entries(input ?? {}).filter(([, value]) => value?.trim())),
  } as MailConfig
  if (!config.resendApiKey) return { ok: false, message: "Add a sending API key in admin." }
  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${config.resendApiKey}` },
    })
    if (response.status === 401) return { ok: false, message: "The sending service rejected this API key." }
    if (!response.ok) return { ok: false, message: "The sending service did not accept this key." }
    const fromProblem = describeFromAddressProblem(config.fromEmail)
    if (fromProblem) return { ok: false, message: `The key works. ${fromProblem}` }
    return { ok: true, message: `Ready to send. From address: ${config.fromName} <${config.fromEmail}>.` }
  } catch {
    return { ok: false, message: "Could not reach the sending service." }
  }
}
