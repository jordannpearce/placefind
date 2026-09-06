import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { isSellerMode } from "./runtime.ts"
import { readCollection, writeCollection } from "./store.ts"

export type KeygenConfig = {
  accountId: string
  productId: string
  policyId: string
  token: string
}

export type KeygenPublicConfig = {
  accountId: string
  productId: string
}

export type IssuedLicense = {
  id: string
  key: string
  name: string
  email: string
  createdAt: string
  expiry: string | null
}

export type LicenseStatus = {
  required: boolean
  configured: boolean
  valid: boolean
  keyHint: string
  code: string
  detail: string
  expiry: string | null
  seller: boolean
}

export type ValidateResult = {
  valid: boolean
  code: string
  detail: string
  expiry: string | null
  licenseId: string | null
}

const DATA_DIR = path.resolve(process.cwd(), ".data")
const CONFIG_FILE = path.join(DATA_DIR, "keygen.json")
const PUBLIC_FILE = path.join(DATA_DIR, "keygen-public.json")
const ACTIVATED_FILE = path.join(DATA_DIR, "activated-license.json")

type ActivatedRecord = {
  key: string
  valid: boolean
  code: string
  detail: string
  expiry: string | null
  checkedAt: string
}

function emptyConfig(): KeygenConfig {
  return { accountId: "", productId: "", policyId: "", token: "" }
}

function publicFiles(): string[] {
  return [
    process.env.PLACEFIND_KEYGEN_FILE,
    path.join(process.cwd(), "release", "win-unpacked", "resources", "keygen-public.json"),
    path.join(os.homedir(), ".placefind", "keygen-public.json"),
    PUBLIC_FILE,
  ].filter((file): file is string => Boolean(file))
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback
    return { ...fallback, ...(JSON.parse(readFileSync(file, "utf8")) as Partial<T>) }
  } catch {
    return fallback
  }
}

export function maskSecret(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (trimmed.length <= 4) return "••••"
  return `${"•".repeat(Math.min(8, trimmed.length - 4))}${trimmed.slice(-4)}`
}

export function licenseMessage(code: string, detail?: string): string {
  switch (code) {
    case "VALID":
      return "License is active."
    case "EXPIRED":
      return "This license has expired."
    case "SUSPENDED":
      return "This license is suspended."
    case "BANNED":
      return "This license was revoked."
    case "NOT_FOUND":
    case "NOT_FOUND_ERROR":
      return "That license key was not found."
    case "TOO_MANY_MACHINES":
      return "This license is already used on too many computers."
    case "NO_MACHINE":
      return "This license is not activated on this computer yet."
    default:
      return detail || "This license is not valid."
  }
}

export function readKeygenConfig(): KeygenConfig {
  const fromEnv: KeygenConfig = {
    accountId: process.env.KEYGEN_ACCOUNT_ID?.trim() || "",
    productId: process.env.KEYGEN_PRODUCT_ID?.trim() || "",
    policyId: process.env.KEYGEN_POLICY_ID?.trim() || "",
    token: process.env.KEYGEN_TOKEN?.trim() || "",
  }
  const stored = readJson<KeygenConfig>(CONFIG_FILE, emptyConfig())
  return {
    accountId: stored.accountId || fromEnv.accountId,
    productId: stored.productId || fromEnv.productId,
    policyId: stored.policyId || fromEnv.policyId,
    token: stored.token || fromEnv.token,
  }
}

export function readKeygenPublic(): KeygenPublicConfig {
  const config = readKeygenConfig()
  for (const file of publicFiles()) {
    const pub = readJson<KeygenPublicConfig>(file, { accountId: "", productId: "" })
    if (pub.accountId) return toPublicKeygen(pub)
  }
  return toPublicKeygen(config)
}

export function toPublicKeygen(config: { accountId: string; productId: string }): KeygenPublicConfig {
  return { accountId: config.accountId, productId: config.productId }
}

export function writeKeygenPublic(config: KeygenPublicConfig) {
  mkdirSync(DATA_DIR, { recursive: true })
  const payload = JSON.stringify(toPublicKeygen(config), null, 2)
  writeFileSync(PUBLIC_FILE, payload)
  const unpacked = path.join(process.cwd(), "release", "win-unpacked")
  if (existsSync(unpacked)) {
    const destDir = path.join(unpacked, "resources")
    mkdirSync(destDir, { recursive: true })
    writeFileSync(path.join(destDir, "keygen-public.json"), payload)
  }
}

export function writeKeygenConfig(input: Partial<KeygenConfig>): KeygenConfig {
  const current = readKeygenConfig()
  const next: KeygenConfig = {
    accountId: input.accountId?.trim() || current.accountId,
    productId: input.productId?.trim() || current.productId,
    policyId: input.policyId?.trim() || current.policyId,
    token: input.token?.trim() || current.token,
  }
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2))
  writeKeygenPublic(toPublicKeygen(next))
  return next
}

export function keygenPublicStatus() {
  const pub = readKeygenPublic()
  const seller = isSellerMode()
  const config = seller ? readKeygenConfig() : emptyConfig()
  return {
    accountId: pub.accountId,
    productId: pub.productId,
    policyId: seller ? config.policyId : "",
    tokenHint: seller ? maskSecret(config.token) : "",
    connected: Boolean(pub.accountId),
    canIssue: Boolean(seller && config.accountId && config.policyId && config.token),
  }
}

function keygenUrl(accountId: string, suffix: string) {
  return `https://api.keygen.sh/v1/accounts/${encodeURIComponent(accountId)}${suffix}`
}

const JSONAPI = {
  "Content-Type": "application/vnd.api+json",
  Accept: "application/vnd.api+json",
}

export async function validateLicenseKey(key: string): Promise<ValidateResult> {
  const pub = readKeygenPublic()
  if (!pub.accountId) {
    return { valid: false, code: "NOT_CONFIGURED", detail: "Keygen is not connected yet.", expiry: null, licenseId: null }
  }
  const trimmed = key.trim()
  if (!trimmed) {
    return { valid: false, code: "NOT_FOUND", detail: "Enter a license key.", expiry: null, licenseId: null }
  }
  const scope = pub.productId ? { product: pub.productId } : undefined
  try {
    const response = await fetch(keygenUrl(pub.accountId, "/licenses/actions/validate-key"), {
      method: "POST",
      headers: JSONAPI,
      body: JSON.stringify({ meta: { key: trimmed, ...(scope ? { scope } : {}) } }),
    })
    const payload = (await response.json()) as {
      meta?: { valid?: boolean; code?: string; detail?: string }
      data?: { id?: string; attributes?: { expiry?: string | null } }
      errors?: Array<{ title?: string; detail?: string; code?: string }>
    }
    if (payload.errors?.[0]) {
      const err = payload.errors[0]
      return {
        valid: false,
        code: err.code || "NOT_FOUND",
        detail: licenseMessage(err.code || "", err.detail || err.title),
        expiry: null,
        licenseId: null,
      }
    }
    const code = payload.meta?.code || (payload.meta?.valid ? "VALID" : "INVALID")
    return {
      valid: Boolean(payload.meta?.valid),
      code,
      detail: licenseMessage(code, payload.meta?.detail),
      expiry: payload.data?.attributes?.expiry ?? null,
      licenseId: payload.data?.id ?? null,
    }
  } catch {
    return { valid: false, code: "NETWORK", detail: "Could not reach Keygen.", expiry: null, licenseId: null }
  }
}

export async function testKeygenConnection(input?: Partial<KeygenConfig>): Promise<{ ok: boolean; message: string }> {
  const stored = readKeygenConfig()
  const config: KeygenConfig = {
    accountId: input?.accountId?.trim() || stored.accountId,
    productId: input?.productId?.trim() || stored.productId,
    policyId: input?.policyId?.trim() || stored.policyId,
    token: input?.token?.trim() || stored.token,
  }
  if (!config.accountId || !config.token) {
    return { ok: false, message: "Add your Keygen account ID and admin token." }
  }
  try {
    const response = await fetch(keygenUrl(config.accountId, ""), {
      headers: { ...JSONAPI, Authorization: `Bearer ${config.token}` },
    })
    const payload = (await response.json()) as { data?: { attributes?: { slug?: string; name?: string } }; errors?: Array<{ detail?: string }> }
    if (!response.ok || payload.errors?.[0]) {
      return { ok: false, message: payload.errors?.[0]?.detail || "Keygen rejected this token." }
    }
    return { ok: true, message: `Connected to ${payload.data?.attributes?.slug || payload.data?.attributes?.name || "Keygen"}.` }
  } catch {
    return { ok: false, message: "Could not reach Keygen." }
  }
}

export async function createLicense(input: { name?: string; email?: string }): Promise<{ license?: IssuedLicense; error?: string }> {
  const config = readKeygenConfig()
  if (!config.accountId || !config.policyId || !config.token) {
    return { error: "Add your Keygen account ID, policy ID, and admin token first." }
  }
  const name = input.name?.trim() || input.email?.trim() || "PlaceFind customer"
  try {
    const response = await fetch(keygenUrl(config.accountId, "/licenses"), {
      method: "POST",
      headers: { ...JSONAPI, Authorization: `Bearer ${config.token}` },
      body: JSON.stringify({
        data: {
          type: "licenses",
          attributes: {
            name,
            metadata: input.email?.trim() ? { email: input.email.trim() } : {},
          },
          relationships: {
            policy: { data: { type: "policies", id: config.policyId } },
          },
        },
      }),
    })
    const payload = (await response.json()) as {
      data?: { id?: string; attributes?: { key?: string; expiry?: string | null } }
      errors?: Array<{ detail?: string; title?: string }>
    }
    if (!response.ok || !payload.data?.attributes?.key) {
      return { error: payload.errors?.[0]?.detail || payload.errors?.[0]?.title || "Keygen could not create a license." }
    }
    const issued: IssuedLicense = {
      id: payload.data.id || payload.data.attributes.key,
      key: payload.data.attributes.key,
      name,
      email: input.email?.trim() || "",
      createdAt: new Date().toISOString(),
      expiry: payload.data.attributes.expiry ?? null,
    }
    writeCollection("issued_licenses", [issued, ...readIssuedLicenses()].slice(0, 40))
    return { license: issued }
  } catch {
    return { error: "Could not reach Keygen." }
  }
}

export function readIssuedLicenses(): IssuedLicense[] {
  const rows = readCollection<IssuedLicense>("issued_licenses")
  return Array.isArray(rows) ? rows : []
}

const USER_ACTIVATED = path.join(os.homedir(), ".placefind", "activated-license.json")

export function readActivated(): ActivatedRecord | null {
  for (const file of [ACTIVATED_FILE, USER_ACTIVATED]) {
    if (!existsSync(file)) continue
    const record = readJson<ActivatedRecord>(file, {
      key: "",
      valid: false,
      code: "",
      detail: "",
      expiry: null,
      checkedAt: "",
    })
    if (record.key) return record
  }
  return null
}

export function writeActivated(record: ActivatedRecord) {
  mkdirSync(DATA_DIR, { recursive: true })
  mkdirSync(path.dirname(USER_ACTIVATED), { recursive: true })
  const payload = JSON.stringify(record, null, 2)
  writeFileSync(ACTIVATED_FILE, payload)
  writeFileSync(USER_ACTIVATED, payload)
}

export function clearActivated() {
  if (existsSync(ACTIVATED_FILE)) writeFileSync(ACTIVATED_FILE, "{}")
}

export async function licenseStatus(force = false): Promise<LicenseStatus> {
  const pub = readKeygenPublic()
  const seller = isSellerMode()
  const configured = Boolean(pub.accountId)
  const required = configured && !seller
  const activated = readActivated()
  if (!configured) {
    return { required: false, configured: false, valid: true, keyHint: "", code: "", detail: "", expiry: null, seller }
  }
  if (seller && !activated?.key) {
    return { required: false, configured: true, valid: true, keyHint: "", code: "", detail: "Seller copy does not need a customer license.", expiry: null, seller }
  }
  if (!activated?.key) {
    return { required, configured, valid: false, keyHint: "", code: "NOT_FOUND", detail: "Enter the license key you were sent.", expiry: null, seller }
  }
  const age = Date.now() - new Date(activated.checkedAt || 0).getTime()
  if (!force && activated.valid && age < 6 * 60 * 60 * 1000) {
    return {
      required,
      configured,
      valid: true,
      keyHint: maskSecret(activated.key),
      code: activated.code,
      detail: activated.detail,
      expiry: activated.expiry,
      seller,
    }
  }
  const checked = await validateLicenseKey(activated.key)
  if (checked.code === "NETWORK" && activated.valid) {
    return {
      required,
      configured,
      valid: true,
      keyHint: maskSecret(activated.key),
      code: activated.code,
      detail: "Could not recheck the license. Using the last valid check.",
      expiry: activated.expiry,
      seller,
    }
  }
  writeActivated({
    key: activated.key,
    valid: checked.valid,
    code: checked.code,
    detail: checked.detail,
    expiry: checked.expiry,
    checkedAt: new Date().toISOString(),
  })
  return {
    required,
    configured,
    valid: checked.valid,
    keyHint: maskSecret(activated.key),
    code: checked.code,
    detail: checked.detail,
    expiry: checked.expiry,
    seller,
  }
}

export async function activateLicense(key: string): Promise<LicenseStatus> {
  const checked = await validateLicenseKey(key)
  if (checked.valid) {
    writeActivated({
      key: key.trim(),
      valid: true,
      code: checked.code,
      detail: checked.detail,
      expiry: checked.expiry,
      checkedAt: new Date().toISOString(),
    })
  }
  const status = await licenseStatus()
  return {
    ...status,
    valid: checked.valid,
    code: checked.code,
    detail: checked.detail,
    expiry: checked.expiry,
    keyHint: checked.valid ? maskSecret(key) : status.keyHint,
  }
}

export function publicKeygenFile() {
  return PUBLIC_FILE
}
