import { US_STATES } from "./storage"
import type { LocationCount } from "./types"

export type { LocationCount }

export type PublicInquiry = {
  name: string
  email: string
  phone: string
  businessName: string
  city: string
  state: string
  comments: string
}

export const LOCATION_COUNTS: LocationCount[] = ["1", "2-5", "6+"]

export type GetFoundInquiry = PublicInquiry & {
  website: string
  gbpListing: string
  primaryCategory: string
  keyword: string
  locationCount: LocationCount
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "")
}

export function isLocationCount(value: unknown): value is LocationCount {
  return value === "1" || value === "2-5" || value === "6+"
}

/** Hidden bot field. Real website answers use `website` and must not trip this. */
export function isHoneypotTripped(body: Record<string, unknown>) {
  return asString(body.hpWebsite).length > 0
}

export function parseWebsite(value: unknown) {
  const raw = asString(value)
  if (!raw) return { ok: true as const, value: "" }
  if (raw.length > 300) return { ok: false as const, error: "Website is too long." }
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false as const, error: "Website must be an http or https URL." }
    }
    if (!url.hostname.includes(".")) {
      return { ok: false as const, error: "Enter a full website, like yourshop.com." }
    }
    return { ok: true as const, value: withScheme }
  } catch {
    return { ok: false as const, error: "Enter a valid website, like yourshop.com." }
  }
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

export function parseGetFoundInquiry(
  body: Record<string, unknown>
): { ok: true; data: GetFoundInquiry } | { ok: false; error: string } {
  const base = parsePublicInquiry(body)
  if (!base.ok) return base

  const website = parseWebsite(body.website)
  if (!website.ok) return website

  const gbpListing = asString(body.gbpListing)
  const primaryCategory = asString(body.primaryCategory)
  const keyword = asString(body.keyword)
  const locationCount = body.locationCount

  if (gbpListing.length < 2) {
    return { ok: false, error: "Google Business Profile URL or listing name is required." }
  }
  if (primaryCategory.length < 2) {
    return { ok: false, error: "Primary category / type of business is required." }
  }
  if (keyword.length < 2) {
    return { ok: false, error: "Main keyword you want to rank for is required." }
  }
  if (!isLocationCount(locationCount)) {
    return { ok: false, error: "Choose how many locations you have." }
  }

  return {
    ok: true,
    data: {
      ...base.data,
      website: website.value,
      gbpListing,
      primaryCategory,
      keyword,
      locationCount,
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
