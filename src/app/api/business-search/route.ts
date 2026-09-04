import { rejectUnlessSoftwareAccess } from "@/lib/billing-gate"
import { dataForSeoErrorMessage, resolveRequestAuth } from "@/lib/dataforseo"
import { googleMapsUrl } from "@/lib/grid"
import { searchMockBusinesses } from "@/lib/mock-scan"
import { namesMatch } from "@/lib/rank"
import { toStateAbbr, toStateName } from "@/lib/storage"
import type { BusinessCandidate } from "@/lib/types"

const NOMINATIM = "https://nominatim.openstreetmap.org"
const USER_AGENT = "GridPins/1.0 (https://gridpins.com; hello@gridpins.com)"

type Body = {
  name?: string
  city?: string
  state?: string
  apiLogin?: string
  apiPassword?: string
}

export async function POST(request: Request) {
  const blocked = await rejectUnlessSoftwareAccess()
  if (blocked) return blocked

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name = body.name?.trim() ?? ""
  const city = body.city?.trim() ?? ""
  const state = body.state?.trim() ?? ""
  if (name.length < 2) {
    return Response.json({ error: "Business name is required" }, { status: 400 })
  }

  const query = [name, city, state].filter(Boolean).join(", ")
  const auth = await resolveRequestAuth({
    login: body.apiLogin,
    password: body.apiPassword,
  })
  const live = await searchLiveMaps(name, city, state, auth)
  const directory = await searchNominatim(query, city, state)
  const cityCenter = directory.length === 0 && city ? await searchNominatim([city, state].filter(Boolean).join(", "), city, state) : []
  const sample = auth ? [] : searchMockBusinesses(name, city, state)

  const merged = dedupe([...live.hits, ...directory, ...sample])
  if (merged.length === 0 && cityCenter[0]) {
    merged.push({
      title: name,
      address: cityCenter[0].address,
      city: cityCenter[0].city || city,
      state: toStateAbbr(cityCenter[0].state || state),
      lat: cityCenter[0].lat,
      lng: cityCenter[0].lng,
      placeId: null,
      mapsUrl: googleMapsUrl({
        title: name,
        address: cityCenter[0].address,
        lat: cityCenter[0].lat,
        lng: cityCenter[0].lng,
      }),
      source: "directory",
    })
  }

  if (merged.length === 0) {
    return Response.json({
      hits: [],
      error:
        live.error ||
        (auth
          ? "No listings matched that name in this city. Check the spelling, or pick a closer city."
          : "No listings found. Add DataForSEO keys in Settings to search live Google Maps, or confirm the name, city, and state."),
    })
  }

  return Response.json({
    hits: merged.slice(0, 12),
    warning: live.error || undefined,
    live: Boolean(auth),
  })
}

async function searchNominatim(
  query: string,
  city: string,
  state: string
): Promise<BusinessCandidate[]> {
  try {
    const url = `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    })
    if (!response.ok) return []
    const data = (await response.json()) as Array<{
      display_name: string
      lat: string
      lon: string
      name?: string
      address?: { city?: string; town?: string; village?: string; state?: string }
    }>
    return data.map((hit) => {
      const title = hit.name || query.split(",")[0]
      const hitCity = hit.address?.city || hit.address?.town || hit.address?.village || city
      const hitState = hit.address?.state || state
      const lat = Number(hit.lat)
      const lng = Number(hit.lon)
      return {
        title,
        address: hit.display_name,
        city: hitCity,
        state: toStateAbbr(hitState) || hitState,
        lat,
        lng,
        placeId: null,
        mapsUrl: googleMapsUrl({ title, address: hit.display_name, lat, lng }),
        source: "directory" as const,
      }
    })
  } catch {
    return []
  }
}

async function searchLiveMaps(
  name: string,
  city: string,
  state: string,
  auth: { login: string; password: string } | null
): Promise<{ hits: BusinessCandidate[]; error: string | null }> {
  if (!auth) return { hits: [], error: null }
  try {
    const stateName = toStateName(state)
    const location = [city, stateName, "United States"].filter(Boolean).join(",")
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
          keyword: [name, city, stateName].filter(Boolean).join(" "),
          depth: 20,
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
          items?: Array<{
            type?: string
            title?: string
            address?: string
            place_id?: string
            latitude?: number
            longitude?: number
          }>
        }>
      }>
    }
    const dfsError = dataForSeoErrorMessage(payload, response.status)
    if (dfsError) {
      return { hits: [], error: dfsError }
    }
    const task = payload.tasks?.[0]
    const items = task?.result?.[0]?.items ?? []
    const hits = items
      .filter((item) => item.type === "maps_search" && item.title)
      .map((item) => {
        const lat = item.latitude ?? 0
        const lng = item.longitude ?? 0
        return {
          title: item.title ?? name,
          address: item.address ?? [city, state].filter(Boolean).join(", "),
          city,
          state: toStateAbbr(state) || state,
          lat,
          lng,
          placeId: item.place_id ?? null,
          mapsUrl: googleMapsUrl({
            title: item.title ?? name,
            address: item.address,
            lat,
            lng,
            placeId: item.place_id,
          }),
          source: "maps" as const,
        }
      })
    hits.sort((a, b) => Number(namesMatch(b.title, name)) - Number(namesMatch(a.title, name)))
    return { hits, error: null }
  } catch {
    return { hits: [], error: "Could not reach DataForSEO Maps search." }
  }
}

function dedupe(hits: BusinessCandidate[]): BusinessCandidate[] {
  const seen = new Set<string>()
  const out: BusinessCandidate[] = []
  for (const hit of hits) {
    const key = hit.placeId || `${hit.title.toLowerCase()}|${hit.lat.toFixed(4)}|${hit.lng.toFixed(4)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(hit)
  }
  return out
}
