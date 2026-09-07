import { validateQuoteLead, type QuoteLead, type QuoteLeadInput } from "../src/lib/quotes.ts"
import { findUserById } from "./auth.ts"
import { getListing, listingIsApprovedForDirectory, ListingError, type DirectoryListing } from "./listings.ts"
import { quoteRequestEmail, sendMail, type OutboundMail } from "./mail.ts"

export function listingQuoteAddress(listing: Pick<DirectoryListing, "email" | "ownerUserId">) {
  const published = listing.email.trim()
  if (published) return published
  return findUserById(listing.ownerUserId)?.email.trim() ?? ""
}

export async function submitQuoteLead(
  listingId: string,
  input: QuoteLeadInput,
): Promise<{ lead: QuoteLead; mail: OutboundMail }> {
  const listing = getListing(listingId)
  if (!listingIsApprovedForDirectory(listing)) {
    throw new ListingError(404, "That listing is not in the directory.")
  }
  const parsed = validateQuoteLead(input)
  if (parsed.error || !parsed.value) throw new ListingError(400, parsed.error || "Could not send that quote request.")
  const to = listingQuoteAddress(listing)
  const message = quoteRequestEmail({
    businessName: listing.brand || listing.name,
    firstName: parsed.value.firstName,
    lastName: parsed.value.lastName,
    name: parsed.value.name,
    email: parsed.value.email,
    phone: parsed.value.phone,
    street: parsed.value.street,
    city: parsed.value.city,
    state: parsed.value.state,
    zip: parsed.value.zip,
    service: parsed.value.service,
  })
  const mail = await sendMail({ ...message, to })
  return { lead: parsed.value, mail }
}
