import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { isPackagedBuyer } from "./runtime.ts"
import { readCollection, writeCollection } from "./store.ts"

export type UserRole = "customer" | "admin"
export type UserStatus = "active" | "suspended"

export type User = {
  id: string
  name: string
  email: string
  passwordHash: string
  role: UserRole
  status: UserStatus
  createdAt: string
}

export type PublicUser = {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string
}

type Session = {
  token: string
  userId: string
  createdAt: string
}

export const SESSION_COOKIE = "pf_session"

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

export function userStatus(user: Pick<User, "status"> | { status?: string } | null | undefined): UserStatus {
  return user?.status === "suspended" ? "suspended" : "active"
}

export function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: userStatus(user),
    createdAt: user.createdAt,
  }
}

export function normalizeUser(row: Partial<User> & Pick<User, "id" | "email">): User {
  return {
    id: String(row.id),
    name: String(row.name ?? "").trim() || row.email,
    email: normalizeEmail(String(row.email ?? "")),
    passwordHash: String(row.passwordHash ?? ""),
    role: row.role === "admin" ? "admin" : "customer",
    status: userStatus(row),
    createdAt: String(row.createdAt ?? new Date().toISOString()),
  }
}

export function readUsers(): User[] {
  const rows = readCollection<User>("users")
  return Array.isArray(rows) ? rows.map(normalizeUser) : []
}

function writeUsers(users: User[]) {
  writeCollection("users", users)
}

function readSessions(): Session[] {
  const rows = readCollection<Session>("sessions")
  return Array.isArray(rows) ? rows : []
}

function writeSessions(sessions: Session[]) {
  writeCollection("sessions", sessions.slice(0, 200))
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
  const existing = findUserByEmail(email)
  if (existing && userStatus(existing) === "suspended") return { error: "This account is suspended." }
  if (existing) return { error: "An account with that email already exists." }
  const users = readUsers()
  const role: UserRole = !hasAdminUser() || adminEmails().includes(email) ? "admin" : "customer"
  const user: User = {
    id: randomBytes(8).toString("hex"),
    name,
    email,
    passwordHash: hashPassword(password),
    role,
    status: "active",
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
  if (userStatus(user) === "suspended") {
    return { error: "This account is suspended." }
  }
  return { user: publicUser(user) }
}

function parseRole(value: unknown): UserRole | null {
  if (value === "admin" || value === "customer") return value
  return null
}

function validateProfile(input: { name: string; email: string; password?: string; requirePassword: boolean }) {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  if (name.length < 2) return { error: "Enter a name." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." }
  if (input.requirePassword && (input.password?.length ?? 0) < 8) {
    return { error: "Use a password with at least 8 characters." }
  }
  if (input.password && input.password.length > 0 && input.password.length < 8) {
    return { error: "Use a password with at least 8 characters." }
  }
  return { name, email }
}

function revokeSessionsForUser(userId: string) {
  writeSessions(readSessions().filter((session) => session.userId !== userId))
}

function countActiveAdmins(users: User[], exceptId?: string) {
  return users.filter((user) => user.id !== exceptId && user.role === "admin" && userStatus(user) === "active").length
}

export function createManagedUser(input: {
  name: string
  email: string
  password: string
  role?: string
}): { user?: PublicUser; error?: string } {
  const parsed = validateProfile({ ...input, requirePassword: true })
  if ("error" in parsed && parsed.error) return { error: parsed.error }
  const { name, email } = parsed as { name: string; email: string }
  const role = parseRole(input.role ?? "customer")
  if (!role) return { error: "Role must be customer or admin." }
  if (findUserByEmail(email)) return { error: "An account with that email already exists." }
  const user: User = {
    id: randomBytes(8).toString("hex"),
    name,
    email,
    passwordHash: hashPassword(input.password),
    role,
    status: "active",
    createdAt: new Date().toISOString(),
  }
  writeUsers([user, ...readUsers()])
  return { user: publicUser(user) }
}

export function updateManagedUser(
  id: string,
  input: { name?: string; email?: string; password?: string; role?: string; status?: string },
  actorId?: string,
): { user?: PublicUser; error?: string } {
  const users = readUsers()
  const current = users.find((user) => user.id === id)
  if (!current) return { error: "That user was not found." }
  const parsed = validateProfile({
    name: input.name ?? current.name,
    email: input.email ?? current.email,
    password: input.password,
    requirePassword: false,
  })
  if ("error" in parsed && parsed.error) return { error: parsed.error }
  const { name, email } = parsed as { name: string; email: string }
  const other = findUserByEmail(email)
  if (other && other.id !== id) return { error: "An account with that email already exists." }
  let role = current.role
  if (input.role != null) {
    const nextRole = parseRole(input.role)
    if (!nextRole) return { error: "Role must be customer or admin." }
    if (current.role === "admin" && nextRole !== "admin" && countActiveAdmins(users, id) === 0) {
      return { error: "Keep at least one active admin." }
    }
    role = nextRole
  }
  let status = userStatus(current)
  if (input.status != null) {
    if (input.status !== "active" && input.status !== "suspended") {
      return { error: "Status must be active or suspended." }
    }
    if (input.status === "suspended" && actorId === id) {
      return { error: "You cannot suspend your own account." }
    }
    if (input.status === "suspended" && current.role === "admin" && countActiveAdmins(users, id) === 0) {
      return { error: "Keep at least one active admin." }
    }
    status = input.status
  }
  const next: User = {
    ...current,
    name,
    email,
    role,
    status,
    passwordHash: input.password ? hashPassword(input.password) : current.passwordHash,
  }
  writeUsers(users.map((user) => (user.id === id ? next : user)))
  if (status === "suspended") revokeSessionsForUser(id)
  return { user: publicUser(next) }
}

export function deleteManagedUser(id: string, actorId?: string): { ok?: boolean; error?: string } {
  const users = readUsers()
  const current = users.find((user) => user.id === id)
  if (!current) return { error: "That user was not found." }
  if (actorId === id) return { error: "You cannot delete your own account." }
  if (current.role === "admin" && countActiveAdmins(users, id) === 0) {
    return { error: "Keep at least one active admin." }
  }
  writeUsers(users.filter((user) => user.id !== id))
  revokeSessionsForUser(id)
  return { ok: true }
}

export function setUserStatus(id: string, status: UserStatus, actorId?: string) {
  return updateManagedUser(id, { status }, actorId)
}

export function seedAdminAccount(input: { email: string; password: string; name?: string }): {
  user?: PublicUser
  created?: boolean
  error?: string
} {
  const email = normalizeEmail(input.email)
  const password = input.password
  const name = (input.name ?? "Admin").trim() || "Admin"
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid admin email." }
  if (password.length < 8) return { error: "Use a password with at least 8 characters." }
  const existing = findUserByEmail(email)
  if (existing) {
    const users = readUsers()
    const next: User = {
      ...existing,
      name: name === "Admin" ? existing.name || name : name,
      passwordHash: hashPassword(password),
      role: "admin",
      status: "active",
    }
    writeUsers(users.map((user) => (user.id === existing.id ? next : user)))
    return { user: publicUser(next), created: false }
  }
  const user: User = {
    id: randomBytes(8).toString("hex"),
    name,
    email,
    passwordHash: hashPassword(password),
    role: "admin",
    status: "active",
    createdAt: new Date().toISOString(),
  }
  writeUsers([user, ...readUsers()])
  return { user: publicUser(user), created: true }
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
  if (!user || userStatus(user) === "suspended") return null
  return publicUser(user)
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

export function canLocalBootstrap() {
  if (isPackagedBuyer()) return false
  if (process.env.NODE_ENV === "production") return false
  return readUsers().length === 0
}

export function canManage(header?: string) {
  if (isPackagedBuyer()) return false
  const user = userFromCookie(header)
  if (user?.role === "admin") return true
  // Seller/dev mode is never admin. The only bootstrap is the first account
  // (or ADMIN_EMAIL) becoming an admin — not an open admin session.
  return false
}

export function storeOpen() {
  return !isPackagedBuyer()
}
