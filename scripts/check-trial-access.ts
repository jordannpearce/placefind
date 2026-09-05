import assert from "node:assert/strict"

import {
  billingPathForUser,
  computeTrialEndsAt,
  hasComplimentarySoftwareAccess,
  parseTrialEndsAt,
  trialStillOpen,
  userHasSoftwareAccess,
} from "../src/lib/paddle-access.ts"
import type { PaddleSubscription, User } from "../src/lib/types.ts"

const now = "2026-09-04T00:00:00.000Z"

function user(partial: Partial<User>): User {
  return {
    id: "user_1",
    name: "Test",
    email: "unpaid@example.com",
    passwordHash: "x",
    role: "user",
    status: "active",
    plan: "starter",
    extraCampaigns: 0,
    extraScanCredits: 0,
    scansUsed: 0,
    scanPeriodStart: null,
    scanSessionUntil: null,
    marketingOptIn: false,
    company: "",
    agencyId: "",
    paddleCustomerId: "",
    createdAt: now,
    lastLoginAt: null,
    dfsLogin: "",
    dfsPassword: "",
    trialEndsAt: null,
    ...partial,
  }
}

function sub(partial: Partial<PaddleSubscription>): PaddleSubscription {
  return {
    subscriptionId: "sub_1",
    customerId: "ctm_1",
    status: "active",
    priceId: "pri_1",
    productId: "pro_1",
    scheduledChangeAction: null,
    scheduledChangeAt: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

const emptyMirror = { customers: [], subscriptions: [] }

assert.equal(computeTrialEndsAt(0, "days"), null)
assert.equal(computeTrialEndsAt(-1, "hours"), null)
assert.equal(parseTrialEndsAt(""), null)
assert.equal(parseTrialEndsAt("not-a-date"), null)

const from = new Date("2026-09-04T12:00:00.000Z")
assert.equal(computeTrialEndsAt(2, "hours", from), "2026-09-04T14:00:00.000Z")
assert.equal(computeTrialEndsAt(1, "days", from), "2026-09-05T12:00:00.000Z")

assert.equal(trialStillOpen({ trialEndsAt: computeTrialEndsAt(4, "hours", from) }, from.getTime()), true)

const testers = user({
  email: "tester@example.com",
  trialEndsAt: computeTrialEndsAt(4, "hours"),
})
assert.equal(trialStillOpen(testers), true)
assert.equal(userHasSoftwareAccess(testers, emptyMirror), true)
assert.equal(hasComplimentarySoftwareAccess(testers), true)
assert.equal(billingPathForUser(testers, emptyMirror), "/dashboard")

const expired = user({
  email: "expired@example.com",
  trialEndsAt: "2026-09-01T00:00:00.000Z",
})
assert.equal(trialStillOpen(expired, from.getTime()), false)
assert.equal(userHasSoftwareAccess(expired, emptyMirror), false)
assert.equal(billingPathForUser(expired, emptyMirror), "/pricing?billing=required")

const selfServe = user({ email: "signup@example.com", trialEndsAt: null })
assert.equal(userHasSoftwareAccess(selfServe, emptyMirror), false)
assert.equal(billingPathForUser(selfServe, emptyMirror), "/pricing?billing=required")

const paidExpiredTrial = user({
  email: "paid@example.com",
  paddleCustomerId: "ctm_1",
  trialEndsAt: "2020-01-01T00:00:00.000Z",
})
const paidMirror = {
  customers: [{ customerId: "ctm_1", email: "paid@example.com" }],
  subscriptions: [sub({ status: "active" })],
}
assert.equal(userHasSoftwareAccess(paidExpiredTrial, paidMirror), true)

const formerDemo = user({ id: "user_demo", email: "demo@gridpin.app", plan: "enterprise" })
assert.equal(userHasSoftwareAccess(formerDemo, emptyMirror), false)
assert.equal(hasComplimentarySoftwareAccess(formerDemo), false)

const admin = user({ role: "admin", email: "admin@example.com" })
assert.equal(userHasSoftwareAccess(admin, emptyMirror), true)

const suspendedTrial = user({
  email: "agency-trial@example.com",
  plan: "agency",
  status: "suspended",
  trialEndsAt: computeTrialEndsAt(7, "days"),
})
assert.equal(userHasSoftwareAccess(suspendedTrial, emptyMirror), false)
assert.equal(hasComplimentarySoftwareAccess(suspendedTrial), false)
assert.equal(billingPathForUser(suspendedTrial, emptyMirror), "/pricing?billing=required")

const suspendedPaid = user({
  email: "agency-paid@example.com",
  plan: "agency",
  status: "suspended",
  paddleCustomerId: "ctm_1",
})
assert.equal(userHasSoftwareAccess(suspendedPaid, paidMirror), false)
assert.equal(billingPathForUser(suspendedPaid, paidMirror), "/account?billing=required")

const suspendedAdmin = user({
  role: "admin",
  status: "suspended",
  email: "admin-suspended@example.com",
})
assert.equal(userHasSoftwareAccess(suspendedAdmin, emptyMirror), true)

console.log("trial access checks passed")
