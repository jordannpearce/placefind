import assert from "node:assert/strict"

import {
  brandAssignmentTargets,
  grantComplimentaryBrand,
  isBrandAssignableAccount,
  listAssignedBrands,
  parseBrandForm,
  removeAssignedBrand,
  removeComplimentaryBrand,
  updateAssignedBrandProfile,
  userHasMatchingBrand,
} from "../src/lib/ai-visibility.ts"
import { pickAccessSubscription } from "../src/lib/paddle-access.ts"
import type { PaddleSubscription, PlanId, User } from "../src/lib/types.ts"

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
  street: "400 Oak St",
  city: "Austin",
  state: "TX",
  zip: "78701",
  phone: "5125550199",
  website: "https://oakstreet.example",
  competitors: "Smile Co",
})

const unpaidStarter = user({
  id: "user_starter_unpaid",
  email: "starter@example.com",
  name: "Lee",
  company: "Lee HVAC",
  plan: "starter",
  trialEndsAt: null,
  paddleCustomerId: "",
})
const suspendedStarter = user({
  id: "user_starter_suspended",
  email: "paused@example.com",
  plan: "starter",
  status: "suspended",
})
const pendingStarter = user({
  id: "user_starter_pending",
  email: "pending@example.com",
  plan: "starter",
  status: "pending",
})
const pendingMember = user({
  id: "user_4",
  email: "pending-member@example.com",
  plan: "starter",
  status: "pending",
  agencyId: "agency_1",
})

assert.equal(isBrandAssignableAccount(unpaidStarter), true)
assert.equal(isBrandAssignableAccount(suspendedStarter), true)
assert.equal(isBrandAssignableAccount(pendingStarter), false)
assert.equal(isBrandAssignableAccount(admin), false)

const userTarget = brandAssignmentTargets([owner, agencyUser, teammate, admin], agencies, { userId: owner.id })
assert.equal(userTarget.ok, true)
if (userTarget.ok) {
  assert.equal(userTarget.users[0]?.id, owner.id)
  assert.equal(userTarget.users[0]?.plan, "starter")
}

const starterTarget = brandAssignmentTargets([unpaidStarter], agencies, { userId: unpaidStarter.id })
assert.equal(starterTarget.ok, true)
if (starterTarget.ok) {
  assert.equal(starterTarget.users[0]?.plan, "starter")
  assert.equal(starterTarget.users[0]?.trialEndsAt, null)
}

const suspendedTarget = brandAssignmentTargets([suspendedStarter], agencies, { userId: suspendedStarter.id })
assert.equal(suspendedTarget.ok, true)

const pendingTarget = brandAssignmentTargets([pendingStarter], agencies, { userId: pendingStarter.id })
assert.equal(pendingTarget.ok, false)

const adminTarget = brandAssignmentTargets([owner, admin], agencies, { userId: admin.id })
assert.equal(adminTarget.ok, false)

const agencyTarget = brandAssignmentTargets(
  [owner, agencyUser, teammate, pendingMember, admin],
  agencies,
  { agencyId: "agency_1" }
)
assert.equal(agencyTarget.ok, true)
if (agencyTarget.ok) {
  assert.equal(agencyTarget.users.length, 2)
  assert.deepEqual(
    agencyTarget.users.map((item) => item.id).sort(),
    ["user_2", "user_3"]
  )
  assert.equal(agencyTarget.users.some((item) => item.plan === "starter"), true)
  assert.equal(agencyTarget.users.some((item) => item.status === "pending"), false)
  assert.equal(agencyTarget.users.some((item) => item.role === "admin"), false)
}

const both = brandAssignmentTargets([owner], agencies, { userId: owner.id, agencyId: "agency_1" })
assert.equal(both.ok, false)

const created = grantComplimentaryBrand(owner, parsed)
assert(created)
assert.equal(created.subscriptionId, "complimentary")
assert.equal(created.street, "400 Oak St")
assert.equal(created.city, "Austin")
assert.equal(created.state, "TX")
assert.equal(created.address, "400 Oak St, Austin, TX 78701")
assert.equal(created.location, "Austin,Texas,United States")
assert.equal(owner.aiBrands.length, 1)
assert.equal(userHasMatchingBrand(owner, parsed), true)

const listed = listAssignedBrands([owner, agencyUser], agencies)
assert.equal(listed.length, 1)
assert.equal(listed[0]?.ownerEmail, "owner@example.com")
assert.equal(listed[0]?.complimentary, true)

const paid = grantComplimentaryBrand(agencyUser, parsed)
assert(paid)
paid.subscriptionId = "sub_paid_keep"
const edited = updateAssignedBrandProfile(agencyUser, paid.id, {
  ...parseBrandForm({
    name: "Oak Street Dental North",
    street: "88 Congress Ave",
    city: "Houston",
    state: "TX",
    zip: "77002",
    phone: "7135550100",
    website: "https://oakstreet.example",
    competitors: "Smile Co",
  }),
  lat: 29.76,
  lng: -95.37,
  location: "Houston,Texas,United States",
})
assert(edited)
assert.equal(edited.subscriptionId, "sub_paid_keep", "admin edit must not change billing")
assert.equal(edited.city, "Houston")
assert.equal(edited.location, "Houston,Texas,United States")
assert.equal(updateAssignedBrandProfile(agencyUser, "missing", parsed), null)

agencyUser.aiScans = [
  {
    id: "scan_paid",
    brandId: paid.id,
    brandName: edited.name,
    promptId: "p1",
    prompt: "best dentist",
    country: "United States",
    location: edited.location,
    createdAt: "2026-09-05T00:00:00.000Z",
    mode: "live",
    models: [],
  },
]
assert.equal(removeComplimentaryBrand(agencyUser, paid.id), null, "paid brands stay until admin deletes any")
assert.equal(agencyUser.aiBrands.length, 1)
assert(removeAssignedBrand(agencyUser, paid.id))
assert.equal(agencyUser.aiBrands.length, 0)
assert.equal(agencyUser.aiScans.length, 0)
assert.equal(removeAssignedBrand(agencyUser, paid.id), null)

assert(removeComplimentaryBrand(owner, created.id))
assert.equal(owner.aiBrands.length, 0)
assert.equal(removeComplimentaryBrand(owner, created.id), null)

const starterGrant = grantComplimentaryBrand(unpaidStarter, parsed)
assert(starterGrant)
assert.equal(unpaidStarter.plan, "starter")
assert.equal(starterGrant.subscriptionId, "complimentary")
assert.equal(unpaidStarter.aiBrands.length, 1)

const proMember = user({
  id: "dup_pro",
  email: "dup-pro@example.com",
  plan: "agency",
  agencyId: "agency_dup",
})
const starterMember = user({
  id: "dup_starter",
  email: "dup-starter@example.com",
  plan: "starter",
  agencyId: "agency_dup",
})
assert(grantComplimentaryBrand(proMember, parsed))
const dupAgency = brandAssignmentTargets(
  [proMember, starterMember],
  [{ id: "agency_dup", name: "Dup Agency" }],
  { agencyId: "agency_dup" }
)
assert.equal(dupAgency.ok, true)
if (dupAgency.ok) {
  const granted: string[] = []
  const skipped: string[] = []
  for (const member of dupAgency.users) {
    if (userHasMatchingBrand(member, parsed)) {
      skipped.push(member.id)
      continue
    }
    const next = grantComplimentaryBrand(member, parsed)
    if (next) granted.push(member.id)
  }
  assert.deepEqual(skipped, ["dup_pro"])
  assert.deepEqual(granted, ["dup_starter"])
  assert.equal(starterMember.aiBrands.length, 1)
}

const aiOnlySub: PaddleSubscription = {
  subscriptionId: "sub_ai_only",
  customerId: "ctm_ai",
  status: "active",
  priceId: "pri_ai",
  productId: "pro_ai",
  kind: "ai_visibility",
  scheduledChangeAction: null,
  scheduledChangeAt: null,
  createdAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z",
}
assert.equal(
  pickAccessSubscription([aiOnlySub]),
  null,
  "pickAccessSubscription must ignore kind === ai_visibility"
)

const promoPlans: PlanId[] = ["starter", "agency", "enterprise"]
for (const plan of promoPlans) {
  const target = user({
    id: `user_promo_${plan}`,
    email: `promo-${plan}@example.com`,
    name: `${plan} promo`,
    company: `${plan} shop`,
    plan,
    trialEndsAt: null,
    paddleCustomerId: "",
    aiBrands: [],
  })
  assert.equal(isBrandAssignableAccount(target), true)
  const assigned = brandAssignmentTargets([target, admin], agencies, { userId: target.id })
  assert.equal(assigned.ok, true, `${plan} without an AI subscription must be assignable`)
  const promo = parseBrandForm({
    name: `Promo ${plan} Cafe`,
    street: "100 Congress Ave",
    city: "Austin",
    state: "TX",
    zip: "78701",
    phone: "5125550100",
    website: `https://promo-${plan}.example`,
    competitors: "Rival Cafe",
  })
  const granted = grantComplimentaryBrand(target, promo)
  assert(granted)
  assert.equal(granted.subscriptionId, "complimentary")
  assert.equal(target.aiBrands[0]?.subscriptionId, "complimentary")
}

const trialUser = user({
  id: "user_trial_promo",
  email: "trial-promo@example.com",
  plan: "starter",
  trialEndsAt: "2026-12-01T00:00:00.000Z",
  paddleCustomerId: "",
  aiBrands: [],
})
assert.equal(brandAssignmentTargets([trialUser], agencies, { userId: trialUser.id }).ok, true)
const trialGrant = grantComplimentaryBrand(
  trialUser,
  parseBrandForm({
    name: "Trial Promo Bakery",
    city: "Austin",
    state: "TX",
    website: "https://trial-promo.example",
  })
)
assert(trialGrant)
assert.equal(trialGrant.subscriptionId, "complimentary")

assert.equal(teammate.plan, "starter")
const agencyMemberGrant = grantComplimentaryBrand(
  teammate,
  parseBrandForm({
    name: "Agency Member Promo",
    city: "Austin",
    state: "TX",
    website: "https://agency-member-promo.example",
  })
)
assert(agencyMemberGrant)
assert.equal(agencyMemberGrant.subscriptionId, "complimentary")

console.log("admin ai brand assignment ok")
