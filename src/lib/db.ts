import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { Pool, type QueryResultRow } from "pg"

import { hashPassword, verifyPassword } from "./password"
import { isDemoAccount } from "./paddle-access"
import { clampExtraCampaigns, isPlanId } from "./plans"
import { defaultCampaigns } from "./storage"
import type {
  Agency,
  AppSettings,
  AuthToken,
  MailRecord,
  MarketingLead,
  PaddleCustomer,
  PaddleSubscription,
  PlanId,
  User,
  UserWorkspace,
} from "./types"

const DATA_DIR = join(process.cwd(), ".data")
const DB_PATH = join(DATA_DIR, "gridpin.json")

export type Database = {
  users: User[]
  tokens: AuthToken[]
  emails: MailRecord[]
  workspaces: Record<string, UserWorkspace>
  agencies: Agency[]
  settings: AppSettings
  leads: MarketingLead[]
  customers: PaddleCustomer[]
  subscriptions: PaddleSubscription[]
}

const ADMIN_EMAIL = "tmrapp1995@gmail.com"
const ADMIN_PASSWORD = "TaylorSushi1995!"

let writeQueue: Promise<void> = Promise.resolve()
let schemaReady: Promise<void> | null = null

const globalForPg = globalThis as unknown as { gridpinPool?: Pool }

function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || ""
}

function pool() {
  const url = databaseUrl()
  if (!url) return null
  if (!globalForPg.gridpinPool) {
    globalForPg.gridpinPool = new Pool({
      connectionString: url,
      ssl: url.includes("railway.internal") || url.includes("localhost") ? false : { rejectUnauthorized: false },
    })
  }
  return globalForPg.gridpinPool
}

export const DEFAULT_RESEND_FROM = "GridPins <hello@gridpins.com>"
const LEGACY_RESEND_FROM = new Set([
  "GridPins <beth.t@example.com>",
  "GridPins <hello@gridpin.app>",
  "beth.t@example.com",
  "hello@gridpin.app",
])

function defaultResendFrom(value?: string) {
  const trimmed = value?.trim() || ""
  if (!trimmed || LEGACY_RESEND_FROM.has(trimmed)) return DEFAULT_RESEND_FROM
  return trimmed
}

function emptyDb(): Database {
  return {
    users: [],
    tokens: [],
    emails: [],
    workspaces: {},
    agencies: [],
    settings: { resendApiKey: "", resendFrom: DEFAULT_RESEND_FROM, resendAudienceId: "" },
    leads: [],
    customers: [],
    subscriptions: [],
  }
}

function normalizeLead(raw: Partial<MarketingLead>): MarketingLead | null {
  if (!raw.email?.trim()) return null
  return {
    id: raw.id || `lead_${Date.now()}`,
    name: raw.name || "",
    email: raw.email.trim().toLowerCase(),
    phone: raw.phone || "",
    businessName: raw.businessName || "",
    city: raw.city || "",
    state: raw.state || "",
    comments: raw.comments || "",
    source: "get-found",
    audienceSynced: Boolean(raw.audienceSynced),
    createdAt: raw.createdAt || new Date().toISOString(),
  }
}

function parseStoredLeads(value?: string): MarketingLead[] {
  if (!value?.trim()) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeLead(item as Partial<MarketingLead>))
      .filter((item): item is MarketingLead => Boolean(item))
  } catch {
    return []
  }
}

function normalizeUser(raw: Partial<User> & { email: string }): User {
  const plan: PlanId = isPlanId(raw.plan) ? raw.plan : "starter"
  return {
    id: raw.id || `user_${Date.now()}`,
    name: raw.name || "User",
    email: raw.email,
    passwordHash: raw.passwordHash || "",
    role: raw.role === "admin" ? "admin" : "user",
    status: raw.status === "pending" || raw.status === "suspended" ? raw.status : "active",
    plan,
    extraCampaigns: clampExtraCampaigns(plan, raw.extraCampaigns),
    marketingOptIn: Boolean(raw.marketingOptIn),
    company: raw.company || "",
    agencyId: raw.agencyId || "",
    paddleCustomerId: raw.paddleCustomerId || "",
    createdAt: raw.createdAt || new Date().toISOString(),
    lastLoginAt: raw.lastLoginAt ?? null,
    dfsLogin: raw.dfsLogin || "",
    dfsPassword: raw.dfsPassword || "",
  }
}

export function emptyWorkspace(): UserWorkspace {
  return {
    campaigns: [],
    settings: { login: "", password: "" },
    activeCampaignId: "",
    scans: {},
  }
}

function seedWorkspaceForAccount(user: Pick<User, "id" | "email" | "role">): UserWorkspace {
  if (user.role === "admin" || isDemoAccount(user)) {
    return {
      campaigns: defaultCampaigns(),
      settings: { login: "", password: "" },
      activeCampaignId: "camp_houndstooth_austin",
      scans: {},
    }
  }
  return emptyWorkspace()
}

export function findOrCreateWorkspace(db: Database, userId: string) {
  if (!db.workspaces[userId]) {
    const user = db.users.find((item) => item.id === userId)
    db.workspaces[userId] = user ? seedWorkspaceForAccount(user) : emptyWorkspace()
  }
  return db.workspaces[userId]
}

export function findOrCreateAgency(db: Database, name: string): Agency {
  const trimmed = name.trim() || "Independent"
  const existing = db.agencies.find((agency) => agency.name.toLowerCase() === trimmed.toLowerCase())
  if (existing) return existing
  const agency: Agency = {
    id: `agency_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    createdAt: new Date().toISOString(),
  }
  db.agencies.push(agency)
  return agency
}

function seedDb(db: Database): Database {
  const now = new Date().toISOString()
  const gridpin = findOrCreateAgency(db, "GridPins")
  const taylor = findOrCreateAgency(db, "Taylor Agency")
  const admin: User = {
    id: "user_tm_admin",
    name: "TM",
    email: ADMIN_EMAIL,
    passwordHash: hashPassword(ADMIN_PASSWORD),
    role: "admin",
    status: "active",
    plan: "enterprise",
    extraCampaigns: 0,
    marketingOptIn: false,
    company: "GridPins",
    agencyId: gridpin.id,
    paddleCustomerId: "",
    createdAt: now,
    lastLoginAt: null,
    dfsLogin: "",
    dfsPassword: "",
  }
  const demo: User = {
    id: "user_demo",
    name: "Taylor Agency",
    email: "demo@gridpin.app",
    passwordHash: hashPassword("demo1234"),
    role: "user",
    status: "active",
    plan: "enterprise",
    extraCampaigns: 0,
    marketingOptIn: true,
    company: "Taylor Agency",
    agencyId: taylor.id,
    paddleCustomerId: "",
    createdAt: now,
    lastLoginAt: null,
    dfsLogin: "",
    dfsPassword: "",
  }
  db.users = [admin, demo]
  db.workspaces[demo.id] = {
    campaigns: defaultCampaigns(),
    settings: { login: "", password: "" },
    activeCampaignId: "camp_houndstooth_austin",
    scans: {},
  }
  db.workspaces[admin.id] = {
    campaigns: defaultCampaigns(),
    settings: { login: "", password: "" },
    activeCampaignId: "camp_houndstooth_austin",
    scans: {},
  }
  return db
}

function ensureAdmin(db: Database) {
  const existing = db.users.find((user) => user.email === ADMIN_EMAIL)
  if (existing) {
    existing.role = "admin"
    existing.status = "active"
    if (!verifyPassword(ADMIN_PASSWORD, existing.passwordHash)) {
      existing.passwordHash = hashPassword(ADMIN_PASSWORD)
    }
    if (!existing.agencyId) existing.agencyId = findOrCreateAgency(db, existing.company || "GridPins").id
    return
  }
  const agency = findOrCreateAgency(db, "GridPins")
  db.users.push({
    id: "user_tm_admin",
    name: "TM",
    email: ADMIN_EMAIL,
    passwordHash: hashPassword(ADMIN_PASSWORD),
    role: "admin",
    status: "active",
    plan: "enterprise",
    extraCampaigns: 0,
    marketingOptIn: false,
    company: "GridPins",
    agencyId: agency.id,
    paddleCustomerId: "",
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    dfsLogin: "",
    dfsPassword: "",
  })
  if (!db.workspaces["user_tm_admin"]) {
    db.workspaces["user_tm_admin"] = {
      campaigns: defaultCampaigns(),
      settings: { login: "", password: "" },
      activeCampaignId: "camp_houndstooth_austin",
      scans: {},
    }
  }
}

function hydrate(raw: Partial<Database>): Database {
  const db: Database = {
    users: (raw.users ?? []).map((user) => normalizeUser(user)),
    tokens: raw.tokens ?? [],
    emails: raw.emails ?? [],
    workspaces: raw.workspaces ?? {},
    agencies: raw.agencies ?? [],
    settings: {
      resendApiKey: raw.settings?.resendApiKey ?? "",
      resendFrom: defaultResendFrom(raw.settings?.resendFrom),
      resendAudienceId: raw.settings?.resendAudienceId ?? "",
    },
    leads: (raw.leads ?? []).map((lead) => normalizeLead(lead)).filter((lead): lead is MarketingLead => Boolean(lead)),
    customers: (raw.customers ?? [])
      .filter((row) => Boolean(row.customerId))
      .map((row) => ({
        customerId: row.customerId,
        email: row.email?.trim().toLowerCase() || "",
        createdAt: row.createdAt || new Date().toISOString(),
        updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
      })),
    subscriptions: (raw.subscriptions ?? [])
      .filter((row) => Boolean(row.subscriptionId && row.customerId))
      .map((row) => ({
        subscriptionId: row.subscriptionId,
        customerId: row.customerId,
        status: row.status,
        priceId: row.priceId || "",
        productId: row.productId || "",
        scheduledChangeAction: row.scheduledChangeAction ?? null,
        scheduledChangeAt: row.scheduledChangeAt ?? null,
        createdAt: row.createdAt || new Date().toISOString(),
        updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
      })),
  }
  for (const user of db.users) {
    if (!user.agencyId) user.agencyId = findOrCreateAgency(db, user.company || user.name).id
  }
  for (const customer of db.customers) {
    if (!customer.email) continue
    const user = db.users.find((item) => item.email === customer.email)
    if (user && !user.paddleCustomerId) user.paddleCustomerId = customer.customerId
  }
  const demo = db.users.find((user) => user.id === "user_demo" || user.email === "demo@gridpin.app")
  if (demo) {
    demo.plan = "enterprise"
    demo.extraCampaigns = 0
    // Advertised public demo stays usable without a Paddle customer.
    // Software access is granted via isDemoAccount(), not a invented subscription.
  }
  ensureAdmin(db)
  return db
}

async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  const client = pool()
  if (!client) throw new Error("DATABASE_URL is not set")
  return client.query<T>(sql, params)
}

async function ensureSchema() {
  if (!pool()) return
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS agencies (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL
        );
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL,
          status TEXT NOT NULL,
          plan TEXT NOT NULL,
          extra_campaigns INTEGER NOT NULL DEFAULT 0,
          marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
          company TEXT NOT NULL DEFAULT '',
          agency_id TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL,
          last_login_at TIMESTAMPTZ,
          dfs_login TEXT NOT NULL DEFAULT '',
          dfs_password TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL
        );
        CREATE TABLE IF NOT EXISTS emails (
          id TEXT PRIMARY KEY,
          recipient TEXT NOT NULL,
          subject TEXT NOT NULL,
          html TEXT NOT NULL,
          kind TEXT NOT NULL,
          user_id TEXT,
          provider TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL
        );
        CREATE TABLE IF NOT EXISTS workspaces (
          user_id TEXT PRIMARY KEY,
          campaigns JSONB NOT NULL,
          settings JSONB NOT NULL,
          active_campaign_id TEXT NOT NULL DEFAULT '',
          scans JSONB NOT NULL
        );
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS customers (
          customer_id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS subscriptions (
          subscription_id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL REFERENCES customers(customer_id),
          status TEXT NOT NULL,
          price_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          scheduled_change_action TEXT,
          scheduled_change_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS customers_email_idx ON customers (email);
        CREATE INDEX IF NOT EXISTS subscriptions_customer_id_idx ON subscriptions (customer_id);
      `)
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_campaigns INTEGER NOT NULL DEFAULT 0`)
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT NOT NULL DEFAULT ''`)
    })()
  }
  await schemaReady
}

async function loadFromPostgres(): Promise<Database> {
  await ensureSchema()
  const [users, tokens, emails, workspaces, agencies, settingsRows, customers, subscriptions] = await Promise.all([
    query<{
      id: string
      name: string
      email: string
      password_hash: string
      role: User["role"]
      status: User["status"]
      plan: User["plan"]
      extra_campaigns: number
      marketing_opt_in: boolean
      company: string
      agency_id: string
      paddle_customer_id: string
      created_at: Date
      last_login_at: Date | null
      dfs_login: string
      dfs_password: string
    }>("SELECT * FROM users"),
    query<AuthToken & { user_id: string; token_hash: string; expires_at: Date }>("SELECT * FROM tokens"),
    query<{
      id: string
      recipient: string
      subject: string
      html: string
      kind: MailRecord["kind"]
      user_id: string | null
      provider: MailRecord["provider"]
      created_at: Date
    }>("SELECT * FROM emails ORDER BY created_at DESC"),
    query<{
      user_id: string
      campaigns: UserWorkspace["campaigns"]
      settings: UserWorkspace["settings"]
      active_campaign_id: string
      scans: UserWorkspace["scans"]
    }>("SELECT * FROM workspaces"),
    query<{ id: string; name: string; created_at: Date }>("SELECT * FROM agencies"),
    query<{ key: string; value: string }>("SELECT * FROM app_settings"),
    query<{
      customer_id: string
      email: string
      created_at: Date
      updated_at: Date
    }>("SELECT * FROM customers"),
    query<{
      subscription_id: string
      customer_id: string
      status: string
      price_id: string
      product_id: string
      scheduled_change_action: string | null
      scheduled_change_at: Date | null
      created_at: Date
      updated_at: Date
    }>("SELECT * FROM subscriptions"),
  ])

  const settingsMap = Object.fromEntries(settingsRows.rows.map((row) => [row.key, row.value]))
  const db = hydrate({
    users: users.rows.map((row) =>
      normalizeUser({
        id: row.id,
        name: row.name,
        email: row.email,
        passwordHash: row.password_hash,
        role: row.role,
        status: row.status,
        plan: row.plan,
        extraCampaigns: row.extra_campaigns,
        marketingOptIn: row.marketing_opt_in,
        company: row.company,
        agencyId: row.agency_id,
        paddleCustomerId: row.paddle_customer_id || "",
        createdAt: row.created_at.toISOString(),
        lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
        dfsLogin: row.dfs_login,
        dfsPassword: row.dfs_password,
      })
    ),
    tokens: tokens.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at).toISOString(),
    })),
    emails: emails.rows.map((row) => ({
      id: row.id,
      to: row.recipient,
      subject: row.subject,
      html: row.html,
      kind: row.kind,
      userId: row.user_id,
      provider: row.provider,
      createdAt: row.created_at.toISOString(),
    })),
    workspaces: Object.fromEntries(
      workspaces.rows.map((row) => [
        row.user_id,
        {
          campaigns: row.campaigns,
          settings: row.settings,
          activeCampaignId: row.active_campaign_id,
          scans: row.scans,
        },
      ])
    ),
    agencies: agencies.rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at.toISOString(),
    })),
    settings: {
      resendApiKey: settingsMap.resendApiKey || "",
      resendFrom: defaultResendFrom(settingsMap.resendFrom),
      resendAudienceId: settingsMap.resendAudienceId || "",
    },
    leads: parseStoredLeads(settingsMap.marketingLeads),
    customers: customers.rows.map((row) => ({
      customerId: row.customer_id,
      email: row.email,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    })),
    subscriptions: subscriptions.rows.map((row) => ({
      subscriptionId: row.subscription_id,
      customerId: row.customer_id,
      status: row.status,
      priceId: row.price_id,
      productId: row.product_id,
      scheduledChangeAction: row.scheduled_change_action,
      scheduledChangeAt: row.scheduled_change_at ? row.scheduled_change_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    })),
  })
  return db
}

async function saveToPostgres(db: Database) {
  await ensureSchema()
  const client = await pool()!.connect()
  try {
    await client.query("BEGIN")
    await client.query("DELETE FROM tokens")
    await client.query("DELETE FROM emails")
    await client.query("DELETE FROM workspaces")
    await client.query("DELETE FROM subscriptions")
    await client.query("DELETE FROM customers")
    await client.query("DELETE FROM users")
    await client.query("DELETE FROM agencies")
    await client.query("DELETE FROM app_settings")
    for (const agency of db.agencies) {
      await client.query("INSERT INTO agencies (id, name, created_at) VALUES ($1, $2, $3)", [
        agency.id,
        agency.name,
        agency.createdAt,
      ])
    }
    for (const user of db.users) {
      await client.query(
        `INSERT INTO users (
          id, name, email, password_hash, role, status, plan, extra_campaigns, marketing_opt_in, company, agency_id,
          paddle_customer_id, created_at, last_login_at, dfs_login, dfs_password
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          user.id,
          user.name,
          user.email,
          user.passwordHash,
          user.role,
          user.status,
          user.plan,
          user.extraCampaigns,
          user.marketingOptIn,
          user.company,
          user.agencyId,
          user.paddleCustomerId,
          user.createdAt,
          user.lastLoginAt,
          user.dfsLogin,
          user.dfsPassword,
        ]
      )
    }
    for (const customer of db.customers) {
      await client.query(
        "INSERT INTO customers (customer_id, email, created_at, updated_at) VALUES ($1, $2, $3, $4)",
        [customer.customerId, customer.email, customer.createdAt, customer.updatedAt]
      )
    }
    for (const subscription of db.subscriptions) {
      await client.query(
        `INSERT INTO subscriptions (
          subscription_id, customer_id, status, price_id, product_id,
          scheduled_change_action, scheduled_change_at, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          subscription.subscriptionId,
          subscription.customerId,
          subscription.status,
          subscription.priceId,
          subscription.productId,
          subscription.scheduledChangeAction,
          subscription.scheduledChangeAt,
          subscription.createdAt,
          subscription.updatedAt,
        ]
      )
    }
    for (const token of db.tokens) {
      await client.query(
        "INSERT INTO tokens (id, user_id, type, token_hash, expires_at) VALUES ($1,$2,$3,$4,$5)",
        [token.id, token.userId, token.type, token.tokenHash, token.expiresAt]
      )
    }
    for (const email of db.emails.slice(0, 200)) {
      await client.query(
        "INSERT INTO emails (id, recipient, subject, html, kind, user_id, provider, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [email.id, email.to, email.subject, email.html, email.kind, email.userId, email.provider, email.createdAt]
      )
    }
    for (const [userId, workspace] of Object.entries(db.workspaces)) {
      await client.query(
        "INSERT INTO workspaces (user_id, campaigns, settings, active_campaign_id, scans) VALUES ($1,$2::jsonb,$3::jsonb,$4,$5::jsonb)",
        [
          userId,
          JSON.stringify(workspace.campaigns),
          JSON.stringify(workspace.settings),
          workspace.activeCampaignId,
          JSON.stringify(workspace.scans),
        ]
      )
    }
    await client.query("INSERT INTO app_settings (key, value) VALUES ($1, $2)", [
      "resendApiKey",
      db.settings.resendApiKey,
    ])
    await client.query("INSERT INTO app_settings (key, value) VALUES ($1, $2)", [
      "resendFrom",
      db.settings.resendFrom,
    ])
    await client.query("INSERT INTO app_settings (key, value) VALUES ($1, $2)", [
      "resendAudienceId",
      db.settings.resendAudienceId,
    ])
    await client.query("INSERT INTO app_settings (key, value) VALUES ($1, $2)", [
      "marketingLeads",
      JSON.stringify(db.leads),
    ])
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

function loadFromFile(): Database {
  if (!existsSync(DB_PATH)) {
    const seeded = seedDb(emptyDb())
    persistFile(seeded)
    return seeded
  }
  try {
    const parsed = JSON.parse(readFileSync(DB_PATH, "utf8")) as Partial<Database>
    const db = hydrate(parsed)
    persistFile(db)
    return db
  } catch {
    const seeded = seedDb(emptyDb())
    persistFile(seeded)
    return seeded
  }
}

function persistFile(db: Database) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

export async function readDb(): Promise<Database> {
  if (pool()) {
    await ensureSchema()
    const count = await query<{ n: string }>("SELECT COUNT(*)::text AS n FROM users")
    if (Number(count.rows[0]?.n ?? 0) === 0) {
      const seeded = seedDb(emptyDb())
      await saveToPostgres(seeded)
      return seeded
    }
    const storedAdmin = await query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE email = $1",
      [ADMIN_EMAIL]
    )
    const db = await loadFromPostgres()
    const storedHash = storedAdmin.rows[0]?.password_hash
    if (!storedHash || !verifyPassword(ADMIN_PASSWORD, storedHash)) {
      await saveToPostgres(db)
    }
    return db
  }
  return loadFromFile()
}

export async function updateDb<T>(mutator: (db: Database) => T | Promise<T>): Promise<T> {
  const run = writeQueue.then(async () => {
    const db = await readDb()
    const result = await mutator(db)
    if (pool()) await saveToPostgres(db)
    else persistFile(db)
    return result
  })
  writeQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}
