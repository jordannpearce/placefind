import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/auth-guard"
import { readDb, updateDb } from "@/lib/db"
import { leadAssignedAgencyEmail } from "@/lib/email-templates"
import { SUPPORT_FROM } from "@/lib/company"
import { invoiceAgencyForLead } from "@/lib/lead-invoice"
import {
  applyInquiryToLead,
  applyLeadAssignment,
  applyLeadStatus,
  assignableLeadAgencies,
  costPerLeadUsd,
  isLeadStatus,
  leadAssignmentBlockedReason,
  removeLead,
  unassignLead,
} from "@/lib/leads"
import { sendMail } from "@/lib/mail"
import { parseGetFoundInquiry } from "@/lib/public-forms"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const INQUIRY_KEYS = [
  "name",
  "email",
  "phone",
  "businessName",
  "city",
  "state",
  "comments",
  "website",
  "gbpListing",
  "primaryCategory",
  "keyword",
  "locationCount",
] as const

function touchesInquiry(body: Record<string, unknown>) {
  return INQUIRY_KEYS.some((key) => body[key] !== undefined)
}

export async function GET(_request: Request, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await context.params
  const db = await readDb()
  const lead = db.leads.find((item) => item.id === id)
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  const assignee = db.users.find((user) => user.id === lead.assignedToUserId)
  return NextResponse.json({
    lead,
    assignee: assignee
      ? { id: assignee.id, name: assignee.name, email: assignee.email, plan: assignee.plan }
      : null,
    agencies: assignableLeadAgencies(db.users),
    costPerLeadUsd: costPerLeadUsd(db.settings),
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await context.params
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const assignToUserId =
    typeof body.assignToUserId === "string" ? body.assignToUserId.trim() : ""
  const wantsAssign = assignToUserId.length > 0
  const wantsUnassign =
    body.unassign === true || body.assignedToUserId === "" || body.assignToUserId === ""
  const wantsInquiry = touchesInquiry(body)
  const wantsStatus = body.status !== undefined

  if (wantsInquiry) {
    const parsed = parseGetFoundInquiry(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  if (wantsStatus && !isLeadStatus(body.status)) {
    return NextResponse.json({ error: "Status must be new, assigned, invoiced, or paid." }, { status: 400 })
  }
  if (!wantsAssign && !wantsUnassign && !wantsInquiry && !wantsStatus) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
  }

  if (!wantsAssign) {
    const updated = await updateDb((db) => {
      const lead = db.leads.find((item) => item.id === id)
      if (!lead) return null
      if (wantsInquiry) {
        const parsed = parseGetFoundInquiry(body)
        if (parsed.ok) applyInquiryToLead(lead, parsed.data, lead.audienceSynced)
      }
      if (wantsUnassign) unassignLead(lead)
      if (wantsStatus && isLeadStatus(body.status)) applyLeadStatus(lead, body.status)
      return lead
    })
    if (!updated) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    const db = await readDb()
    return NextResponse.json({
      ok: true,
      lead: db.leads.find((item) => item.id === updated.id) || updated,
      agencies: assignableLeadAgencies(db.users),
      costPerLeadUsd: costPerLeadUsd(db.settings),
    })
  }

  const prepared = await updateDb(async (db) => {
    const lead = db.leads.find((item) => item.id === id)
    if (!lead) return { ok: false as const, error: "Lead not found", status: 404 as const }
    if (wantsInquiry) {
      const parsed = parseGetFoundInquiry(body)
      if (parsed.ok) applyInquiryToLead(lead, parsed.data, lead.audienceSynced)
    }
    if (lead.status === "paid") {
      return { ok: false as const, error: "This lead is already paid and cannot be reassigned.", status: 409 as const }
    }
    const user = db.users.find((item) => item.id === assignToUserId)
    const blocked = leadAssignmentBlockedReason(user)
    if (!user || blocked) {
      return { ok: false as const, error: blocked || "Agency not found", status: 400 as const }
    }
    const amount = costPerLeadUsd(db.settings)
    const invoice = await invoiceAgencyForLead(db, user, lead, amount)
    applyLeadAssignment(lead, user, amount, invoice)
    if (wantsStatus && isLeadStatus(body.status)) applyLeadStatus(lead, body.status)
    return {
      ok: true as const,
      lead,
      user,
      amount,
      invoice,
    }
  })

  if (!prepared.ok) {
    return NextResponse.json({ error: prepared.error }, { status: prepared.status })
  }

  const template = leadAssignedAgencyEmail({
    agencyName: prepared.user.name || prepared.user.company || prepared.user.email,
    amountUsd: prepared.amount,
    invoiceUrl: prepared.invoice.invoiceUrl,
    dryRun: prepared.invoice.dryRun,
    lead: prepared.lead,
  })
  try {
    await sendMail({
      to: prepared.user.email,
      from: SUPPORT_FROM,
      subject: template.subject,
      html: template.html,
      kind: "billing",
      userId: prepared.user.id,
    })
  } catch (error) {
    await updateDb((db) => {
      const lead = db.leads.find((item) => item.id === prepared.lead.id)
      if (!lead) return
      const mailError = error instanceof Error ? error.message : "Could not email the agency."
      lead.invoiceError = lead.invoiceError
        ? `${lead.invoiceError} Email failed: ${mailError}`
        : `Email failed: ${mailError}`
    })
  }

  const db = await readDb()
  const lead = db.leads.find((item) => item.id === prepared.lead.id) || prepared.lead
  return NextResponse.json({
    ok: true,
    lead,
    invoice: prepared.invoice,
    agencies: assignableLeadAgencies(db.users),
    costPerLeadUsd: costPerLeadUsd(db.settings),
  })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await context.params
  const removed = await updateDb((db) => removeLead(db.leads, id))
  if (!removed) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  return NextResponse.json({ ok: true, id: removed.id })
}
