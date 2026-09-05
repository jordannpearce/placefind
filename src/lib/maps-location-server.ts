import { parseBrandForm, scanLocationForBrand } from "./ai-visibility"
import { dataForSeoErrorMessage, type DataForSeoAuth } from "./dataforseo"
import { canonicalAiLocation, usableBrandCoords } from "./maps-location"
import { toStateAbbr, toStateName } from "./storage"
import type { AiBrand } from "./types"

const NOMINATIM = "https://nominatim.openstreetmap.org"
const USER_AGENT = "GridPins/1.0 (https://gridpins.com; hello@gridpins.com)"

function trimPart(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function finiteCoord(value: unknown) {
  if (value == null || value === "") return null
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

export async function withResolvedBrandLocation<T extends ReturnType<typeof parseBrandForm>>(
  parsed: T,
  auth?: DataForSeoAuth | null
) {
  if (!parsed.city.trim() || !parsed.state.trim()) return parsed
  const geo = await resolveCityStateLocation({
    city: parsed.city,
    state: parsed.state,
    auth,
  })
  return {
    ...parsed,
    lat: geo.lat,
    lng: geo.lng,
    location: geo.location || parsed.location,
  }
}

export async function resolveBrandScanLocation(
  brand: AiBrand,
  auth?: DataForSeoAuth | null
): Promise<{ location: string; lat: number | null; lng: number | null }> {
  const fallback = scanLocationForBrand(brand)
  const stored = usableBrandCoords(brand.lat, brand.lng)
  if (stored.lat != null && stored.lng != null && fallback) {
    return { location: fallback, lat: stored.lat, lng: stored.lng }
  }
  if (!brand.city.trim() || !brand.state.trim()) {
    return { location: fallback, lat: stored.lat, lng: stored.lng }
  }
  const geo = await resolveCityStateLocation({
    city: brand.city,
    state: brand.state,
    auth,
  })
  return {
    location: geo.location || fallback,
    lat: geo.lat ?? stored.lat,
    lng: geo.lng ?? stored.lng,
  }
}
