import { getPaddle, paddleApiKey } from "./paddle"
import { findPaddleCustomerId } from "./paddle-fulfillment"
import type { Database } from "./db"
import type { MarketingLead, User } from "./types"

export type LeadInvoiceResult = {
  ok: boolean
  dryRun: boolean
  error?: string
  customerId?: string
  transactionId?: string
  invoiceId?: string
  invoiceUrl?: string
}

function centsFromUsd(amountUsd: number) {
  return String(Math.max(0, Math.round(amountUsd * 100)))
}

function paddleErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const record = error as { error?: { detail?: string; message?: string }; message?: string }
    return record.error?.detail || record.error?.message || record.message || "Paddle invoice failed."
  }
  return error instanceof Error ? error.message : "Paddle invoice failed."
}

function shouldDryRun(user: Pick<User, "paddleCustomerId" | "email">) {
  if (!paddleApiKey()) return { dryRun: true, reason: "PADDLE_API_KEY is not set." }
  if (process.env.PADDLE_LEAD_INVOICE_DRY_RUN === "1") {
    return { dryRun: true, reason: "PADDLE_LEAD_INVOICE_DRY_RUN is set." }
  }
  const email = user.email.trim().toLowerCase()
  const synthetic =
    email.endsWith("@example.com") || email.endsWith(".test") || email.includes("+leadtest@")
  if (!user.paddleCustomerId.trim() && synthetic) {
    return { dryRun: true, reason: "No Paddle customer on this test agency; live invoice skipped." }
  }
  return { dryRun: false, reason: "" }
}

async function existingCustomerIdByEmail(email: string) {
  const paddle = getPaddle()
  const listed = paddle.customers.list({ email: [email], perPage: 5 })
  for await (const customer of listed) {
    if (customer.id) return customer.id
  }
  return ""
}

export async function ensurePaddleCustomerForUser(db: Database, user: User): Promise<string> {
  const mirrored = findPaddleCustomerId(db, user)
  if (mirrored) {
    user.paddleCustomerId = mirrored
    return mirrored
  }
  if (user.paddleCustomerId.trim()) return user.paddleCustomerId.trim()

  const paddle = getPaddle()
  const email = user.email.trim().toLowerCase()
  const found = await existingCustomerIdByEmail(email)
  if (found) {
    user.paddleCustomerId = found
    const existing = db.customers.find((row) => row.customerId === found)
    const stamp = new Date().toISOString()
    if (existing) {
      existing.email = email
      existing.updatedAt = stamp
    } else {
      db.customers.push({ customerId: found, email, createdAt: stamp, updatedAt: stamp })
    }
    return found
  }

  const created = await paddle.customers.create({
    email,
    name: user.name || user.company || email,
    customData: { gridpinsUserId: user.id, kind: "get_found_lead" },
  })
  user.paddleCustomerId = created.id
  const stamp = new Date().toISOString()
  db.customers.push({
    customerId: created.id,
    email,
    createdAt: stamp,
    updatedAt: stamp,
  })
  return created.id
}

/**
 * One-time Paddle invoice (manual collection) for a Get Found lead.
 * Does not auto-charge a saved card. Live path uses transactions.create.
 */
export async function invoiceAgencyForLead(
  db: Database,
  user: User,
  lead: MarketingLead,
  amountUsd: number
): Promise<LeadInvoiceResult> {
  const skip = shouldDryRun(user)
  if (skip.dryRun) {
    return {
      ok: true,
      dryRun: true,
      error: skip.reason,
      customerId: user.paddleCustomerId || undefined,
      transactionId: `dry_lead_${lead.id}`,
    }
  }

  try {
    const customerId = await ensurePaddleCustomerForUser(db, user)
    const paddle = getPaddle()
    const transaction = await paddle.transactions.create({
      customerId,
      currencyCode: "USD",
      collectionMode: "manual",
      customData: {
        kind: "get_found_lead",
        leadId: lead.id,
        assignedToUserId: user.id,
      },
      billingDetails: {
        enableCheckout: true,
        paymentTerms: { interval: "day", frequency: 14 },
        additionalInformation: `${lead.businessName} — ${lead.city}, ${lead.state}`,
      },
      items: [
        {
          quantity: 1,
          price: {
            name: "Get Found lead",
            description: `Get Found lead — ${lead.businessName}`,
            unitPrice: { amount: centsFromUsd(amountUsd), currencyCode: "USD" },
            product: {
              name: "Get Found lead",
              taxCategory: "standard",
              description: `Assigned Google Business Profile lead for ${lead.businessName} in ${lead.city}, ${lead.state}.`,
            },
          },
        },
      ],
    })

    let invoiceUrl = transaction.checkout?.url || ""
    if (!invoiceUrl) {
      try {
        const pdf = await paddle.transactions.getInvoicePDF(transaction.id)
        invoiceUrl = pdf.url || ""
      } catch {
        invoiceUrl = ""
      }
    }

    return {
      ok: true,
      dryRun: false,
      customerId,
      transactionId: transaction.id,
      invoiceId: transaction.invoiceId || transaction.invoiceNumber || "",
      invoiceUrl,
    }
  } catch (error) {
    return {
      ok: false,
      dryRun: false,
      error: paddleErrorMessage(error),
      customerId: user.paddleCustomerId || undefined,
    }
  }
}
