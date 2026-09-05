import { dataForSeoErrorMessage, type DataForSeoAuth } from "./dataforseo"
import { toStateAbbr, toStateName } from "./storage"

const NOMINATIM = "https://nominatim.openstreetmap.org"
const USER_AGENT = "GridPins/1.0 (https://gridpins.com; hello@gridpins.com)"

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

function finiteCoord(value: unknown) {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

async function geocodeNominatim(city: string, state: string) {
  const query = [city, toStateName(state) || state, "United States"].filter(Boolean).join(", ")
  if (query.length < 3) return { lat: null, lng: null }
  try {
    const url = `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=1`
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    })
    if (!response.ok) return { lat: null, lng: null }
    const data = (await response.json()) as Array<{ lat?: string; lon?: string }>
    const hit = data[0]
    return { lat: finiteCoord(hit?.lat), lng: finiteCoord(hit?.lon) }
  } catch {
    return { lat: null, lng: null }
  }
}

async function geocodeMapsApi(city: string, state: string, auth: DataForSeoAuth) {
  const location = canonicalAiLocation(city, state)
  const cred = Buffer.from(`${auth.login}:${auth.password}`).toString("base64")
  const response = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
    method: "POST",
    headers: {
      Authorization: `Basic ${cred}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        language_code: "en",
        location_name: location || "United States",
        keyword: [city, toStateName(state)].filter(Boolean).join(" "),
        depth: 10,
        search_places: true,
      },
    ]),
  })
  const payload = (await response.json()) as {
    status_code?: number
    status_message?: string
    tasks?: Array<{
      status_code?: number
      status_message?: string
      result?: Array<{
        items?: Array<{ latitude?: number; longitude?: number }>
      }>
    }>
  }
  const error = dataForSeoErrorMessage(payload, response.status)
  if (error) throw new Error(error)
  for (const task of payload.tasks || []) {
    for (const result of task.result || []) {
      for (const item of result.items || []) {
        const lat = finiteCoord(item.latitude)
        const lng = finiteCoord(item.longitude)
        if (lat != null && lng != null) return { lat, lng }
      }
    }
  }
  return { lat: null, lng: null }
}

/** Pin a brand to City + State so AI Visibility scans are local. */
export async function resolveCityStateLocation(input: {
  city: string
  state: string
  auth?: DataForSeoAuth | null
}): Promise<{ lat: number | null; lng: number | null; location: string; label: string }> {
  const city = trimPart(input.city, 80)
  const state = toStateAbbr(trimPart(input.state, 40))
  const location = city && state ? canonicalAiLocation(city, state) : ""
  const label = [city, state].filter(Boolean).join(", ")
  let lat: number | null = null
  let lng: number | null = null

  if (input.auth && city && state) {
    try {
      const live = await geocodeMapsApi(city, state, input.auth)
      lat = live.lat
      lng = live.lng
    } catch {
      // Fall through to the directory geocoder. User-facing copy still says Maps API.
    }
  }

  if ((lat == null || lng == null) && city) {
    const fallback = await geocodeNominatim(city, state)
    lat = fallback.lat
    lng = fallback.lng
  }

  return { lat, lng, location, label }
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
