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
}

const DATA_FILE = path.resolve(process.cwd(), ".data", "hosted-keys.json")
const APP_SECRET = "placefind-hosted-v1-maps-lookup"

function emptyKeys(): HostedKeys {
  return { scrappeyKey: "", dataforseoLogin: "", dataforseoPassword: "" }
}

function keyFiles(): string[] {
  return [
    process.env.PLACEFIND_KEYS_FILE,
    path.join(process.cwd(), "release", "win-unpacked", "resources", "hosted-keys.json"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "hosted-keys.json"),
    DATA_FILE,
  ].filter((file): file is string => Boolean(file))
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

export function readHostedKeys(): HostedKeys {
  const keys = emptyKeys()
  for (const file of keyFiles()) {
    if (!existsSync(file)) continue
    const opened = openSealed(readFileSync(file, "utf8"))
    if (!opened) continue
    keys.scrappeyKey = keys.scrappeyKey || opened.scrappeyKey?.trim() || ""
    keys.dataforseoLogin = keys.dataforseoLogin || opened.dataforseoLogin?.trim() || ""
    keys.dataforseoPassword = keys.dataforseoPassword || opened.dataforseoPassword?.trim() || ""
  }
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
  }
}

export function writeHostedKeys(input: Partial<HostedKeys>): HostedKeyStatus {
  const current = readHostedKeys()
  const next: HostedKeys = {
    scrappeyKey: input.scrappeyKey?.trim() || current.scrappeyKey,
    dataforseoLogin: input.dataforseoLogin?.trim() || current.dataforseoLogin,
    dataforseoPassword: input.dataforseoPassword?.trim() || current.dataforseoPassword,
  }
  mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  writeFileSync(DATA_FILE, sealKeys(next))
  injectHostedKeysIntoUnpacked()
  return hostedKeyStatus({ revealHints: true })
}

export function injectHostedKeysIntoUnpacked(): boolean {
  if (!existsSync(DATA_FILE)) return false
  const destDir = path.join(process.cwd(), "release", "win-unpacked", "resources")
  if (!existsSync(destDir)) return false
  writeFileSync(path.join(destDir, "hosted-keys.json"), readFileSync(DATA_FILE))
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
