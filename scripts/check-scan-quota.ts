import assert from "node:assert/strict"

import {
  EXTRA_SCAN_PRICE,
  STARTER_INCLUDED_SCANS,
} from "../src/lib/plans.ts"
import {
  consumeScanCredit,
  SCAN_QUOTA_EXHAUSTED,
  scanQuotaForRole,
  scanQuotaSnapshot,
  starterSafeMessage,
  usesHostedMaps,
} from "../src/lib/scan-quota.ts"
import type { User } from "../src/lib/types.ts"

function user(partial: Partial<User> = {}): User {
  return {
    id: "user_1",
    name: "Test",
    email: "starter@example.com",
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
    createdAt: "2026-09-01T00:00:00.000Z",
    lastLoginAt: null,
    dfsLogin: "",
    dfsPassword: "",
    trialEndsAt: null,
    ...partial,
  }
}

assert.equal(STARTER_INCLUDED_SCANS, 5)
assert.equal(EXTRA_SCAN_PRICE, 5)

assert.equal(usesHostedMaps({ role: "user", plan: "starter" }), true)
assert.equal(usesHostedMaps({ role: "user", plan: "agency" }), false)
assert.equal(usesHostedMaps({ role: "user", plan: "enterprise" }), false)
assert.equal(usesHostedMaps({ role: "admin", plan: "starter" }), false)
assert.equal(usesHostedMaps({ role: "admin", plan: "enterprise" }), false)

const starterSnap = scanQuotaForRole("user", "starter")
assert.equal(starterSnap.applies, true)
assert.equal(starterSnap.included, 5)
assert.equal(starterSnap.used, 0)
assert.equal(starterSnap.remaining, 5)

const proSnap = scanQuotaForRole("user", "agency")
assert.equal(proSnap.applies, false)
assert.equal(proSnap.remaining, null)

const adminSnap = scanQuotaForRole("admin", "starter")
assert.equal(adminSnap.applies, false)
assert.equal(adminSnap.remaining, null)

const starter = user()
const now = new Date("2026-09-05T12:00:00.000Z")
for (let i = 1; i <= STARTER_INCLUDED_SCANS; i += 1) {
  const consumed = consumeScanCredit(starter, now)
  assert.equal(consumed.ok, true)
  assert.equal(consumed.quota.used, i)
  assert.equal(consumed.quota.remaining, STARTER_INCLUDED_SCANS - i)
  assert.equal(starter.scansUsed, i)
  assert.equal(starter.extraScanCredits, 0)
}

const sixth = consumeScanCredit(starter, now)
assert.equal(sixth.ok, false)
if (!sixth.ok) {
  assert.equal(sixth.error, SCAN_QUOTA_EXHAUSTED)
  assert.equal(sixth.quota.remaining, 0)
}
assert.equal(starter.scansUsed, 5)
assert.equal(starter.scanSessionUntil, null)

starter.extraScanCredits = 2
const extraOne = consumeScanCredit(starter, now)
assert.equal(extraOne.ok, true)
assert.equal(starter.scansUsed, 5)
assert.equal(starter.extraScanCredits, 1)
assert.equal(extraOne.quota.remaining, 1)

const extraTwo = consumeScanCredit(starter, now)
assert.equal(extraTwo.ok, true)
assert.equal(starter.extraScanCredits, 0)
assert.equal(extraTwo.quota.remaining, 0)

const extraGone = consumeScanCredit(starter, now)
assert.equal(extraGone.ok, false)

const resetUser = user({
  scansUsed: 5,
  extraScanCredits: 0,
  scanPeriodStart: "2026-08-01T00:00:00.000Z",
})
const nextMonth = consumeScanCredit(resetUser, new Date("2026-09-01T00:00:00.000Z"))
assert.equal(nextMonth.ok, true)
assert.equal(resetUser.scansUsed, 1)
assert.equal(resetUser.scanPeriodStart, "2026-09-01T00:00:00.000Z")
assert.equal(nextMonth.quota.remaining, 4)

const admin = user({ role: "admin", plan: "starter", scansUsed: 99 })
const adminConsume = consumeScanCredit(admin, now)
assert.equal(adminConsume.ok, true)
assert.equal(adminConsume.quota.applies, false)
assert.equal(adminConsume.quota.remaining, null)
assert.equal(admin.scansUsed, 99)

const pro = user({ plan: "agency", extraScanCredits: 3 })
assert.equal(usesHostedMaps(pro), false)
const proConsume = consumeScanCredit(pro, now)
assert.equal(proConsume.ok, true)
assert.equal(proConsume.quota.applies, false)
assert.equal(pro.extraScanCredits, 3)

const enterprise = user({ plan: "enterprise" })
assert.equal(usesHostedMaps(enterprise), false)
assert.equal(consumeScanCredit(enterprise, now).ok, true)

assert.equal(
  starterSafeMessage("DataForSEO 40102: No Search Results"),
  "This pin could not be scanned. Try again."
)
assert.equal(starterSafeMessage("No listings at this pin."), "No listings at this pin.")

console.log("scan quota checks passed")
