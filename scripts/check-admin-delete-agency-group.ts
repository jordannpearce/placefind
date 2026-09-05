import assert from "node:assert/strict"

import { isAgencyAccount } from "../src/lib/agency-account.ts"
import {
  deleteAgencyGroup,
  deleteLeftoverDemoAgencyGroups,
  isLeftoverDemoAgencyAccount,
  isLeftoverDemoAgencyGroupName,
} from "../src/lib/agency-group.ts"
import type { Agency, PaddleCustomer, PaddleSubscription, User, UserWorkspace } from "../src/lib/types.ts"

const now = "2026-09-05T00:00:00.000Z"

function user(partial: Partial<User> & Pick<User, "id" | "email">): User {
  return {
    name: partial.name || "Member",
    passwordHash: "hash",
    role: "user",
    status: "active",
    plan: "starter",
    extraCampaigns: 0,
    extraScanCredits: 0,
    scansUsed: 0,
    scanPeriodStart: null,
    scanSessionUntil: null,
    marketingOptIn: false,
    company: "Keep Co",
    agencyId: "agency_gridpins",
    paddleCustomerId: "",
    createdAt: now,
    lastLoginAt: null,
    dfsLogin: "",
    dfsPassword: "",
    trialEndsAt: null,
    ...partial,
  }
}

function workspace(): UserWorkspace {
  return {
    campaigns: [],
    settings: { login: "", password: "" },
    activeCampaignId: "",
    scans: {},
  }
}

const admin = user({
  id: "user_tm_admin",
  email: "tmrapp1995@gmail.com",
  name: "TM",
  role: "admin",
  plan: "enterprise",
  company: "GridPins",
  agencyId: "agency_gridpins",
})
const member = user({
  id: "user_billing",
  email: "billing-active@example.com",
  name: "Active Billing",
  plan: "agency",
  company: "Billing Test",
  agencyId: "agency_gridpins",
  paddleCustomerId: "ctm_keep",
})
const leftoverOwner = user({
  id: "user_taylor",
  email: "taylor-agency@example.com",
  name: "Taylor Agency",
  plan: "agency",
  company: "Taylor Agency",
  agencyId: "agency_taylor",
  paddleCustomerId: "ctm_taylor",
})
const keep = user({
  id: "user_keep",
  email: "keep@example.com",
  name: "Keep Me",
  plan: "starter",
  company: "Keep Co",
  agencyId: "agency_keep",
})

const keepCustomer: PaddleCustomer = {
  customerId: "ctm_keep",
  email: "billing-active@example.com",
  createdAt: now,
  updatedAt: now,
}
const taylorCustomer: PaddleCustomer = {
  customerId: "ctm_taylor",
  email: "taylor-agency@example.com",
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
const taylorSub: PaddleSubscription = {
  subscriptionId: "sub_taylor",
  customerId: "ctm_taylor",
  status: "canceled",
  priceId: "pri_old",
  productId: "pro_old",
  scheduledChangeAction: null,
  scheduledChangeAt: null,
  createdAt: now,
  updatedAt: now,
}

const agencies: Agency[] = [
  { id: "agency_gridpins", name: "GridPins", createdAt: now },
  { id: "agency_taylor", name: "Taylor Agency", createdAt: now },
  { id: "agency_keep", name: "Keep Co", createdAt: now },
]

assert.equal(isLeftoverDemoAgencyGroupName("gridpin"), true)
assert.equal(isLeftoverDemoAgencyGroupName("GridPins"), true)
assert.equal(isLeftoverDemoAgencyGroupName("Taylor Agency"), true)
assert.equal(isLeftoverDemoAgencyGroupName("Keep Co"), false)
assert.equal(isLeftoverDemoAgencyAccount(leftoverOwner), true)
assert.equal(isLeftoverDemoAgencyAccount(member), false)
assert.equal(isLeftoverDemoAgencyAccount(admin), false)
assert.equal(isAgencyAccount(member), true)

const db = {
  users: [admin, member, leftoverOwner, keep],
  tokens: [
    { id: "tok_taylor", userId: leftoverOwner.id, type: "reset" as const, tokenHash: "x", expiresAt: now },
  ],
  emails: [],
  workspaces: {
    [admin.id]: workspace(),
    [member.id]: workspace(),
    [leftoverOwner.id]: workspace(),
    [keep.id]: workspace(),
  },
  agencies,
  settings: { resendApiKey: "", resendFrom: "GridPins <hello@gridpins.com>", resendAudienceId: "" },
  leads: [],
  customers: [keepCustomer, taylorCustomer],
  subscriptions: [keepSub, taylorSub],
}

const missing = deleteAgencyGroup(db, "agency_nobody", admin.id)
assert.equal(missing.ok, false)
if (!missing.ok) assert.equal(missing.status, 404)

const gridpins = deleteAgencyGroup(db, "agency_gridpins", admin.id)
assert.equal(gridpins.ok, true)
if (gridpins.ok) {
  assert.equal(gridpins.name, "GridPins")
  assert.ok(gridpins.unassignedUserIds.includes(admin.id))
  assert.ok(gridpins.unassignedUserIds.includes(member.id))
  assert.equal(gridpins.purgedUsers.length, 0)
}
assert.equal(db.agencies.some((item) => item.id === "agency_gridpins"), false)
assert.equal(db.users.find((item) => item.id === admin.id)?.agencyId, "")
assert.equal(db.users.find((item) => item.id === member.id)?.agencyId, "")
assert.equal(db.users.some((item) => item.id === member.id), true)
assert.equal(db.customers.some((row) => row.customerId === "ctm_keep"), true)

const leftover = deleteLeftoverDemoAgencyGroups(db, admin.id)
assert.equal(
  leftover.deletedGroups.some((item) => item.ok && item.name === "Taylor Agency"),
  true
)
assert.equal(db.agencies.some((item) => /taylor agency/i.test(item.name)), false)
assert.equal(db.users.some((item) => item.email === "taylor-agency@example.com"), false)
assert.equal(db.workspaces[leftoverOwner.id], undefined)
assert.equal(db.customers.some((row) => row.customerId === "ctm_taylor"), false)
assert.equal(db.subscriptions.some((row) => row.customerId === "ctm_taylor"), false)
assert.equal(db.users.some((item) => item.email === "tmrapp1995@gmail.com"), true)
assert.equal(db.agencies.some((item) => item.id === "agency_keep"), true)
assert.equal(db.users.some((item) => item.id === keep.id), true)

const gridpinAlias = {
  users: [
    user({
      id: "user_gridpin_owner",
      email: "gridpin-owner@example.com",
      name: "GridPin",
      plan: "agency",
      company: "GridPin",
      agencyId: "agency_gridpin",
      paddleCustomerId: "ctm_gridpin",
    }),
    admin,
  ],
  tokens: [],
  workspaces: { user_gridpin_owner: workspace() },
  agencies: [{ id: "agency_gridpin", name: "GridPin", createdAt: now }],
  customers: [
    {
      customerId: "ctm_gridpin",
      email: "gridpin-owner@example.com",
      createdAt: now,
      updatedAt: now,
    },
  ],
  subscriptions: [],
}
const purgedAlias = deleteAgencyGroup(gridpinAlias, "agency_gridpin", admin.id)
assert.equal(purgedAlias.ok, true)
if (purgedAlias.ok) {
  assert.equal(purgedAlias.purgedUsers[0]?.email, "gridpin-owner@example.com")
}
assert.equal(gridpinAlias.users.some((item) => item.email === "gridpin-owner@example.com"), false)
assert.equal(gridpinAlias.users.some((item) => item.id === admin.id), true)

console.log("ok deleteAgencyGroup unassigns members and purges leftover demo agency accounts")
