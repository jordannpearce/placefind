import { cookies } from "next/headers"

import { SESSION_COOKIE, signSession, verifySessionToken } from "./session-token"
import type { User } from "./types"

export { SESSION_COOKIE, signSession, verifySessionToken } from "./session-token"

export const IMPERSONATE_COOKIE = "gridpin_as"

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
  store.delete(IMPERSONATE_COOKIE)
}

export async function getImpersonatedUserId() {
  const store = await cookies()
  return store.get(IMPERSONATE_COOKIE)?.value ?? null
}

export async function writeImpersonation(userId: string) {
  const store = await cookies()
  store.set(IMPERSONATE_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4,
  })
}

export async function clearImpersonation() {
  const store = await cookies()
  store.delete(IMPERSONATE_COOKIE)
}

export function publicUser(user: User) {
  const { passwordHash: _hash, dfsPassword, ...rest } = user
  return { ...rest, hasDfsPassword: Boolean(dfsPassword) }
}
