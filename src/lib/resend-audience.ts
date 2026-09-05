import { Resend } from "resend"

import { readDb, updateDb } from "./db"
import { applyInquiryToLead, leadFromInquiry } from "./leads"
import { resolveResendConfig } from "./mail"
import { splitName, type GetFoundInquiry, type PublicInquiry } from "./public-forms"

const AUDIENCE_NAME = "GridPins marketing"

async function storedAudienceId() {
  const db = await readDb()
  return db.settings.resendAudienceId.trim() || process.env.RESEND_AUDIENCE_ID?.trim() || ""
}

async function persistAudienceId(id: string) {
  await updateDb((db) => {
    db.settings.resendAudienceId = id
  })
}

export async function resolveMarketingAudienceId(resend: Resend): Promise<string> {
  const existing = await storedAudienceId()
  if (existing) return existing

  const created = await resend.audiences.create({ name: AUDIENCE_NAME })
  if (created.error || !created.data?.id) {
    throw new Error(created.error?.message || "Could not create a marketing audience.")
  }
  await persistAudienceId(created.data.id)
  return created.data.id
}

export async function upsertMarketingContact(inquiry: PublicInquiry): Promise<{ synced: boolean; error?: string }> {
  const { apiKey } = await resolveResendConfig()
  if (!apiKey) return { synced: false, error: "MAIL_NOT_CONFIGURED" }

  const resend = new Resend(apiKey)
  const { firstName, lastName } = splitName(inquiry.name)

  try {
    const audienceId = await resolveMarketingAudienceId(resend)
    const created = await resend.contacts.create({
      audienceId,
      email: inquiry.email,
      firstName,
      lastName,
      unsubscribed: false,
    })

    if (created.error) {
      const updated = await resend.contacts.update({
        audienceId,
        email: inquiry.email,
        firstName,
        lastName,
        unsubscribed: false,
      })
      if (updated.error) {
        throw new Error(updated.error.message || created.error.message)
      }
    }

    return { synced: true }
  } catch (error) {
    return {
      synced: false,
      error: error instanceof Error ? error.message : "Could not add this contact to the marketing list.",
    }
  }
}

export async function persistLead(inquiry: GetFoundInquiry, audienceSynced: boolean) {
  const created = leadFromInquiry(inquiry, audienceSynced)

  const lead = await updateDb((db) => {
    const existing = db.leads.find(
      (item) => item.email === inquiry.email && item.status === "new" && !item.assignedToUserId
    )
    if (existing) {
      applyInquiryToLead(existing, inquiry, audienceSynced)
      return existing
    }
    db.leads.unshift(created)
    db.leads = db.leads.slice(0, 500)
    return created
  })

  return lead
}

/** @deprecated Use persistLead. Kept so older call sites still compile during the swap. */
export async function persistLeadFallback(inquiry: GetFoundInquiry, audienceSynced: boolean) {
  return persistLead(inquiry, audienceSynced)
}
