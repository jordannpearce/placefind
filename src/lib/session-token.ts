import { createHmac, timingSafeEqual } from "crypto"

import type { SessionPayload, User } from "./types"

export const SESSION_COOKIE = "gridpin_session"
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function secret() {
  return process.env.SESSION_SECRET || "gridpin-local-dev-secret-change-me"
}

export function signSession(user: User): string {
  const payload: SessionPayload = {
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    exp: Date.now() + WEEK_MS,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = createHmac("sha256", secret()).update(body).digest("base64url")
  return `${body}.${sig}`
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const [body, sig] = token.split(".")
  if (!body || !sig) return null
  const expected = createHmac("sha256", secret()).update(body).digest("base64url")
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload
    if (!payload.uid || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export { WEEK_MS }
