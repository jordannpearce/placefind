import { US_STATES, toStateAbbr } from "./states.ts"

export type StreetAddress = {
  street: string
  city: string
  state: string
  zip: string
}

function knownState(value: string): boolean {
  const abbr = toStateAbbr(value)
  return US_STATES.some((state) => state.abbr === abbr)
}

export function parseStreetAddress(address: string, fallback: { city?: string; state?: string } = {}): StreetAddress {
  const raw = address.replace(/\s+/g, " ").trim()
  const fallbackCity = fallback.city?.trim() ?? ""
  const fallbackState = toStateAbbr(fallback.state ?? "") || (fallback.state?.trim() ?? "")
  if (!raw) {
    return { street: "", city: fallbackCity, state: fallbackState, zip: "" }
  }

  const zipMatch = raw.match(/\s+(\d{5}(?:-\d{4})?)\s*$/)
  const zip = zipMatch?.[1] ?? ""
  const withoutZip = (zip ? raw.slice(0, -zipMatch![0].length) : raw).replace(/[,\s]+$/g, "").trim()
  const parts = withoutZip.split(",").map((part) => part.trim()).filter(Boolean)

  if (parts.length >= 3) {
    return {
      street: parts.slice(0, -2).join(", "),
      city: parts[parts.length - 2]!,
      state: toStateAbbr(parts[parts.length - 1]!) || parts[parts.length - 1]!,
      zip,
    }
  }

  if (parts.length === 2) {
    const state = toStateAbbr(parts[1]!)
    if (knownState(parts[1]!)) {
      return { street: "", city: parts[0]!, state, zip }
    }
    return {
      street: parts[0]!,
      city: parts[1]!,
      state: fallbackState,
      zip,
    }
  }

  if (fallbackCity && !raw.toLowerCase().includes(fallbackCity.toLowerCase())) {
    return { street: raw, city: fallbackCity, state: fallbackState, zip }
  }

  return {
    street: raw && !fallbackCity ? raw : "",
    city: fallbackCity,
    state: fallbackState,
    zip,
  }
}

export function formatStreetAddress(parts: Partial<StreetAddress>): string {
  const cityState = [parts.city?.trim(), parts.state?.trim()].filter(Boolean).join(", ")
  const cityStateZip = [cityState, parts.zip?.trim()].filter(Boolean).join(" ")
  return [parts.street?.trim(), cityStateZip].filter(Boolean).join(", ")
}

export function hasStreetAddress(parts: Partial<StreetAddress> | { address?: string | null }): boolean {
  if ("address" in parts && parts.address?.trim()) return true
  if ("street" in parts && String(parts.street ?? "").trim()) return true
  return false
}
