import assert from "node:assert/strict"

import {
  billingPathForUser,
  hasComplimentarySoftwareAccess,
  isDemoAccount,
  pickAccessSubscription,
  postLoginPath,
  subscriptionGrantsAccess,
  subscriptionRevokesAccess,
  userHasSoftwareAccess,
} from "../src/lib/paddle-access.ts"
import { usableCampaignLimit } from "../src/lib/plans.ts"
import type { PaddleSubscription, User } from "../src/lib/types.ts"

const now = "2026-09-04T00:00:00.000Z"

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
    marketingOptIn: false,
    company: "",
    agencyId: "",
    paddleCustomerId: "",
    createdAt: now,
    lastLoginAt: null,
    dfsLogin: "",
    dfsPassword: "",
    ...partial,
  }
}

assert.equal(subscriptionGrantsAccess(sub({ status: "active" })), true)
assert.equal(subscriptionGrantsAccess(sub({ status: "trialing" })), false)
assert.equal(subscriptionGrantsAccess(sub({ status: "past_due" })), false)
assert.equal(subscriptionGrantsAccess(sub({ status: "canceled" })), false)
assert.equal(subscriptionGrantsAccess(sub({ status: "paused" })), false)
assert.equal(subscriptionGrantsAccess(null), false)
assert.equal(subscriptionRevokesAccess(sub({ status: "canceled" })), true)
assert.equal(subscriptionRevokesAccess(sub({ status: "expired" })), true)
assert.equal(subscriptionRevokesAccess(sub({ status: "past_due" })), false)

const scheduledCancel = sub({
  status: "active",
  scheduledChangeAction: "cancel",
  scheduledChangeAt: "2026-10-01T00:00:00.000Z",
})
assert.equal(subscriptionGrantsAccess(scheduledCancel), true)
assert.equal(pickAccessSubscription([scheduledCancel])?.status, "active")

const unpaid = user({})
const emptyMirror = { customers: [], subscriptions: [] }
assert.equal(userHasSoftwareAccess(unpaid, emptyMirror), false)
assert.equal(billingPathForUser(unpaid, emptyMirror), "/pricing?billing=required")

const canceledUser = user({
  email: "canceled@example.com",
  paddleCustomerId: "ctm_1",
})
const canceledMirror = {
  customers: [{ customerId: "ctm_1", email: "canceled@example.com" }],
  subscriptions: [sub({ status: "canceled" })],
}
assert.equal(userHasSoftwareAccess(canceledUser, canceledMirror), false)
assert.equal(billingPathForUser(canceledUser, canceledMirror), "/account?billing=required")

const paidUser = user({
  email: "paid@example.com",
  paddleCustomerId: "ctm_2",
  plan: "agency",
})
const paidMirror = {
  customers: [{ customerId: "ctm_2", email: "paid@example.com" }],
  subscriptions: [sub({ customerId: "ctm_2", status: "active" })],
}
assert.equal(userHasSoftwareAccess(paidUser, paidMirror), true)

const demo = user({ id: "user_demo", email: "demo@gridpin.app", plan: "enterprise" })
assert.equal(isDemoAccount(demo), true)
assert.equal(userHasSoftwareAccess(demo, emptyMirror), true)

const admin = user({ email: "tmrapp1995@gmail.com", role: "admin" })
assert.equal(hasComplimentarySoftwareAccess(admin), true)
assert.equal(userHasSoftwareAccess(admin, emptyMirror), true)

assert.equal(
  postLoginPath({ next: "/dashboard", current: false, role: "user", billingPath: "/pricing?billing=required" }),
  "/pricing?billing=required"
)
assert.equal(
  postLoginPath({ next: "/account", current: false, role: "user", billingPath: "/pricing?billing=required" }),
  "/account"
)
assert.equal(postLoginPath({ next: null, current: true, role: "admin", billingPath: "/pricing" }), "/admin")
assert.equal(usableCampaignLimit("starter", 0, false), 0)
assert.equal(usableCampaignLimit("starter", 0, true), 1)

console.log("billing access checks passed")
