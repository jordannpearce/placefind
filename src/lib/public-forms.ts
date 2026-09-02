import { US_STATES } from "./storage"

export type PublicInquiry = {
  name: string
  email: string
  phone: string
  businessName: string
  city: string
  state: string
  comments: string
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "")
}

export function isHoneypotTripped(body: Record<string, unknown>) {
  return asString(body.website).length > 0
}

export function parsePublicInquiry(body: Record<string, unknown>): { ok: true; data: PublicInquiry } | { ok: false; error: string } {
  const name = asString(body.name)
  const email = asString(body.email).toLowerCase()
  const phone = asString(body.phone)
  const businessName = asString(body.businessName)
  const city = asString(body.city)
  const stateRaw = asString(body.state).toUpperCase()
  const comments = asString(body.comments)
  const state = US_STATES.find((item) => item.abbr === stateRaw || item.name.toUpperCase() === stateRaw)

  if (name.length < 2) return { ok: false, error: "Name is required." }
  if (!email.includes("@") || email.length < 5) return { ok: false, error: "A valid email is required." }
  if (digitsOnly(phone).length < 10) return { ok: false, error: "A valid phone number is required." }
  if (businessName.length < 2) return { ok: false, error: "Business name is required." }
  if (city.length < 2) return { ok: false, error: "City is required." }
  if (!state) return { ok: false, error: "Choose a U.S. state." }

  return {
    ok: true,
    data: {
      name,
      email,
      phone,
      businessName,
      city,
      state: state.abbr,
      comments,
    },
  }
}

export function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || fullName,
    lastName: parts.slice(1).join(" ") || undefined,
  }
}
