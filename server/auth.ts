import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { isPackagedBuyer, isSellerMode } from "./runtime.ts"

export type UserRole = "customer" | "admin"

export type User = {
  id: string
  name: string
  email: string
  passwordHash: string
  role: UserRole
  createdAt: string
}

export type PublicUser = {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: string
}

type Session = {
  token: string
  userId: string
  createdAt: string
}

const DATA_DIR = path.resolve(process.cwd(), ".data")
const USERS_FILE = path.join(DATA_DIR, "users.json")
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json")
export const SESSION_COOKIE = "pf_session"

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback
    return JSON.parse(readFileSync(file, "utf8")) as T
  } catch {
    return fallback
  }
}

function writeJson(file: string, value: unknown) {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2))
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const next = scryptSync(password, salt, 64)
  const prev = Buffer.from(hash, "hex")
  if (next.length !== prev.length) return false
  return timingSafeEqual(next, prev)
}

export function publicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt }
}

export function readUsers(): User[] {
  const rows = readJson<User[]>(USERS_FILE, [])
  return Array.isArray(rows) ? rows : []
}

function writeUsers(users: User[]) {
  writeJson(USERS_FILE, users)
}

function readSessions(): Session[] {
  const rows = readJson<Session[]>(SESSIONS_FILE, [])
  return Array.isArray(rows) ? rows : []
}

function writeSessions(sessions: Session[]) {
  writeJson(SESSIONS_FILE, sessions)
}

export function findUserByEmail(email: string) {
  const needle = normalizeEmail(email)
  return readUsers().find((user) => user.email === needle) ?? null
}

export function findUserById(id: string) {
  return readUsers().find((user) => user.id === id) ?? null
}

export function hasAdminUser() {
  return readUsers().some((user) => user.role === "admin")
}

function adminEmails() {
  return (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean)
}

export function signup(input: { name: string; email: string; password: string }): { user?: PublicUser; error?: string } {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  const password = input.password
  if (name.length < 2) return { error: "Enter your name." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." }
  if (password.length < 8) return { error: "Use a password with at least 8 characters." }
  if (findUserByEmail(email)) return { error: "An account with that email already exists." }
  const users = readUsers()
  const role: UserRole = !hasAdminUser() || adminEmails().includes(email) ? "admin" : "customer"
  const user: User = {
    id: randomBytes(8).toString("hex"),
    name,
    email,
    passwordHash: hashPassword(password),
    role,
    createdAt: new Date().toISOString(),
  }
  writeUsers([user, ...users])
  return { user: publicUser(user) }
}

export function login(input: { email: string; password: string }): { user?: PublicUser; error?: string } {
  const user = findUserByEmail(input.email)
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    return { error: "Email or password is incorrect." }
  }
  return { user: publicUser(user) }
}

export function createSession(userId: string) {
  const token = randomBytes(24).toString("hex")
  writeSessions([{ token, userId, createdAt: new Date().toISOString() }, ...readSessions()].slice(0, 200))
  return token
}

export function clearSession(token: string) {
  writeSessions(readSessions().filter((session) => session.token !== token))
}

export function parseCookies(header?: string) {
  const out: Record<string, string> = {}
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=")
    if (index < 0) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}

export function userFromCookie(header?: string): PublicUser | null {
  const token = parseCookies(header)[SESSION_COOKIE]
  if (!token) return null
  const session = readSessions().find((row) => row.token === token)
  if (!session) return null
  const user = findUserById(session.userId)
  return user ? publicUser(user) : null
}

export function sessionCookie(token: string, clear = false) {
  const parts = [
    `${SESSION_COOKIE}=${clear ? "" : token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ]
  if (clear) parts.push("Max-Age=0")
  else parts.push("Max-Age=2592000")
  return parts.join("; ")
}

export function canManage(header?: string) {
  if (isPackagedBuyer()) return false
  const user = userFromCookie(header)
  if (user?.role === "admin") return true
  return isSellerMode()
}

export function storeOpen() {
  return !isPackagedBuyer()
}
