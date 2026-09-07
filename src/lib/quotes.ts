import { toStateAbbr, US_STATES } from "./states.ts"

export type QuoteLeadInput = {
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  phone?: string
  street?: string
  city?: string
  state?: string
  zip?: string
  service?: string
  need?: string
}

export type QuoteLead = {
  firstName: string
  lastName: string
  name: string
  email: string
  phone: string
  street: string
  city: string
  state: string
  zip: string
  service: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ZIP_PATTERN = /^\d{5}(?:-\d{4})?$/

function splitLegacyName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") }
}

export function quoteLeadName(lead: Pick<QuoteLead, "firstName" | "lastName">): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim()
}

export function formatQuoteAddress(lead: Pick<QuoteLead, "street" | "city" | "state" | "zip">): string {
  const cityState = [lead.city, lead.state].filter(Boolean).join(", ")
  return [lead.street, [cityState, lead.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")
}

export function validateQuoteLead(input: QuoteLeadInput): { value?: QuoteLead; error?: string } {
  const legacy = splitLegacyName(input.name ?? "")
  const firstName = (input.firstName?.trim() || legacy.firstName).slice(0, 40)
  const lastName = (input.lastName?.trim() || legacy.lastName).slice(0, 40)
  const email = input.email?.trim() ?? ""
  const phone = input.phone?.trim() ?? ""
  const street = input.street?.trim() ?? ""
  const city = input.city?.trim() ?? ""
  const state = toStateAbbr(input.state ?? "")
  const zip = input.zip?.trim() ?? ""
  const service = (input.service?.trim() || input.need?.trim() || "")
  const digits = phone.replace(/\D/g, "")

  if (firstName.length < 1) return { error: "Enter your first name." }
  if (lastName.length < 1) return { error: "Enter your last name." }
  if (!EMAIL_PATTERN.test(email) || email.length > 120) {
    return { error: "Enter an email so the business can write you back." }
  }
  if (digits.length < 7 || phone.length > 40) return { error: "Enter a phone number." }
  if (street.length < 3) return { error: "Enter your street address." }
  if (city.length < 2) return { error: "Enter your city." }
  if (!US_STATES.some((row) => row.abbr === state)) return { error: "Choose a state." }
  if (!ZIP_PATTERN.test(zip)) return { error: "Enter a ZIP code." }
  if (service.length < 1) return { error: "Enter the service you need." }
  if (service.length > 2000) return { error: "Keep the request under 2,000 characters." }

  const value: QuoteLead = {
    firstName,
    lastName,
    name: quoteLeadName({ firstName, lastName }),
    email: email.toLowerCase(),
    phone,
    street: street.slice(0, 120),
    city: city.slice(0, 80),
    state,
    zip,
    service,
  }
  return { value }
}

export const MISSING_QUOTE_EMAIL_MESSAGE =
  "This business has not published a contact email yet. The owner can add one when they edit the listing."
