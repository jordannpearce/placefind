import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { ApiKeys } from "./types.ts"

export type HostedKeys = {
  scrappeyKey: string
  dataforseoLogin: string
  dataforseoPassword: string
}

export type HostedKeyStatus = {
  scrappey: boolean
  dataforseo: boolean
  scrappeyHint: string
  dataforseoHint: string
}

const DATA_FILE = path.resolve(process.cwd(), ".data", "hosted-keys.json")

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

export function readHostedKeys(): HostedKeys {
  const keys = emptyKeys()
  for (const file of keyFiles()) {
    if (!existsSync(file)) continue
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<HostedKeys>
      keys.scrappeyKey = keys.scrappeyKey || raw.scrappeyKey?.trim() || ""
      keys.dataforseoLogin = keys.dataforseoLogin || raw.dataforseoLogin?.trim() || ""
      keys.dataforseoPassword = keys.dataforseoPassword || raw.dataforseoPassword?.trim() || ""
    } catch {
      // skip unreadable files
    }
  }
  keys.scrappeyKey = keys.scrappeyKey || process.env.SCRAPPEY_API_KEY?.trim() || ""
  keys.dataforseoLogin = keys.dataforseoLogin || process.env.DATAFORSEO_LOGIN?.trim() || ""
  keys.dataforseoPassword = keys.dataforseoPassword || process.env.DATAFORSEO_PASSWORD?.trim() || ""
  return keys
}

export function hostedKeyStatus(): HostedKeyStatus {
  const keys = readHostedKeys()
  return {
    scrappey: Boolean(keys.scrappeyKey),
    dataforseo: Boolean(keys.dataforseoLogin && keys.dataforseoPassword),
    scrappeyHint: maskSecret(keys.scrappeyKey),
    dataforseoHint: keys.dataforseoLogin ? maskSecret(keys.dataforseoLogin) : "",
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
  writeFileSync(DATA_FILE, JSON.stringify(next, null, 2))
  injectHostedKeysIntoUnpacked()
  return hostedKeyStatus()
}

export function injectHostedKeysIntoUnpacked(): boolean {
  if (!existsSync(DATA_FILE)) return false
  const destDir = path.join(process.cwd(), "release", "win-unpacked", "resources")
  if (!existsSync(destDir)) return false
  copyFileSync(DATA_FILE, path.join(destDir, "hosted-keys.json"))
  return true
}

export function mergeHostedKeys(input: ApiKeys): ApiKeys {
  const hosted = readHostedKeys()
  return {
    scrappeyKey: input.scrappeyKey?.trim() || hosted.scrappeyKey,
    dataforseoLogin: input.dataforseoLogin?.trim() || hosted.dataforseoLogin,
    dataforseoPassword: input.dataforseoPassword?.trim() || hosted.dataforseoPassword,
    enrichWithScrappey: input.enrichWithScrappey !== false,
  }
}
