import { readFileSync } from "node:fs"
import path from "node:path"
import pg from "pg"

const EXPECTED_TABLES = ["users", "sessions", "orders", "issued_licenses", "mail_outbox", "campaigns"] as const
const EXPECTED_USER_COLUMNS = ["id", "name", "email", "password_hash", "role", "status", "created_at"] as const

function postgresUrl() {
  const url = process.env.DATABASE_URL?.trim() ?? ""
  if (/^postgres(ql)?:\/\//i.test(url)) return url
  return ""
}

const url = postgresUrl()
if (!url) {
  console.error("DATABASE_URL is missing or is not a Postgres URL.")
  process.exit(1)
}

const schemaPath = path.resolve(process.cwd(), "server/schema.sql")
const schema = readFileSync(schemaPath, "utf8")

const pool = new pg.Pool({
  connectionString: url,
  ssl: process.env.DATABASE_SSL === "0" ? undefined : { rejectUnauthorized: false },
})

try {
  await pool.query(schema)
  const tables = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  )
  const names = tables.rows.map((row) => row.tablename as string)
  const missing = EXPECTED_TABLES.filter((name) => !names.includes(name))
  if (missing.length) {
    console.error("PlaceFind schema is missing tables:", missing.join(", "))
    process.exit(1)
  }
  const columns = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'",
  )
  const userColumns = columns.rows.map((row) => row.column_name as string)
  const missingColumns = EXPECTED_USER_COLUMNS.filter((name) => !userColumns.includes(name))
  if (missingColumns.length) {
    console.error("PlaceFind users table is missing columns:", missingColumns.join(", "))
    process.exit(1)
  }
  console.log("PlaceFind Postgres schema is ready:", EXPECTED_TABLES.join(", "))
} finally {
  await pool.end()
}
