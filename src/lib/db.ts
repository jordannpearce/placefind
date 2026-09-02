import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"

import { defaultCampaigns } from "./storage"
import type { AuthToken, MailRecord, User, UserWorkspace } from "./types"
import { hashPassword } from "./password"

const DATA_DIR = join(process.cwd(), ".data")
const DB_PATH = join(DATA_DIR, "gridpin.json")

export type Database = {
  users: User[]
  tokens: AuthToken[]
  emails: MailRecord[]
  workspaces: Record<string, UserWorkspace>
}

let writeQueue: Promise<void> = Promise.resolve()

function emptyDb(): Database {
  return { users: [], tokens: [], emails: [], workspaces: {} }
}

export function readDb(): Database {
  if (!existsSync(DB_PATH)) {
    const seeded = seedDb(emptyDb())
    persist(seeded)
    return seeded
  }
  try {
    const parsed = JSON.parse(readFileSync(DB_PATH, "utf8")) as Partial<Database>
    return {
      users: parsed.users ?? [],
      tokens: parsed.tokens ?? [],
      emails: parsed.emails ?? [],
      workspaces: parsed.workspaces ?? {},
    }
  } catch {
    const seeded = seedDb(emptyDb())
    persist(seeded)
    return seeded
  }
}

export async function updateDb<T>(mutator: (db: Database) => T): Promise<T> {
  const run = writeQueue.then(() => {
    const db = readDb()
    const result = mutator(db)
    persist(db)
    return result
  })
  writeQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

function persist(db: Database) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

function seedDb(db: Database): Database {
  const now = new Date().toISOString()
  const admin: User = {
    id: "user_admin",
    name: "GridPin Admin",
    email: "admin@gridpin.app",
    passwordHash: hashPassword("GridPin!admin"),
    role: "admin",
    status: "active",
    plan: "enterprise",
    marketingOptIn: false,
    company: "GridPin",
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
    plan: "agency",
    marketingOptIn: true,
    company: "Houndstooth + Jo's",
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
