import { toStateName } from "./states.ts"

export async function geocodeCityState(city: string, state: string): Promise<{ lat: number; lng: number } | null> {
  const place = [city.trim(), toStateName(state) || state.trim(), "United States"].filter(Boolean).join(", ")
  if (!city.trim() || !state.trim()) return null

  try {
    const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress")
    url.searchParams.set("address", `${city.trim()}, ${state.trim()}`)
    url.searchParams.set("benchmark", "4")
    url.searchParams.set("format", "json")
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const payload = (await response.json()) as {
      result?: { addressMatches?: Array<{ coordinates?: { x?: number; y?: number } }> }
    }
    const coords = payload.result?.addressMatches?.[0]?.coordinates
    if (coords?.y != null && coords?.x != null) return { lat: Number(coords.y), lng: Number(coords.x) }
  } catch {
    // try OpenStreetMap next
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("format", "json")
    url.searchParams.set("limit", "1")
    url.searchParams.set("q", place)
    const response = await fetch(url, {
      headers: { "User-Agent": "PlaceFind/1.0 (grid rank tracker)" },
      signal: AbortSignal.timeout(8000),
    })
    const payload = (await response.json()) as Array<{ lat?: string; lon?: string }>
    const first = payload[0]
    if (first?.lat && first?.lon) return { lat: Number(first.lat), lng: Number(first.lon) }
  } catch {
    return null
  }
  return null
}
