import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import path from "node:path"
import { accountStatusOf, parseAccountKind, type AccountKind, type UserStatus } from "../src/lib/account.ts"
import { isPackagedBuyer } from "./runtime.ts"
import { dataDir, readCollection, writeCollection } from "./store.ts"

export type UserRole = "customer" | "admin"
export type { AccountKind, UserStatus }

export type User = {
  id: string
  name: string
  email: string
  passwordHash: string
  role: UserRole
  accountKind: AccountKind
  status: UserStatus
  createdAt: string
}

export type PublicUser = {
  id: string
  name: string
  email: string
  role: UserRole
  accountKind: AccountKind
  status: UserStatus
  createdAt: string
}

type Session = {
  token: string
  userId: string
  createdAt: string
}

export const SESSION_COOKIE = "pf_session"
export const IMPERSONATE_COOKIE = "pf_impersonate"
export const IMPERSONATION_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const FORGOT_PASSWORD_MESSAGE = "If that email is on file, we sent a reset link."
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000

export type ImpersonatingInfo = {
  name: string
  email: string
}

const FORGOT_RATE_WINDOW_MS = 15 * 60 * 1000
const FORGOT_RATE_LIMIT = 5

export type PasswordReset = {
  tokenHash: string
  userId: string
  expiresAt: string
  usedAt: string | null
}

const forgotAttempts = new Map<string, number[]>()

export function resetForgotRateLimitForTests() {
  forgotAttempts.clear()
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

const RESERVED_SAMPLE_HOSTS = new Set(["example.com", "example.net", "example.org", "example.edu", "example.test", "example", "test", "invalid", "localhost"])

export function isReservedSampleEmail(email: string) {
  const host = normalizeEmail(email).split("@")[1] ?? ""
  if (!host) return false
  if (RESERVED_SAMPLE_HOSTS.has(host)) return true
  const parts = host.split(".")
  for (let i = 0; i < parts.length; i += 1) {
    if (RESERVED_SAMPLE_HOSTS.has(parts.slice(i).join("."))) return true
  }
  return false
}

export function isLiveAppStore() {
  return path.resolve(dataDir()) === path.resolve(process.cwd(), ".data")
}

function rejectLiveSampleEmail(email: string): { error: string } | null {
  if (isLiveAppStore() && isReservedSampleEmail(email)) {
    return { error: "Use a real email address." }
  }
  return null
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
  return accountStatusOf(user)
}

function normalizeAccountKind(row: Pick<User, "role"> & { accountKind?: string }): AccountKind {
  if (row.role === "admin") return "business"
  return row.accountKind === "member" ? "member" : "business"
}

export function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountKind: normalizeAccountKind(user),
    status: userStatus(user),
    createdAt: user.createdAt,
  }
}

export function normalizeUser(row: Partial<User> & Pick<User, "id" | "email">): User {
  const role: UserRole = row.role === "admin" ? "admin" : "customer"
  return {
    id: String(row.id),
    name: String(row.name ?? "").trim() || row.email,
    email: normalizeEmail(String(row.email ?? "")),
    passwordHash: String(row.passwordHash ?? ""),
    role,
    accountKind: normalizeAccountKind({ role, accountKind: row.accountKind }),
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

export function signupIgnoringClientKind(
  input: { name: string; email: string; password: string; kind?: string },
  lockedKind: AccountKind,
): { user?: PublicUser; error?: string } {
  return signup({
    name: input.name,
    email: input.email,
    password: input.password,
    kind: lockedKind,
  })
}

export function signup(input: {
  name: string
  email: string
  password: string
  kind?: string
}): { user?: PublicUser; error?: string } {
  const name = input.name.trim()
  const email = normalizeEmail(input.email)
  const password = input.password
  if (name.length < 2) return { error: "Enter your name." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." }
  if (password.length < 8) return { error: "Use a password with at least 8 characters." }
  const requestedKind = input.kind == null || input.kind === "" ? "business" : parseAccountKind(input.kind)
  if (!requestedKind) return { error: "Account type must be business or member." }
  const liveSample = rejectLiveSampleEmail(email)
  if (liveSample) return liveSample
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
    accountKind: role === "admin" ? "business" : requestedKind,
    status: role === "admin" ? "active" : "pending",
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
  kind?: string
}): { user?: PublicUser; error?: string } {
  const parsed = validateProfile({ ...input, requirePassword: true })
  if ("error" in parsed && parsed.error) return { error: parsed.error }
  const { name, email } = parsed as { name: string; email: string }
  const liveSample = rejectLiveSampleEmail(email)
  if (liveSample) return liveSample
  const role = parseRole(input.role ?? "customer")
  if (!role) return { error: "Role must be customer or admin." }
  const requestedKind = input.kind == null || input.kind === "" ? "business" : parseAccountKind(input.kind)
  if (!requestedKind) return { error: "Account type must be business or member." }
  if (findUserByEmail(email)) return { error: "An account with that email already exists." }
  const user: User = {
    id: randomBytes(8).toString("hex"),
    name,
    email,
    passwordHash: hashPassword(input.password),
    role,
    accountKind: role === "admin" ? "business" : requestedKind,
    status: "active",
    createdAt: new Date().toISOString(),
  }
  writeUsers([user, ...readUsers()])
  return { user: publicUser(user) }
}

export function updateManagedUser(
  id: string,
  input: { name?: string; email?: string; password?: string; role?: string; status?: string; kind?: string },
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
  const liveSample = rejectLiveSampleEmail(email)
  if (liveSample) return liveSample
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
    if (input.status !== "active" && input.status !== "suspended" && input.status !== "pending") {
      return { error: "Status must be active, pending, or suspended." }
    }
    if (input.status === "suspended" && actorId === id) {
      return { error: "You cannot suspend your own account." }
    }
    if (input.status === "suspended" && current.role === "admin" && countActiveAdmins(users, id) === 0) {
      return { error: "Keep at least one active admin." }
    }
    status = input.status
  }
  let accountKind = current.accountKind
  if (input.kind != null) {
    const nextKind = parseAccountKind(input.kind)
    if (!nextKind) return { error: "Account type must be business or member." }
    accountKind = nextKind
  }
  if (role === "admin") accountKind = "business"
  const next: User = {
    ...current,
    name,
    email,
    role,
    accountKind,
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
  writePasswordResets(readPasswordResets().filter((row) => row.userId !== id))
  return { ok: true }
}

export function setUserStatus(id: string, status: UserStatus, actorId?: string) {
  return updateManagedUser(id, { status }, actorId)
}

export function approveUser(id: string, actorId?: string): { user?: PublicUser; error?: string } {
  const current = findUserById(id)
  if (!current) return { error: "That user was not found." }
  if (userStatus(current) === "suspended") {
    return { error: "Unsuspend this account instead of approving it." }
  }
  if (userStatus(current) === "active") return { user: publicUser(current) }
  return updateManagedUser(id, { status: "active" }, actorId)
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
  const liveSample = rejectLiveSampleEmail(email)
  if (liveSample) return liveSample
  const existing = findUserByEmail(email)
  if (existing) {
    const users = readUsers()
    const next: User = {
      ...existing,
      name: name === "Admin" ? existing.name || name : name,
      passwordHash: hashPassword(password),
      role: "admin",
      accountKind: "business",
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
    accountKind: "business",
    status: "active",
    createdAt: new Date().toISOString(),
  }
  writeUsers([user, ...readUsers()])
  return { user: publicUser(user), created: true }
}

export function becomeBusiness(id: string): { user?: PublicUser; error?: string } {
  const users = readUsers()
  const current = users.find((user) => user.id === id)
  if (!current) return { error: "That user was not found." }
  const next: User = { ...current, accountKind: "business" }
  writeUsers(users.map((user) => (user.id === id ? next : user)))
  return { user: publicUser(next) }
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

function cookieValue(name: string, token: string, clear = false) {
  const parts = [`${name}=${clear ? "" : token}`, "Path=/", "HttpOnly", "SameSite=Lax"]
  if (clear) parts.push("Max-Age=0")
  else parts.push("Max-Age=2592000")
  return parts.join("; ")
}

function impersonationSecret() {
  return process.env.PLACEFIND_SESSION_SECRET?.trim() || "placefind-impersonate-v1"
}

function signedEqual(left: string, right: string) {
  const a = createHash("sha256").update(left).digest()
  const b = createHash("sha256").update(right).digest()
  return a.length === b.length && timingSafeEqual(a, b) && left.length === right.length
}

export function signImpersonation(input: { impersonatorId: string; userId: string; exp?: number }) {
  const payload = {
    impersonatorId: input.impersonatorId,
    userId: input.userId,
    exp: input.exp ?? Date.now() + IMPERSONATION_TTL_MS,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const mac = createHmac("sha256", impersonationSecret()).update(body).digest("base64url")
  return `${body}.${mac}`
}

export function verifyImpersonation(token: string): { impersonatorId: string; userId: string } | null {
  const [body, mac] = token.split(".")
  if (!body || !mac) return null
  const expected = createHmac("sha256", impersonationSecret()).update(body).digest("base64url")
  if (!signedEqual(mac, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      impersonatorId?: string
      userId?: string
      exp?: number
    }
    if (!payload.impersonatorId || !payload.userId) return null
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) return null
    return { impersonatorId: payload.impersonatorId, userId: payload.userId }
  } catch {
    return null
  }
}

function userFromSessionToken(token?: string): PublicUser | null {
  if (!token) return null
  const session = readSessions().find((row) => row.token === token)
  if (!session) return null
  const user = findUserById(session.userId)
  if (!user || userStatus(user) === "suspended") return null
  return publicUser(user)
}

export function sessionContext(header?: string): { user: PublicUser; impersonator: PublicUser | null } | null {
  const cookies = parseCookies(header)
  const sessionUser = userFromSessionToken(cookies[SESSION_COOKIE])
  const signed = cookies[IMPERSONATE_COOKIE] ? verifyImpersonation(cookies[IMPERSONATE_COOKIE]) : null
  if (signed && sessionUser) {
    const impersonator = findUserById(signed.impersonatorId)
    const target = findUserById(signed.userId)
    if (
      impersonator &&
      impersonator.role === "admin" &&
      userStatus(impersonator) === "active" &&
      sessionUser.id === impersonator.id &&
      target &&
      target.role !== "admin"
    ) {
      return { user: publicUser(target), impersonator: publicUser(impersonator) }
    }
  }
  if (!sessionUser) return null
  return { user: sessionUser, impersonator: null }
}

export function userFromCookie(header?: string): PublicUser | null {
  return sessionContext(header)?.user ?? null
}

export function impersonatingFromCookie(header?: string): ImpersonatingInfo | null {
  const ctx = sessionContext(header)
  if (!ctx?.impersonator) return null
  return { name: ctx.user.name, email: ctx.user.email }
}

export function sessionCookie(token: string, clear = false) {
  return cookieValue(SESSION_COOKIE, token, clear)
}

export function impersonationCookie(token: string, clear = false) {
  return cookieValue(IMPERSONATE_COOKIE, token, clear)
}

export function startImpersonation(
  header: string | undefined,
  targetId: string,
): { user?: PublicUser; impersonating?: ImpersonatingInfo; token?: string; error?: string } {
  if (!canManage(header)) return { error: "Admin access is required." }
  const actor = userFromCookie(header)
  if (!actor || actor.role !== "admin") return { error: "Admin access is required." }
  const target = findUserById(targetId)
  if (!target) return { error: "That user was not found." }
  if (target.role === "admin") return { error: "You cannot view the app as another admin." }
  const token = signImpersonation({ impersonatorId: actor.id, userId: target.id })
  return {
    user: publicUser(target),
    impersonating: { name: target.name, email: target.email },
    token,
  }
}

export function stopImpersonation(header?: string): { user?: PublicUser; error?: string } {
  const ctx = sessionContext(header)
  if (!ctx?.impersonator) return { error: "You are not viewing as another user." }
  return { user: ctx.impersonator }
}

export function canLocalBootstrap() {
  if (isPackagedBuyer()) return false
  if (process.env.NODE_ENV === "production") return false
  return readUsers().length === 0
}

export function canManage(header?: string) {
  if (isPackagedBuyer()) return false
  const ctx = sessionContext(header)
  if (!ctx || ctx.impersonator) return false
  // Seller/dev mode is never admin. The only bootstrap is the first account
  // (or ADMIN_EMAIL) becoming an admin — not an open admin session.
  return ctx.user.role === "admin"
}

export function storeOpen() {
  return !isPackagedBuyer()
}

function readPasswordResets(): PasswordReset[] {
  const rows = readCollection<PasswordReset>("password_resets")
  return Array.isArray(rows) ? rows : []
}

function writePasswordResets(rows: PasswordReset[]) {
  const now = Date.now()
  const kept = rows.filter((row) => {
    if (row.usedAt) return now - new Date(row.usedAt).getTime() < 24 * 60 * 60 * 1000
    return new Date(row.expiresAt).getTime() > now - PASSWORD_RESET_TTL_MS
  })
  writeCollection("password_resets", kept.slice(0, 400))
}

function tooManyForgotAttempts(email: string) {
  const now = Date.now()
  const recent = (forgotAttempts.get(email) ?? []).filter((at) => now - at < FORGOT_RATE_WINDOW_MS)
  if (recent.length >= FORGOT_RATE_LIMIT) {
    forgotAttempts.set(email, recent)
    return true
  }
  recent.push(now)
  forgotAttempts.set(email, recent)
  return false
}

export function issuePasswordReset(email: string): {
  message: string
  rawToken?: string
  user?: User
  skipped?: "invalid" | "unknown" | "suspended" | "rate_limited"
} {
  const message = FORGOT_PASSWORD_MESSAGE
  const normalized = normalizeEmail(email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { message, skipped: "invalid" }
  }
  if (tooManyForgotAttempts(normalized)) {
    return { message, skipped: "rate_limited" }
  }
  const user = findUserByEmail(normalized)
  if (!user) return { message, skipped: "unknown" }
  if (userStatus(user) === "suspended") return { message, skipped: "suspended" }
  const rawToken = randomBytes(32).toString("hex")
  const next: PasswordReset = {
    tokenHash: hashResetToken(rawToken),
    userId: user.id,
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString(),
    usedAt: null,
  }
  const others = readPasswordResets().filter((row) => row.userId !== user.id || row.usedAt)
  writePasswordResets([next, ...others])
  return { message, rawToken, user }
}

export function resetPasswordWithToken(input: { token: string; password: string }): {
  user?: PublicUser
  error?: string
} {
  const token = input.token.trim()
  const password = input.password
  if (!token) return { error: "This reset link is invalid or has expired." }
  if (password.length < 8) return { error: "Use a password with at least 8 characters." }
  const tokenHash = hashResetToken(token)
  const rows = readPasswordResets()
  const row = rows.find((item) => item.tokenHash === tokenHash)
  if (!row || row.usedAt) return { error: "This reset link is invalid or has expired." }
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    return { error: "This reset link is invalid or has expired." }
  }
  const users = readUsers()
  const current = users.find((user) => user.id === row.userId)
  if (!current || userStatus(current) === "suspended") {
    return { error: "This reset link is invalid or has expired." }
  }
  const next: User = { ...current, passwordHash: hashPassword(password) }
  writeUsers(users.map((user) => (user.id === current.id ? next : user)))
  writePasswordResets(
    rows.map((item) => (item.tokenHash === tokenHash ? { ...item, usedAt: new Date().toISOString() } : item)),
  )
  revokeSessionsForUser(current.id)
  return { user: publicUser(next) }
}
