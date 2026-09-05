import assert from "node:assert/strict"

import { canReceivePaidLeads, isAgencyAccount } from "../src/lib/agency-account.ts"
import {
  applyLeadAssignment,
  applyInquiryToLead,
  applyLeadStatus,
  canViewAssignedLeads,
  costPerLeadUsd,
  createAdminLead,
  DEFAULT_COST_PER_LEAD_USD,
  isLeadStatus,
  leadAssignmentBlockedReason,
  leadFromInquiry,
  leadsForAccount,
  markLeadPaid,
  parseCostPerLeadUsd,
  publicLeadForAgency,
  removeLead,
  unassignLead,
} from "../src/lib/leads.ts"
import { isHoneypotTripped, parseGetFoundInquiry, parsePublicInquiry } from "../src/lib/public-forms.ts"
import type { User } from "../src/lib/types.ts"

const inquiry = parseGetFoundInquiry({
  name: "Jordan Lee",
  email: "owner@example.com",
  phone: "5125550100",
  businessName: "Lee Plumbing",
  city: "Austin",
  state: "TX",
  comments: "Need the south side pack.",
  website: "leeplumbing.com",
  gbpListing: "Lee Plumbing Austin",
  primaryCategory: "Plumber",
  keyword: "emergency plumber",
  locationCount: "2-5",
  hpWebsite: "",
})
assert.equal(inquiry.ok, true)
if (inquiry.ok) {
  assert.equal(inquiry.data.website, "https://leeplumbing.com")
  assert.equal(inquiry.data.gbpListing, "Lee Plumbing Austin")
  assert.equal(inquiry.data.primaryCategory, "Plumber")
  assert.equal(inquiry.data.keyword, "emergency plumber")
  assert.equal(inquiry.data.locationCount, "2-5")
}

assert.equal(isHoneypotTripped({ website: "https://leeplumbing.com", hpWebsite: "" }), false)
assert.equal(isHoneypotTripped({ website: "", hpWebsite: "http://spam.test" }), true)

const contact = parsePublicInquiry({
  name: "Jordan Lee",
  email: "owner@example.com",
  phone: "5125550100",
  businessName: "Lee Plumbing",
  city: "Austin",
  state: "Texas",
  comments: "Hello",
})
assert.equal(contact.ok, true)

const missingKeyword = parseGetFoundInquiry({
  name: "Jordan Lee",
  email: "owner@example.com",
  phone: "5125550100",
  businessName: "Lee Plumbing",
  city: "Austin",
  state: "TX",
  gbpListing: "Lee Plumbing",
  primaryCategory: "Plumber",
  keyword: "",
  locationCount: "1",
})
assert.equal(missingKeyword.ok, false)

const emptyListing = parseGetFoundInquiry({
  name: "Jordan Lee",
  email: "owner@example.com",
  phone: "5125550100",
  businessName: "Lee Plumbing",
  city: "Austin",
  state: "TX",
  website: "",
  gbpListing: "",
  primaryCategory: "Plumber",
  keyword: "emergency plumber",
  locationCount: "1",
})
assert.equal(emptyListing.ok, true)
if (emptyListing.ok) {
  assert.equal(emptyListing.data.gbpListing, "")
  assert.equal(emptyListing.data.website, "")
}

const omittedListing = parseGetFoundInquiry({
  name: "Jordan Lee",
  email: "owner@example.com",
  phone: "5125550100",
  businessName: "Lee Plumbing",
  city: "Austin",
  state: "TX",
  primaryCategory: "Plumber",
  keyword: "emergency plumber",
  locationCount: "1",
})
assert.equal(omittedListing.ok, true)
if (omittedListing.ok) {
  assert.equal(omittedListing.data.gbpListing, "")
}

assert.equal(parseCostPerLeadUsd(undefined), DEFAULT_COST_PER_LEAD_USD)
assert.equal(parseCostPerLeadUsd("75.5"), 75.5)
assert.equal(parseCostPerLeadUsd(0), 0)
assert.equal(costPerLeadUsd({ costPerLeadUsd: 40 }), 40)

function user(partial: Partial<User> & Pick<User, "id" | "email" | "plan">): User {
  return {
    name: "Agency",
    passwordHash: "hash",
    role: "user",
    status: "active",
    extraCampaigns: 0,
    extraScanCredits: 0,
    scansUsed: 0,
    scanPeriodStart: null,
    scanSessionUntil: null,
    marketingOptIn: false,
    company: "Taylor Agency",
    agencyId: "agency_1",
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

const starter = user({ id: "user_starter", email: "starter@example.com", plan: "starter" })
const pro = user({ id: "user_pro", email: "pro@example.com", plan: "agency" })
const advanced = user({ id: "user_adv", email: "adv@example.com", plan: "enterprise" })

assert.equal(isAgencyAccount(pro), true)
assert.equal(canReceivePaidLeads(starter), false)
assert.equal(canReceivePaidLeads(pro), true)
assert.equal(canReceivePaidLeads(advanced), true)
assert.match(leadAssignmentBlockedReason(starter) || "", /Starter/)
assert.equal(leadAssignmentBlockedReason(pro), null)
assert.equal(leadAssignmentBlockedReason(advanced), null)

if (!inquiry.ok) throw new Error("expected inquiry")
const lead = leadFromInquiry(inquiry.data, true)
assert.equal(lead.status, "new")
assert.equal(lead.invoiceStatus, "none")
applyInquiryToLead(lead, { ...inquiry.data, keyword: "drain cleaning" }, true)
assert.equal(lead.keyword, "drain cleaning")

applyLeadAssignment(lead, pro, 50, { ok: false, error: "Paddle 422: customer missing address" })
assert.equal(lead.assignedToUserId, pro.id)
assert.equal(lead.status, "assigned")
assert.equal(lead.invoiceStatus, "failed")
assert.equal(lead.leadPrice, 50)
assert.match(lead.invoiceError, /Paddle 422/)

applyLeadAssignment(lead, advanced, 65, {
  ok: true,
  dryRun: true,
  transactionId: "dry_lead_1",
  error: "No Paddle customer on this test agency; live invoice skipped.",
})
assert.equal(lead.assignedToUserId, advanced.id)
assert.equal(lead.status, "invoiced")
assert.equal(lead.invoiceStatus, "invoiced")
assert.equal(lead.invoiceDryRun, true)
assert.equal(lead.leadPrice, 65)

markLeadPaid(lead)
assert.equal(lead.status, "paid")
assert.equal(lead.invoiceStatus, "paid")

const adminLead = createAdminLead(inquiry.data)
assert.equal(adminLead.status, "new")
assert.equal(adminLead.audienceSynced, false)
assert.equal(adminLead.assignedToUserId, "")
assert.equal(isLeadStatus("invoiced"), true)
assert.equal(isLeadStatus("bogus"), false)

const assignedCopy = createAdminLead(inquiry.data)
applyLeadAssignment(assignedCopy, pro, 50, { ok: true, dryRun: true, transactionId: "dry_lead_edit" })
const invoiceId = assignedCopy.paddleTransactionId
applyInquiryToLead(assignedCopy, { ...inquiry.data, businessName: "Lee Plumbing West" }, false)
assert.equal(assignedCopy.businessName, "Lee Plumbing West")
assert.equal(assignedCopy.assignedToUserId, pro.id)
assert.equal(assignedCopy.paddleTransactionId, invoiceId)
assert.equal(assignedCopy.status, "invoiced")

const teammate = user({ id: "user_pro_2", email: "pro2@example.com", plan: "agency", agencyId: "agency_1" })
const outsider = user({ id: "user_other", email: "other@example.com", plan: "agency", agencyId: "agency_2" })
const roster = [starter, pro, teammate, advanced, outsider]
const inbox = leadsForAccount(pro, roster, [lead])
assert.equal(inbox.length, 1)
assert.equal(inbox[0].assignedToUserId, advanced.id)
const teammateInbox = leadsForAccount(teammate, roster, [lead])
assert.equal(teammateInbox.length, 1, "agency teammates see assigned leads")
const outsiderInbox = leadsForAccount(outsider, roster, [lead])
assert.equal(outsiderInbox.length, 0)
const card = publicLeadForAgency(lead, [advanced], advanced.id)
assert.equal(card.emailedToViewer, true)
assert.equal(card.businessName, "Lee Plumbing")
assert.equal(canViewAssignedLeads(starter, [starter], []), false)
assert.equal(canViewAssignedLeads(pro, [pro], [lead]), true)

unassignLead(assignedCopy)
assert.equal(assignedCopy.assignedToUserId, "")
assert.equal(assignedCopy.assignedAt, null)
assert.equal(assignedCopy.status, "new")
assert.equal(assignedCopy.paddleTransactionId, invoiceId)

applyLeadStatus(assignedCopy, "paid")
assert.equal(assignedCopy.status, "paid")
assert.equal(assignedCopy.invoiceStatus, "paid")

const bucket = [adminLead, assignedCopy]
assert.equal(removeLead(bucket, adminLead.id)?.id, adminLead.id)
assert.equal(bucket.length, 1)
assert.equal(removeLead(bucket, "missing"), null)

console.log("ok get-found leads model, form parse, and assignment invoice states")
