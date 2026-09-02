import { Resend } from "resend"

import { readDb, updateDb } from "./db"
import { resolveResendConfig } from "./mail"
import { splitName, type PublicInquiry } from "./public-forms"
import { randomToken } from "./password"
import type { MarketingLead } from "./types"

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

export async function persistLeadFallback(inquiry: PublicInquiry, audienceSynced: boolean) {
  const lead: MarketingLead = {
    id: `lead_${Date.now()}_${randomToken().slice(0, 8)}`,
    name: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone,
    businessName: inquiry.businessName,
    city: inquiry.city,
    state: inquiry.state,
    comments: inquiry.comments,
    source: "get-found",
    audienceSynced,
    createdAt: new Date().toISOString(),
  }

  await updateDb((db) => {
    const existing = db.leads.findIndex((item) => item.email === inquiry.email)
    if (existing >= 0) db.leads[existing] = { ...db.leads[existing], ...lead, id: db.leads[existing].id }
    else db.leads.unshift(lead)
    db.leads = db.leads.slice(0, 500)
  })

  return lead
}
