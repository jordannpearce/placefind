import assert from "node:assert/strict"

import type { Database } from "../src/lib/db.ts"
import { purgeUserAccount } from "../src/lib/purge-user.ts"
import type { Agency, PaddleCustomer, PaddleSubscription, User, UserWorkspace } from "../src/lib/types.ts"

const now = "2026-09-04T00:00:00.000Z"

function user(partial: Partial<User> & Pick<User, "id" | "email">): User {
  return {
    name: partial.name || "Test",
    passwordHash: "hash",
    role: "user",
    status: "active",
    plan: "agency",
    extraCampaigns: 2,
    extraScanCredits: 0,
    scansUsed: 0,
    scanPeriodStart: null,
    scanSessionUntil: null,
    marketingOptIn: true,
    company: "Acme",
    agencyId: "agency_1",
    paddleCustomerId: "",
    createdAt: now,
    lastLoginAt: now,
    dfsLogin: "old-dfs",
    dfsPassword: "old-secret",
    trialEndsAt: null,
    aiBrands: [],
    aiScans: [],
    ...partial,
  }
}

function workspace(overrides: Partial<UserWorkspace> = {}): UserWorkspace {
  return {
    campaigns: [
      {
        id: "camp_old",
        name: "Old campaign that must not survive",
        brand: "Old",
        keywords: ["old keyword"],
        activeKeyword: "old keyword",
        businessName: "Old Biz",
        businessCity: "Austin",
        businessState: "TX",
        placeId: "place_old",
        mapsUrl: "",
        locationLabel: "Austin",
        center: { lat: 30, lng: -97 },
        gridSize: 5,
        radiusMiles: 1,
        languageCode: "en",
        device: "desktop",
        schedule: "manual",
        createdAt: now,
        lastScanAt: now,
        nextScanAt: null,
      },
    ],
    settings: { login: "old-dfs", password: "old-secret" },
    activeCampaignId: "camp_old",
    scans: { camp_old: { "old keyword": {} } },
    ...overrides,
  }
}

function emptyDb(users: User[], extras: Partial<Database> = {}): Database {
  const agencies: Agency[] = [
    { id: "agency_1", name: "Acme", createdAt: now },
    { id: "agency_keep", name: "Keep", createdAt: now },
  ]
  return {
    users,
    tokens: extras.tokens ?? [],
    emails: extras.emails ?? [
      {
        id: "mail_1",
        to: "keep@example.com",
        subject: "hello",
        html: "<p>hi</p>",
        kind: "info",
        userId: "user_keep",
        provider: "preview",
        createdAt: now,
      },
    ],
    workspaces: extras.workspaces ?? {},
    agencies: extras.agencies ?? agencies,
    settings: extras.settings ?? {
      resendApiKey: "re_keep",
      resendFrom: "GridPins <hello@gridpins.com>",
      resendAudienceId: "aud_keep",
    },
    leads: extras.leads ?? [],
    customers: extras.customers ?? [],
    subscriptions: extras.subscriptions ?? [],
  }
}

const admin = user({
  id: "user_admin",
  email: "admin@example.com",
  name: "Admin",
  role: "admin",
  dfsLogin: "",
  dfsPassword: "",
  paddleCustomerId: "",
})
const otherAdmin = user({
  id: "user_admin_2",
  email: "admin2@example.com",
  name: "Admin Two",
  role: "admin",
  dfsLogin: "",
  dfsPassword: "",
})
const keep = user({
  id: "user_keep",
  email: "keep@example.com",
  name: "Keep Me",
  paddleCustomerId: "ctm_keep",
  dfsLogin: "keep-dfs",
  dfsPassword: "keep-secret",
})
const doomed = user({
  id: "user_doomed",
  email: "reuse@example.com",
  name: "Doomed",
  paddleCustomerId: "ctm_doomed",
  plan: "enterprise",
  aiBrands: [
    {
      id: "ai_brand_doomed",
      name: "Doomed Dental",
      street: "",
      city: "Austin",
      state: "TX",
      zip: "",
      address: "Austin, TX",
      phone: "",
      website: "https://doomed.example",
      domain: "doomed.example",
      competitors: [],
      lat: null,
      lng: null,
      location: "Austin,Texas,United States",
      subscriptionId: "sub_doomed_ai",
      status: "active",
      prompts: [],
      promptsUsed: 0,
      promptPeriodStart: now,
      createdAt: now,
    },
  ],
  aiScans: [
    {
      id: "scan_doomed",
      brandId: "ai_brand_doomed",
      brandName: "Doomed Dental",
      promptId: "p1",
      prompt: "best dentist",
      country: "United States",
      location: "Austin,Texas,United States",
      createdAt: now,
      mode: "live",
      models: [],
    },
  ],
})

const doomedCustomer: PaddleCustomer = {
  customerId: "ctm_doomed",
  email: "reuse@example.com",
  createdAt: now,
  updatedAt: now,
}
const keepCustomer: PaddleCustomer = {
  customerId: "ctm_keep",
  email: "keep@example.com",
  createdAt: now,
  updatedAt: now,
}
const doomedSub: PaddleSubscription = {
  subscriptionId: "sub_doomed",
  customerId: "ctm_doomed",
  status: "active",
  priceId: "pri_old",
  productId: "pro_old",
  scheduledChangeAction: null,
  scheduledChangeAt: null,
  createdAt: now,
  updatedAt: now,
}
const keepSub: PaddleSubscription = {
  subscriptionId: "sub_keep",
  customerId: "ctm_keep",
  status: "active",
  priceId: "pri_keep",
  productId: "pro_keep",
  scheduledChangeAction: null,
  scheduledChangeAt: null,
  createdAt: now,
  updatedAt: now,
}

const db = emptyDb([admin, otherAdmin, keep, doomed], {
  tokens: [
    {
      id: "tok_old",
      userId: "user_doomed",
      type: "reset",
      tokenHash: "abc",
      expiresAt: now,
    },
    {
      id: "tok_keep",
      userId: "user_keep",
      type: "activation",
      tokenHash: "def",
      expiresAt: now,
    },
  ],
  workspaces: {
    user_doomed: workspace(),
    user_keep: workspace({
      campaigns: [],
      settings: { login: "keep-dfs", password: "keep-secret" },
      activeCampaignId: "",
      scans: {},
    }),
  },
  customers: [doomedCustomer, keepCustomer],
  subscriptions: [doomedSub, keepSub],
})

const self = purgeUserAccount(db, "user_admin", "user_admin")
assert.equal(self.ok, false)
if (!self.ok) assert.equal(self.status, 400)

const missing = purgeUserAccount(db, "user_nobody", "user_admin")
assert.equal(missing.ok, false)
if (!missing.ok) assert.equal(missing.status, 404)

const lastAdminDb = emptyDb([admin, doomed])
const lastAdmin = purgeUserAccount(lastAdminDb, "user_admin", "user_doomed")
assert.equal(lastAdmin.ok, false)
if (!lastAdmin.ok) assert.match(lastAdmin.error, /last admin/i)

const purged = purgeUserAccount(db, "user_doomed", "user_admin")
assert.equal(purged.ok, true)
if (purged.ok) assert.equal(purged.email, "reuse@example.com")

assert.equal(
  db.users.some((item) => item.email === "reuse@example.com"),
  false,
  "email must be free after delete"
)
assert.equal(db.users.some((item) => item.id === "user_doomed"), false)
assert.equal(db.workspaces.user_doomed, undefined)
assert.equal(
  db.tokens.some((token) => token.userId === "user_doomed"),
  false
)
assert.equal(
  db.customers.some((row) => row.customerId === "ctm_doomed" || row.email === "reuse@example.com"),
  false
)
assert.equal(
  db.subscriptions.some((row) => row.customerId === "ctm_doomed"),
  false
)

assert.equal(db.users.find((item) => item.id === "user_keep")?.email, "keep@example.com")
assert.equal(db.users.find((item) => item.id === "user_keep")?.paddleCustomerId, "ctm_keep")
assert.ok(db.workspaces.user_keep)
assert.equal(db.customers.some((row) => row.customerId === "ctm_keep"), true)
assert.equal(db.subscriptions.some((row) => row.subscriptionId === "sub_keep"), true)
assert.equal(db.settings.resendApiKey, "re_keep")
assert.equal(db.agencies.length, 2)
assert.equal(db.emails.length, 1)

const snapshot = JSON.parse(JSON.stringify(db)) as Database
assert.equal(
  snapshot.users.some((item) => item.email === "reuse@example.com"),
  false,
  "JSON snapshot must not keep the deleted email"
)
assert.equal(snapshot.workspaces.user_doomed, undefined)
assert.equal(
  snapshot.customers.some((row) => row.email === "reuse@example.com"),
  false
)

const emailCustomerOnly = emptyDb(
  [
    admin,
    otherAdmin,
    user({
      id: "user_orphan",
      email: "orphan@example.com",
      paddleCustomerId: "",
    }),
  ],
  {
    customers: [
      {
        customerId: "ctm_orphan",
        email: "orphan@example.com",
        createdAt: now,
        updatedAt: now,
      },
    ],
    subscriptions: [
      {
        subscriptionId: "sub_orphan",
        customerId: "ctm_orphan",
        status: "active",
        priceId: "pri_x",
        productId: "pro_x",
        scheduledChangeAction: null,
        scheduledChangeAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
)
assert.equal(purgeUserAccount(emailCustomerOnly, "user_orphan", "user_admin").ok, true)
assert.equal(emailCustomerOnly.customers.length, 0)
assert.equal(emailCustomerOnly.subscriptions.length, 0)
assert.equal(
  emailCustomerOnly.users.some((item) => item.email === "orphan@example.com"),
  false
)

console.log("ok purgeUserAccount removes the account so the email can sign up again")

async function checkJsonFallbackSignupReuse() {
  process.env.DATABASE_URL = ""
  const { readFileSync } = await import("node:fs")
  const { join } = await import("node:path")
  const { updateDb, readDb } = await import("../src/lib/db.ts")
  const stamp = Date.now()
  const email = `reuse-${stamp}@example.com`
  const actor = "user_tm_admin"
  const oldCampaignId = `camp_old_${stamp}`
  const customerId = `ctm_${stamp}`

  const created = await updateDb((next) => {
    const row = user({
      id: `user_reuse_${stamp}`,
      email,
      name: "Reuse Me",
      paddleCustomerId: customerId,
      plan: "enterprise",
      dfsLogin: "old-dfs",
      dfsPassword: "old-secret",
    })
    next.users.push(row)
    next.workspaces[row.id] = workspace({
      campaigns: [
        {
          id: oldCampaignId,
          name: "Must not survive",
          brand: "Old",
          keywords: ["old"],
          activeKeyword: "old",
          businessName: "Old Biz",
          businessCity: "Austin",
          businessState: "TX",
          placeId: "",
          mapsUrl: "",
          locationLabel: "",
          center: { lat: 30, lng: -97 },
          gridSize: 5,
          radiusMiles: 1,
          languageCode: "en",
          device: "desktop",
          schedule: "manual",
          createdAt: now,
          lastScanAt: now,
          nextScanAt: null,
        },
      ],
      settings: { login: "old-dfs", password: "old-secret" },
      activeCampaignId: oldCampaignId,
      scans: { [oldCampaignId]: { old: {} } },
    })
    next.customers.push({
      customerId,
      email,
      createdAt: now,
      updatedAt: now,
    })
    next.subscriptions.push({
      subscriptionId: `sub_${stamp}`,
      customerId,
      status: "active",
      priceId: "pri_old",
      productId: "pro_old",
      scheduledChangeAction: null,
      scheduledChangeAt: null,
      createdAt: now,
      updatedAt: now,
    })
    next.tokens.push({
      id: `tok_${stamp}`,
      userId: row.id,
      type: "reset",
      tokenHash: "reset-hash",
      expiresAt: now,
    })
    return row
  })

  const deleted = await updateDb((next) => purgeUserAccount(next, created.id, actor))
  assert.equal(deleted.ok, true)

  const afterDelete = await readDb()
  assert.equal(afterDelete.users.some((item) => item.email === email), false)
  assert.equal(afterDelete.workspaces[created.id], undefined)
  assert.equal(afterDelete.customers.some((row) => row.customerId === customerId), false)
  assert.equal(afterDelete.tokens.some((token) => token.userId === created.id), false)

  const jsonPath = join(process.cwd(), ".data", "gridpin.json")
  const stored = JSON.parse(readFileSync(jsonPath, "utf8")) as Database
  assert.equal(
    stored.users.some((item) => item.email === email),
    false,
    "JSON fallback file must drop the deleted email"
  )

  const signedUp = await updateDb((next) => {
    if (next.users.some((item) => item.email === email)) return null
    const fresh = user({
      id: `user_fresh_${stamp}`,
      email,
      name: "Brand New",
      paddleCustomerId: "",
      plan: "starter",
      extraCampaigns: 0,
      dfsLogin: "",
      dfsPassword: "",
      status: "pending",
    })
    next.users.push(fresh)
    next.workspaces[fresh.id] = {
      campaigns: [],
      settings: { login: "", password: "" },
      activeCampaignId: "",
      scans: {},
    }
    return fresh
  })
  assert.ok(signedUp, "signup must succeed with the same email after delete")
  assert.equal(signedUp.plan, "starter")
  assert.equal(signedUp.paddleCustomerId, "")
  assert.equal(signedUp.dfsLogin, "")
  assert.equal(signedUp.dfsPassword, "")
  assert.notEqual(signedUp.id, created.id)
  const freshWorkspace = (await readDb()).workspaces[signedUp.id]
  assert.ok(freshWorkspace)
  assert.equal(
    freshWorkspace.campaigns.some((campaign) => campaign.id === oldCampaignId),
    false
  )

  await updateDb((next) => purgeUserAccount(next, signedUp.id, actor))
  console.log("ok JSON fallback delete then signup reuses the email as a fresh unpaid account")
}

void checkJsonFallbackSignupReuse().catch((error) => {
  console.error(error)
  process.exit(1)
})

