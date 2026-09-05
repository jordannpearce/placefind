import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { Pool, type QueryResultRow } from "pg"

import { DEFAULT_COST_PER_LEAD_USD, normalizeLead, parseCostPerLeadUsd, parseStoredLeads } from "./leads"
import { hashPassword, verifyPassword } from "./password"
import { parseTrialEndsAt } from "./paddle-access"
import { clampExtraCampaigns, isPlanId } from "./plans"
import { purgeUserAccount } from "./purge-user"
import { normalizeWorkspaceScans } from "./scan-results"
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
    settings: {
      resendApiKey: "",
      resendFrom: DEFAULT_RESEND_FROM,
      resendAudienceId: "",
      costPerLeadUsd: DEFAULT_COST_PER_LEAD_USD,
    },
    leads: [],
    customers: [],
    subscriptions: [],
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
    trialEndsAt: parseTrialEndsAt(raw.trialEndsAt),
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
  if (user.role === "admin") {
    return {
      campaigns: defaultCampaigns(),
      settings: { login: "", password: "" },
      activeCampaignId: "camp_houndstooth_austin",
      scans: {},
    }
  }
  return emptyWorkspace()
}

const ADVERTISED_DEMO_EMAIL = "demo@gridpin.app"
const ADVERTISED_DEMO_ID = "user_demo"

function isAdvertisedDemoUser(user: Pick<User, "id" | "email">) {
  return user.id === ADVERTISED_DEMO_ID || user.email.trim().toLowerCase() === ADVERTISED_DEMO_EMAIL
}

/** Drop the former public demo account the same way admin delete does. */
function purgeAdvertisedDemoAccount(db: Database): boolean {
  const demo = db.users.find(isAdvertisedDemoUser)
  if (!demo) return false
  const actor = db.users.find((user) => user.role === "admin" && user.id !== demo.id)
  const result = purgeUserAccount(db, demo.id, actor?.id || "user_tm_admin")
  return result.ok
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

export { purgeUserAccount, type PurgeUserResult } from "./purge-user"
export {
  deleteAgencyGroup,
  deleteLeftoverDemoAgencyGroups,
  type DeleteAgencyGroupResult,
} from "./agency-group"

function seedDb(db: Database): Database {
  const now = new Date().toISOString()
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
    agencyId: "",
    paddleCustomerId: "",
    createdAt: now,
    lastLoginAt: null,
    dfsLogin: "",
    dfsPassword: "",
    trialEndsAt: null,
  }
  db.users = [admin]
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
    return
  }
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
    agencyId: "",
    paddleCustomerId: "",
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    dfsLogin: "",
    dfsPassword: "",
    trialEndsAt: null,
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
    workspaces: Object.fromEntries(
      Object.entries(raw.workspaces ?? {}).map(([userId, workspace]) => [
        userId,
        {
          ...workspace,
          scans: normalizeWorkspaceScans(
            workspace.scans,
            (workspace.campaigns ?? []).map((campaign) => campaign.id)
          ),
        },
      ])
    ),
    agencies: raw.agencies ?? [],
    settings: {
      resendApiKey: raw.settings?.resendApiKey ?? "",
      resendFrom: defaultResendFrom(raw.settings?.resendFrom),
      resendAudienceId: raw.settings?.resendAudienceId ?? "",
      costPerLeadUsd: parseCostPerLeadUsd(raw.settings?.costPerLeadUsd),
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
  // Leave users with an empty agencyId unassigned. Auto-creating a group from
  // company/name was recreating leftover demo labels such as GridPins.
  for (const customer of db.customers) {
    if (!customer.email) continue
    const user = db.users.find((item) => item.email === customer.email)
    if (user && !user.paddleCustomerId) user.paddleCustomerId = customer.customerId
  }
  ensureAdmin(db)
  purgeAdvertisedDemoAccount(db)
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
        CREATE TABLE IF NOT EXISTS leads (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL,
          phone TEXT NOT NULL DEFAULT '',
          business_name TEXT NOT NULL DEFAULT '',
          city TEXT NOT NULL DEFAULT '',
          state TEXT NOT NULL DEFAULT '',
          comments TEXT NOT NULL DEFAULT '',
          website TEXT NOT NULL DEFAULT '',
          gbp_listing TEXT NOT NULL DEFAULT '',
          primary_category TEXT NOT NULL DEFAULT '',
          keyword TEXT NOT NULL DEFAULT '',
          location_count TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'new',
          assigned_to_user_id TEXT NOT NULL DEFAULT '',
          assigned_at TIMESTAMPTZ,
          lead_price NUMERIC,
          invoice_status TEXT NOT NULL DEFAULT 'none',
          invoice_error TEXT NOT NULL DEFAULT '',
          invoice_dry_run BOOLEAN NOT NULL DEFAULT FALSE,
          paddle_transaction_id TEXT NOT NULL DEFAULT '',
          paddle_invoice_id TEXT NOT NULL DEFAULT '',
          paddle_invoice_url TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT 'get-found',
          audience_synced BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL
        );
        CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);
        CREATE INDEX IF NOT EXISTS leads_email_idx ON leads (email);
      `)
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_campaigns INTEGER NOT NULL DEFAULT 0`)
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT NOT NULL DEFAULT ''`)
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ`)
    })()
  }
  await schemaReady
}

async function loadFromPostgres(): Promise<Database> {
  await ensureSchema()
  const [users, tokens, emails, workspaces, agencies, settingsRows, customers, subscriptions, leadRows] = await Promise.all([
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
      trial_ends_at: Date | null
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
    query<{
      id: string
      name: string
      email: string
      phone: string
      business_name: string
      city: string
      state: string
      comments: string
      website: string
      gbp_listing: string
      primary_category: string
      keyword: string
      location_count: string
      status: string
      assigned_to_user_id: string
      assigned_at: Date | null
      lead_price: string | number | null
      invoice_status: string
      invoice_error: string
      invoice_dry_run: boolean
      paddle_transaction_id: string
      paddle_invoice_id: string
      paddle_invoice_url: string
      source: string
      audience_synced: boolean
      created_at: Date
    }>("SELECT * FROM leads ORDER BY created_at DESC"),
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
        trialEndsAt: row.trial_ends_at ? row.trial_ends_at.toISOString() : null,
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
          scans: normalizeWorkspaceScans(
            row.scans,
            Array.isArray(row.campaigns) ? row.campaigns.map((campaign) => campaign.id) : []
          ),
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
      costPerLeadUsd: parseCostPerLeadUsd(settingsMap.costPerLeadUsd),
    },
    leads:
      leadRows.rows.length > 0
        ? leadRows.rows
            .map((row) =>
              normalizeLead({
                id: row.id,
                name: row.name,
                email: row.email,
                phone: row.phone,
                businessName: row.business_name,
                city: row.city,
                state: row.state,
                comments: row.comments,
                website: row.website,
                gbpListing: row.gbp_listing,
                primaryCategory: row.primary_category,
                keyword: row.keyword,
                locationCount: row.location_count as MarketingLead["locationCount"],
                status: row.status as MarketingLead["status"],
                assignedToUserId: row.assigned_to_user_id,
                assignedAt: row.assigned_at ? row.assigned_at.toISOString() : null,
                leadPrice: row.lead_price == null ? null : Number(row.lead_price),
                invoiceStatus: row.invoice_status as MarketingLead["invoiceStatus"],
                invoiceError: row.invoice_error,
                invoiceDryRun: row.invoice_dry_run,
                paddleTransactionId: row.paddle_transaction_id,
                paddleInvoiceId: row.paddle_invoice_id,
                paddleInvoiceUrl: row.paddle_invoice_url,
                source: "get-found",
                audienceSynced: row.audience_synced,
                createdAt: row.created_at.toISOString(),
              })
            )
            .filter((lead): lead is MarketingLead => Boolean(lead))
        : parseStoredLeads(settingsMap.marketingLeads),
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
    await client.query("DELETE FROM leads")
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
          paddle_customer_id, created_at, last_login_at, dfs_login, dfs_password, trial_ends_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
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
          user.trialEndsAt,
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
      "costPerLeadUsd",
      String(parseCostPerLeadUsd(db.settings.costPerLeadUsd)),
    ])
    await client.query("INSERT INTO app_settings (key, value) VALUES ($1, $2)", [
      "marketingLeads",
      JSON.stringify(db.leads.slice(0, 500)),
    ])
    for (const lead of db.leads.slice(0, 500)) {
      await client.query(
        `INSERT INTO leads (
          id, name, email, phone, business_name, city, state, comments, website, gbp_listing,
          primary_category, keyword, location_count, status, assigned_to_user_id, assigned_at,
          lead_price, invoice_status, invoice_error, invoice_dry_run, paddle_transaction_id,
          paddle_invoice_id, paddle_invoice_url, source, audience_synced, created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
        )`,
        [
          lead.id,
          lead.name,
          lead.email,
          lead.phone,
          lead.businessName,
          lead.city,
          lead.state,
          lead.comments,
          lead.website,
          lead.gbpListing,
          lead.primaryCategory,
          lead.keyword,
          lead.locationCount,
          lead.status,
          lead.assignedToUserId,
          lead.assignedAt,
          lead.leadPrice,
          lead.invoiceStatus,
          lead.invoiceError,
          lead.invoiceDryRun,
          lead.paddleTransactionId,
          lead.paddleInvoiceId,
          lead.paddleInvoiceUrl,
          lead.source,
          lead.audienceSynced,
          lead.createdAt,
        ]
      )
    }
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
    const storedDemo = await query<{ id: string }>(
      "SELECT id FROM users WHERE id = $1 OR lower(email) = $2",
      [ADVERTISED_DEMO_ID, ADVERTISED_DEMO_EMAIL]
    )
    const db = await loadFromPostgres()
    const storedHash = storedAdmin.rows[0]?.password_hash
    if (!storedHash || !verifyPassword(ADMIN_PASSWORD, storedHash) || storedDemo.rows.length > 0) {
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
