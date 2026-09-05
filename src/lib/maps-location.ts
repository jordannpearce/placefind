import { toStateAbbr, toStateName } from "./storage"

export type BrandAddressInput = {
  street?: string
  city?: string
  state?: string
  zip?: string
  address?: string
}

export type BrandLocation = {
  street: string
  city: string
  state: string
  zip: string
  address: string
  lat: number | null
  lng: number | null
  location: string
}

function trimPart(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function finiteCoord(value: unknown) {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function canonicalAiLocation(city: string, state: string) {
  const cityName = city.trim()
  const stateName = toStateName(state)
  return [cityName, stateName, "United States"].filter(Boolean).join(",")
}

export function composeBrandAddress(input: BrandAddressInput) {
  const street = trimPart(input.street, 120)
  const city = trimPart(input.city, 80)
  const state = toStateAbbr(trimPart(input.state, 40))
  const zip = trimPart(input.zip, 16)
  if (street || city || state || zip) {
    const cityState = [city, state].filter(Boolean).join(", ")
    const cityZip = [cityState, zip].filter(Boolean).join(" ")
    return [street, cityZip].filter(Boolean).join(", ")
  }
  return trimPart(input.address, 200)
}

export function parseLegacyAddress(address: string): {
  street: string
  city: string
  state: string
  zip: string
} {
  const empty = { street: "", city: "", state: "", zip: "" }
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length >= 3) {
    const last = parts[parts.length - 1] || ""
    const city = parts[parts.length - 2] || ""
    const street = parts.slice(0, -2).join(", ")
    const withZip = last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/)
    if (withZip) {
      return { street, city, state: toStateAbbr(withZip[1]), zip: withZip[2] }
    }
    const stateOnly = last.match(/^([A-Za-z]{2})$/)
    if (stateOnly) {
      return { street, city, state: toStateAbbr(stateOnly[1]), zip: "" }
    }
  }
  if (parts.length === 2) {
    const last = parts[1] || ""
    const withZip = last.match(/^([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/)
    if (withZip && toStateName(withZip[1]) !== withZip[1]) {
      return { street: parts[0] || "", city: "", state: toStateAbbr(withZip[1]), zip: withZip[2] || "" }
    }
    const stateOnly = last.match(/^([A-Za-z]{2})$/)
    if (stateOnly) {
      return { street: "", city: parts[0] || "", state: toStateAbbr(stateOnly[1]), zip: "" }
    }
  }
  return empty
}

export function emptyBrandLocation(): BrandLocation {
  return {
    street: "",
    city: "",
    state: "",
    zip: "",
    address: "",
    lat: null,
    lng: null,
    location: "",
  }
}

export function normalizeBrandLocation(raw: Partial<BrandLocation> & BrandAddressInput): BrandLocation {
  let street = trimPart(raw.street, 120)
  let city = trimPart(raw.city, 80)
  let state = toStateAbbr(trimPart(raw.state, 40))
  let zip = trimPart(raw.zip, 16)
  const legacyAddress = trimPart(raw.address, 200)
  if (!street && !city && !state && legacyAddress) {
    const parsed = parseLegacyAddress(legacyAddress)
    street = parsed.street
    city = parsed.city
    state = parsed.state
    zip = parsed.zip
  }
  const address = composeBrandAddress({ street, city, state, zip, address: legacyAddress })
  const location =
    trimPart(raw.location, 160) || (city && state ? canonicalAiLocation(city, state) : "")
  return {
    street,
    city,
    state,
    zip,
    address,
    lat: finiteCoord(raw.lat),
    lng: finiteCoord(raw.lng),
    location,
  }
}
