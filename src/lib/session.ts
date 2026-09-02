import { cookies } from "next/headers"

import { SESSION_COOKIE, signSession, verifySessionToken } from "./session-token"
import type { User } from "./types"

export { SESSION_COOKIE, signSession, verifySessionToken } from "./session-token"

export async function readSession() {
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}

export async function writeSession(user: User) {
  const store = await cookies()
  store.set(SESSION_COOKIE, signSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function clearSession() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export function publicUser(user: User) {
  const { passwordHash: _hash, dfsPassword, ...rest } = user
  return { ...rest, hasDfsPassword: Boolean(dfsPassword) }
}
