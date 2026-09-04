import assert from "node:assert/strict"

import { purgeUserAccount, type Database } from "../src/lib/db.ts"
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
    marketingOptIn: true,
    company: "Acme",
    agencyId: "agency_1",
    paddleCustomerId: "",
    createdAt: now,
    lastLoginAt: now,
    dfsLogin: "old-dfs",
    dfsPassword: "old-secret",
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
