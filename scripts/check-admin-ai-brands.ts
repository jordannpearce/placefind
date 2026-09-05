import assert from "node:assert/strict"

import {
  brandAssignmentTargets,
  grantComplimentaryBrand,
  listAssignedBrands,
  parseBrandForm,
  removeComplimentaryBrand,
  userHasMatchingBrand,
} from "../src/lib/ai-visibility.ts"
import type { User } from "../src/lib/types.ts"

function user(partial: Partial<User> & Pick<User, "id" | "email">): User {
  return {
    name: "Account",
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
    company: "",
    agencyId: "",
    paddleCustomerId: "",
    createdAt: "2026-09-05T00:00:00.000Z",
    lastLoginAt: null,
    dfsLogin: "",
    dfsPassword: "",
    trialEndsAt: null,
    aiBrands: [],
    aiScans: [],
    ...partial,
  }
}

const owner = user({ id: "user_1", email: "owner@example.com", name: "Pat", company: "Pat SEO", plan: "starter" })
const agencyUser = user({
  id: "user_2",
  email: "agency@example.com",
  name: "Alex",
  company: "North Agency",
  plan: "agency",
  agencyId: "agency_1",
})
const teammate = user({
  id: "user_3",
  email: "teammate@example.com",
  name: "Sam",
  company: "North Agency",
  plan: "starter",
  agencyId: "agency_1",
})
const admin = user({ id: "user_admin", email: "admin@example.com", role: "admin", plan: "enterprise" })
const agencies = [{ id: "agency_1", name: "North Agency" }]

const parsed = parseBrandForm({
  name: "Oak Street Dental",
  address: "400 Oak St, Austin, TX",
  phone: "5125550199",
  website: "https://oakstreet.example",
  competitors: "Smile Co",
})

const userTarget = brandAssignmentTargets([owner, agencyUser, teammate, admin], agencies, { userId: owner.id })
assert.equal(userTarget.ok, true)
if (userTarget.ok) assert.equal(userTarget.users[0]?.id, owner.id)

const adminTarget = brandAssignmentTargets([owner, admin], agencies, { userId: admin.id })
assert.equal(adminTarget.ok, false)

const agencyTarget = brandAssignmentTargets([owner, agencyUser, teammate, admin], agencies, {
  agencyId: "agency_1",
})
assert.equal(agencyTarget.ok, true)
if (agencyTarget.ok) {
  assert.equal(agencyTarget.users.length, 2)
  assert.deepEqual(
    agencyTarget.users.map((item) => item.id).sort(),
    ["user_2", "user_3"]
  )
}

const both = brandAssignmentTargets([owner], agencies, { userId: owner.id, agencyId: "agency_1" })
assert.equal(both.ok, false)

const created = grantComplimentaryBrand(owner, parsed)
assert(created)
assert.equal(created.subscriptionId, "complimentary")
assert.equal(created.address, "400 Oak St, Austin, TX")
assert.equal(owner.aiBrands.length, 1)
assert.equal(userHasMatchingBrand(owner, parsed), true)

const listed = listAssignedBrands([owner, agencyUser], agencies)
assert.equal(listed.length, 1)
assert.equal(listed[0]?.ownerEmail, "owner@example.com")
assert.equal(listed[0]?.complimentary, true)

assert(removeComplimentaryBrand(owner, created.id))
assert.equal(owner.aiBrands.length, 0)
assert.equal(removeComplimentaryBrand(owner, created.id), null)

console.log("admin ai brand assignment ok")
