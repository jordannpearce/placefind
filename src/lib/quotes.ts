export type QuoteLeadInput = {
  name?: string
  email?: string
  phone?: string
  need?: string
}

export type QuoteLead = {
  name: string
  email: string
  phone: string
  need: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateQuoteLead(input: QuoteLeadInput): { value?: QuoteLead; error?: string } {
  const name = input.name?.trim() ?? ""
  const email = input.email?.trim() ?? ""
  const phone = input.phone?.trim() ?? ""
  const need = input.need?.trim() ?? ""
  if (name.length < 2) return { error: "Enter your name." }
  if (!EMAIL_PATTERN.test(email) || email.length > 120) {
    return { error: "Enter an email so the business can write you back." }
  }
  if (phone.length > 40) return { error: "Enter a shorter phone number." }
  if (need.length < 12) return { error: "Tell the business what you need." }
  if (need.length > 2000) return { error: "Keep the request under 2,000 characters." }
  return {
    value: {
      name: name.slice(0, 80),
      email: email.toLowerCase(),
      phone,
      need,
    },
  }
}

export const MISSING_QUOTE_EMAIL_MESSAGE =
  "This business has not published a contact email yet. The owner can add one when they edit the listing."
