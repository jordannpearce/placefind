import assert from "node:assert/strict"

import { accountIsSuspended, userHasSoftwareAccess } from "../src/lib/paddle-access.ts"
import { isAgencyAccount } from "../src/lib/agency-account.ts"
import { purgeUserAccount } from "../src/lib/purge-user.ts"
import type { Agency, PaddleCustomer, PaddleSubscription, User } from "../src/lib/types.ts"

const now = "2026-09-04T00:00:00.000Z"

function user(partial: Partial<User> & Pick<User, "id" | "email">): User {
  return {
    name: partial.name || "Agency",
    passwordHash: "hash",
    role: "user",
    status: "active",
    plan: "agency",
    extraCampaigns: 2,
    marketingOptIn: false,
    company: "Taylor Agency",
    agencyId: "agency_1",
    paddleCustomerId: "",
    createdAt: now,
    lastLoginAt: null,
    dfsLogin: "",
    dfsPassword: "",
    trialEndsAt: "2026-10-01T00:00:00.000Z",
    ...partial,
  }
}

const admin = user({
  id: "user_admin",
  email: "admin@example.com",
  role: "admin",
  plan: "enterprise",
  dfsLogin: "admin-dfs",
  dfsPassword: "admin-secret",
})
const agency = user({
  id: "user_agency",
  email: "agency@example.com",
  name: "Taylor Agency",
})

assert.equal(isAgencyAccount(agency), true)
assert.equal(isAgencyAccount(admin), false)
assert.equal(agency.dfsLogin, "")
assert.notEqual(agency.dfsLogin, admin.dfsLogin)

const customer: PaddleCustomer = {
  customerId: "ctm_agency",
  email: "agency@example.com",
  createdAt: now,
  updatedAt: now,
}
const subscription: PaddleSubscription = {
  subscriptionId: "sub_agency",
  customerId: "ctm_agency",
  status: "active",
  priceId: "pri_agency",
  productId: "pro_agency",
  scheduledChangeAction: null,
  scheduledChangeAt: null,
  createdAt: now,
  updatedAt: now,
}
const agencies: Agency[] = [
  { id: "agency_1", name: "Taylor Agency", createdAt: now },
  { id: "agency_keep", name: "Keep", createdAt: now },
]

const db = {
  users: [admin, agency],
  tokens: [],
  emails: [],
  workspaces: {
    user_agency: {
      campaigns: [],
      settings: { login: "", password: "" },
      activeCampaignId: "",
      scans: {},
    },
  },
  agencies,
  settings: { resendApiKey: "", resendFrom: "GridPins <hello@gridpins.com>", resendAudienceId: "" },
  leads: [],
  customers: [customer],
  subscriptions: [subscription],
}

assert.equal(userHasSoftwareAccess(agency, db), true)
agency.status = "suspended"
assert.equal(accountIsSuspended(agency), true)
assert.equal(userHasSoftwareAccess(agency, db), false)
agency.paddleCustomerId = "ctm_agency"
assert.equal(userHasSoftwareAccess(agency, db), false)
agency.status = "active"
assert.equal(userHasSoftwareAccess(agency, db), true)

const purged = purgeUserAccount(db, agency.id, admin.id)
assert.equal(purged.ok, true)
assert.equal(db.users.some((item) => item.email === "agency@example.com"), false)
assert.equal(db.workspaces.user_agency, undefined)
assert.equal(db.customers.some((row) => row.email === "agency@example.com"), false)
assert.equal(db.agencies.some((row) => row.id === "agency_keep"), true)
assert.equal(db.users.some((item) => item.id === admin.id), true)

console.log("ok admin agency account suspend/delete model")
