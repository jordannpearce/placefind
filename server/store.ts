import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

export type StoreDriver = "postgres" | "json"

export type StoreCollection = "users" | "sessions" | "orders" | "issued_licenses" | "mail_outbox" | "campaigns"

type JsonRow = Record<string, unknown>

const FILES: Record<StoreCollection, string> = {
  users: "users.json",
  sessions: "sessions.json",
  orders: "orders.json",
  issued_licenses: "issued-licenses.json",
  mail_outbox: "mail-outbox.json",
  campaigns: "campaigns.json",
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL,
  license_id TEXT,
  license_key TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  emailed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS issued_licenses (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expiry TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS mail_outbox (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL
);
`

const memory: Record<StoreCollection, JsonRow[]> = {
  users: [],
  sessions: [],
  orders: [],
  issued_licenses: [],
  mail_outbox: [],
  campaigns: [],
}

let loaded = false
let driver: StoreDriver = "json"
let pool: import("pg").Pool | null = null

export function dataDir() {
  return path.resolve(process.env.PLACEFIND_DATA_DIR || path.resolve(process.cwd(), ".data"))
}

export function storeDriver(): StoreDriver {
  return driver
}

function fileFor(name: StoreCollection) {
  return path.join(dataDir(), FILES[name])
}

function readJsonFile<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback
    return JSON.parse(readFileSync(file, "utf8")) as T
  } catch {
    return fallback
  }
}

function writeJsonFile(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2))
}

function loadJsonIntoMemory() {
  for (const name of Object.keys(FILES) as StoreCollection[]) {
    const rows = readJsonFile<JsonRow[]>(fileFor(name), [])
    memory[name] = Array.isArray(rows) ? rows : []
  }
}

function persistJson(name: StoreCollection) {
  writeJsonFile(fileFor(name), memory[name])
}

function postgresUrl() {
  const url = process.env.DATABASE_URL?.trim() ?? ""
  if (/^postgres(ql)?:\/\//i.test(url)) return url
  return ""
}

function requirePostgres() {
  return process.env.NODE_ENV === "production" && Boolean(postgresUrl())
}

async function persistPostgres(name: StoreCollection) {
  if (!pool) return
  const client = await pool.connect()
  const rows = memory[name]
  try {
    await client.query("BEGIN")
    if (name === "users") {
      await client.query("DELETE FROM users")
      for (const row of rows) {
        await client.query(
          "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
          [row.id, row.name, row.email, row.passwordHash, row.role, row.createdAt],
        )
      }
    } else if (name === "sessions") {
      await client.query("DELETE FROM sessions")
      for (const row of rows) {
        await client.query("INSERT INTO sessions (token, user_id, created_at) VALUES ($1,$2,$3)", [
          row.token,
          row.userId,
          row.createdAt,
        ])
      }
    } else if (name === "orders") {
      await client.query("DELETE FROM orders")
      for (const row of rows) {
        await client.query(
          `INSERT INTO orders (id, user_id, name, email, amount, status, license_id, license_key, created_at, emailed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            row.id,
            row.userId,
            row.name,
            row.email,
            row.amount,
            row.status,
            row.licenseId,
            row.licenseKey,
            row.createdAt,
            row.emailedAt,
          ],
        )
      }
    } else if (name === "issued_licenses") {
      await client.query("DELETE FROM issued_licenses")
      for (const row of rows) {
        await client.query(
          "INSERT INTO issued_licenses (id, key, name, email, created_at, expiry) VALUES ($1,$2,$3,$4,$5,$6)",
          [row.id, row.key, row.name, row.email, row.createdAt, row.expiry],
        )
      }
    } else if (name === "mail_outbox") {
      await client.query("DELETE FROM mail_outbox")
      for (const row of rows) {
        await client.query("INSERT INTO mail_outbox (id, payload) VALUES ($1,$2::jsonb)", [row.id, JSON.stringify(row)])
      }
    } else if (name === "campaigns") {
      await client.query("DELETE FROM campaigns")
      for (const row of rows) {
        await client.query("INSERT INTO campaigns (id, payload) VALUES ($1,$2::jsonb)", [row.id, JSON.stringify(row)])
      }
    }
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

async function loadPostgres() {
  if (!pool) return
  const users = await pool.query(
    "SELECT id, name, email, password_hash AS \"passwordHash\", role, created_at AS \"createdAt\" FROM users ORDER BY created_at DESC",
  )
  const sessions = await pool.query(
    "SELECT token, user_id AS \"userId\", created_at AS \"createdAt\" FROM sessions ORDER BY created_at DESC",
  )
  const orders = await pool.query(
    `SELECT id, user_id AS "userId", name, email, amount, status,
            license_id AS "licenseId", license_key AS "licenseKey",
            created_at AS "createdAt", emailed_at AS "emailedAt"
     FROM orders ORDER BY created_at DESC`,
  )
  const issued = await pool.query(
    `SELECT id, key, name, email, created_at AS "createdAt", expiry
     FROM issued_licenses ORDER BY created_at DESC`,
  )
  const outbox = await pool.query("SELECT payload FROM mail_outbox")
  const campaigns = await pool.query("SELECT payload FROM campaigns")
  memory.users = users.rows
  memory.sessions = sessions.rows
  memory.orders = orders.rows
  memory.issued_licenses = issued.rows
  memory.mail_outbox = outbox.rows.map((row) => row.payload as JsonRow)
  memory.campaigns = campaigns.rows.map((row) => row.payload as JsonRow)
}

function collectionEmpty() {
  return (
    memory.users.length === 0 &&
    memory.sessions.length === 0 &&
    memory.orders.length === 0 &&
    memory.issued_licenses.length === 0 &&
    memory.mail_outbox.length === 0 &&
    memory.campaigns.length === 0
  )
}

export function resetStoreForTests(dir?: string) {
  if (dir) process.env.PLACEFIND_DATA_DIR = dir
  loaded = true
  driver = "json"
  pool = null
  for (const name of Object.keys(memory) as StoreCollection[]) memory[name] = []
}

export function reloadStoreFromDisk() {
  loaded = false
  pool = null
  driver = "json"
  loadJsonIntoMemory()
  loaded = true
}

function ensureLoaded() {
  if (loaded) return
  loadJsonIntoMemory()
  loaded = true
  driver = "json"
}

export function readCollection<T>(name: StoreCollection): T[] {
  ensureLoaded()
  return memory[name] as T[]
}

export function writeCollection<T>(name: StoreCollection, rows: T[]) {
  ensureLoaded()
  memory[name] = rows as JsonRow[]
  if (driver === "json") {
    persistJson(name)
    return
  }
  void persistPostgres(name).catch((error) => {
    console.error(`PlaceFind could not persist ${name} to Postgres.`, error)
  })
}

export async function initStore(): Promise<StoreDriver> {
  const url = postgresUrl()
  if (!url) {
    loadJsonIntoMemory()
    loaded = true
    driver = "json"
    return driver
  }

  try {
    const pg = await import("pg")
    pool = new pg.Pool({
      connectionString: url,
      ssl: process.env.DATABASE_SSL === "0" ? undefined : { rejectUnauthorized: false },
    })
    await pool.query(SCHEMA_SQL)
    await loadPostgres()
    if (collectionEmpty()) {
      loadJsonIntoMemory()
      for (const name of Object.keys(FILES) as StoreCollection[]) {
        if (memory[name].length) await persistPostgres(name)
      }
    }
    loaded = true
    driver = "postgres"
    console.log("PlaceFind is using Postgres for app data.")
    return driver
  } catch (error) {
    if (requirePostgres()) {
      throw error
    }
    console.warn("PlaceFind could not reach Postgres. Using local JSON files instead.")
    loadJsonIntoMemory()
    loaded = true
    driver = "json"
    pool = null
    return driver
  }
}
