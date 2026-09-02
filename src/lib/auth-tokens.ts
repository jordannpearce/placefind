import type { Database } from "./db"
import { hashToken, randomToken } from "./password"
import type { AuthToken } from "./types"

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000
export const ACTIVATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 48

export type TokenInspect = "ok" | "missing" | "invalid" | "expired"

export function createHashedToken(
  db: Database,
  userId: string,
  type: AuthToken["type"],
  ttlMs: number
) {
  const token = randomToken()
  db.tokens = db.tokens.filter((item) => item.userId !== userId || item.type !== type)
  db.tokens.push({
    id: `tok_${Date.now()}_${randomToken().slice(0, 8)}`,
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  })
  return token
}

export function inspectToken(db: Database, token: string, type: AuthToken["type"]): TokenInspect {
  const value = token.trim()
  if (!value) return "missing"
  const tokenHash = hashToken(value)
  const record = db.tokens.find((item) => item.type === type && item.tokenHash === tokenHash)
  if (!record) return "invalid"
  if (new Date(record.expiresAt).getTime() < Date.now()) return "expired"
  return "ok"
}

export function consumeToken(db: Database, token: string, type: AuthToken["type"]) {
  const status = inspectToken(db, token, type)
  if (status !== "ok") return { status, user: null as null }
  const tokenHash = hashToken(token.trim())
  const record = db.tokens.find((item) => item.type === type && item.tokenHash === tokenHash)
  if (!record) return { status: "invalid" as const, user: null }
  const user = db.users.find((item) => item.id === record.userId) ?? null
  db.tokens = db.tokens.filter((item) => item.id !== record.id)
  if (!user) return { status: "invalid" as const, user: null }
  return { status: "ok" as const, user }
}
