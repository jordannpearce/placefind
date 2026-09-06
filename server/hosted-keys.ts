import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { isSellerMode } from "./runtime.ts"
import type { ApiKeys } from "./types.ts"

export type HostedKeys = {
  scrappeyKey: string
  dataforseoLogin: string
  dataforseoPassword: string
}

export type HostedKeyStatus = {
  included: boolean
  scrappey: boolean
  dataforseo: boolean
  scrappeyHint: string
  dataforseoHint: string
  seller: boolean
  savedToDatabase?: boolean
}

const APP_SECRET = "placefind-hosted-v1-maps-lookup"
const HOSTED_KEYS_ROW = "default"

let cachedDatabaseKeys: HostedKeys | null = null
let lastDatabaseWriteOk = false

function emptyKeys(): HostedKeys {
  return { scrappeyKey: "", dataforseoLogin: "", dataforseoPassword: "" }
}

function dataFile() {
  return path.resolve(process.env.PLACEFIND_DATA_DIR || path.resolve(process.cwd(), ".data"), "hosted-keys.json")
}

function keyFiles(): string[] {
  if (process.env.PLACEFIND_KEYS_FILE) return [process.env.PLACEFIND_KEYS_FILE]
  return [
    path.join(process.cwd(), "release", "win-unpacked", "resources", "hosted-keys.json"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "hosted-keys.json"),
    dataFile(),
  ]
}

function postgresUrl() {
  const url = process.env.DATABASE_URL?.trim() ?? ""
  return /^postgres(ql)?:\/\//i.test(url) ? url : ""
}

export function maskSecret(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (trimmed.length <= 4) return "••••"
  return `${"•".repeat(Math.min(8, trimmed.length - 4))}${trimmed.slice(-4)}`
}

function material() {
  return scryptSync(APP_SECRET, "placefind-salt", 32)
}

export function sealKeys(keys: HostedKeys): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", material(), iv)
  const encoded = Buffer.concat([cipher.update(JSON.stringify(keys), "utf8"), cipher.final()])
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encoded.toString("base64"),
  })
}

export function openSealed(raw: string): Partial<HostedKeys> | null {
  try {
    const parsed = JSON.parse(raw) as {
      v?: number
      iv?: string
      tag?: string
      data?: string
      scrappeyKey?: string
      dataforseoLogin?: string
      dataforseoPassword?: string
    }
    if (parsed.v === 1 && parsed.iv && parsed.tag && parsed.data) {
      const decipher = createDecipheriv("aes-256-gcm", material(), Buffer.from(parsed.iv, "base64"))
      decipher.setAuthTag(Buffer.from(parsed.tag, "base64"))
      const plain = Buffer.concat([
        decipher.update(Buffer.from(parsed.data, "base64")),
        decipher.final(),
      ]).toString("utf8")
      return JSON.parse(plain) as HostedKeys
    }
    if (parsed.scrappeyKey || parsed.dataforseoLogin || parsed.dataforseoPassword) {
      return parsed
    }
  } catch {
    return null
  }
  return null
}

function applyKeySource(keys: HostedKeys, incoming: Partial<HostedKeys> | null | undefined) {
  if (!incoming) return
  keys.scrappeyKey = keys.scrappeyKey || incoming.scrappeyKey?.trim() || ""
  keys.dataforseoLogin = keys.dataforseoLogin || incoming.dataforseoLogin?.trim() || ""
  keys.dataforseoPassword = keys.dataforseoPassword || incoming.dataforseoPassword?.trim() || ""
}

function applyEnv(keys: HostedKeys) {
  if (keys.scrappeyKey) process.env.SCRAPPEY_API_KEY = keys.scrappeyKey
  if (keys.dataforseoLogin) process.env.DATAFORSEO_LOGIN = keys.dataforseoLogin
  if (keys.dataforseoPassword) process.env.DATAFORSEO_PASSWORD = keys.dataforseoPassword
}

export function readHostedKeys(): HostedKeys {
  const keys = emptyKeys()
  for (const file of keyFiles()) {
    if (!existsSync(file)) continue
    applyKeySource(keys, openSealed(readFileSync(file, "utf8")))
  }
  applyKeySource(keys, cachedDatabaseKeys)
  keys.scrappeyKey = keys.scrappeyKey || process.env.SCRAPPEY_API_KEY?.trim() || ""
  keys.dataforseoLogin = keys.dataforseoLogin || process.env.DATAFORSEO_LOGIN?.trim() || ""
  keys.dataforseoPassword = keys.dataforseoPassword || process.env.DATAFORSEO_PASSWORD?.trim() || ""
  return keys
}

export function hostedKeyStatus(options?: { revealHints?: boolean }): HostedKeyStatus {
  const keys = readHostedKeys()
  const scrappey = Boolean(keys.scrappeyKey)
  const dataforseo = Boolean(keys.dataforseoLogin && keys.dataforseoPassword)
  const seller = isSellerMode()
  const revealHints = Boolean(options?.revealHints)
  return {
    included: scrappey || dataforseo,
    scrappey,
    dataforseo,
    scrappeyHint: revealHints ? maskSecret(keys.scrappeyKey) : "",
    dataforseoHint: revealHints && keys.dataforseoLogin ? maskSecret(keys.dataforseoLogin) : "",
    seller,
    savedToDatabase: lastDatabaseWriteOk || Boolean(cachedDatabaseKeys),
  }
}

export function emptyApiKeys(): ApiKeys {
  return { scrappeyKey: "", dataforseoLogin: "", dataforseoPassword: "", enrichWithScrappey: true }
}

export function mapsScanConfigured(rawKeys: ApiKeys = emptyApiKeys()): boolean {
  const keys = mergeHostedKeys(rawKeys)
  return Boolean(keys.dataforseoLogin?.trim() && keys.dataforseoPassword?.trim())
}

export function trafficRunnerConfigured(rawKeys: ApiKeys = emptyApiKeys()): boolean {
  const keys = mergeHostedKeys(rawKeys)
  return Boolean(keys.scrappeyKey?.trim())
}

export function resetHostedKeysCacheForTests() {
  cachedDatabaseKeys = null
  lastDatabaseWriteOk = false
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
      CREATE TABLE IF NOT EXISTS hosted_keys (
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

export async function hydrateHostedKeys(): Promise<boolean> {
  try {
    const sealed = await withPostgres(async (client) => {
      const result = await client.query<{ sealed: string }>("SELECT sealed FROM hosted_keys WHERE id = $1", [HOSTED_KEYS_ROW])
      return result.rows[0]?.sealed ?? ""
    })
    if (!sealed) return false
    const opened = openSealed(sealed)
    if (!opened) return false
    cachedDatabaseKeys = {
      scrappeyKey: opened.scrappeyKey?.trim() || "",
      dataforseoLogin: opened.dataforseoLogin?.trim() || "",
      dataforseoPassword: opened.dataforseoPassword?.trim() || "",
    }
    lastDatabaseWriteOk = true
    applyEnv(cachedDatabaseKeys)
    const file = dataFile()
    if (!existsSync(file)) {
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, sealed)
    }
    return Boolean(cachedDatabaseKeys.dataforseoLogin && cachedDatabaseKeys.dataforseoPassword)
  } catch {
    console.error("PlaceFind could not read saved Maps keys from Postgres.")
    return false
  }
}

export async function writeHostedKeys(input: Partial<HostedKeys>): Promise<HostedKeyStatus> {
  const current = readHostedKeys()
  const next: HostedKeys = {
    scrappeyKey: input.scrappeyKey?.trim() || current.scrappeyKey,
    dataforseoLogin: input.dataforseoLogin?.trim() || current.dataforseoLogin,
    dataforseoPassword: input.dataforseoPassword?.trim() || current.dataforseoPassword,
  }
  const sealed = sealKeys(next)
  const file = dataFile()
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, sealed)
  cachedDatabaseKeys = next
  applyEnv(next)
  injectHostedKeysIntoUnpacked()
  lastDatabaseWriteOk = false
  try {
    const wrote = await withPostgres(async (client) => {
      await client.query(
        `INSERT INTO hosted_keys (id, sealed, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO UPDATE SET sealed = EXCLUDED.sealed, updated_at = NOW()`,
        [HOSTED_KEYS_ROW, sealed],
      )
      return true
    })
    lastDatabaseWriteOk = Boolean(wrote)
  } catch {
    console.error("PlaceFind could not persist Maps keys to Postgres.")
  }
  return hostedKeyStatus({ revealHints: true })
}

export function injectHostedKeysIntoUnpacked(): boolean {
  const file = dataFile()
  if (!existsSync(file)) return false
  const destDir = path.join(process.cwd(), "release", "win-unpacked", "resources")
  if (!existsSync(destDir)) return false
  writeFileSync(path.join(destDir, "hosted-keys.json"), readFileSync(file))
  return true
}

export function mergeHostedKeys(input: ApiKeys): ApiKeys {
  const hosted = readHostedKeys()
  if (!isSellerMode()) {
    return {
      scrappeyKey: hosted.scrappeyKey,
      dataforseoLogin: hosted.dataforseoLogin,
      dataforseoPassword: hosted.dataforseoPassword,
      enrichWithScrappey: true,
    }
  }
  return {
    scrappeyKey: input.scrappeyKey?.trim() || hosted.scrappeyKey,
    dataforseoLogin: input.dataforseoLogin?.trim() || hosted.dataforseoLogin,
    dataforseoPassword: input.dataforseoPassword?.trim() || hosted.dataforseoPassword,
    enrichWithScrappey: input.enrichWithScrappey !== false,
  }
}
