import { resolveDataForSeoAuth } from "@/lib/dataforseo"
import { googleMapsUrl } from "@/lib/grid"
import { searchMockBusinesses } from "@/lib/mock-scan"
import { namesMatch } from "@/lib/rank"
import type { BusinessCandidate } from "@/lib/types"

const NOMINATIM = "https://nominatim.openstreetmap.org"
const USER_AGENT = "GridPin/1.0 (Google Maps grid rank tracker)"

type Body = {
  name?: string
  city?: string
  state?: string
  apiLogin?: string
  apiPassword?: string
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const name = body.name?.trim() ?? ""
  const city = body.city?.trim() ?? ""
  const state = body.state?.trim() ?? ""
  if (name.length < 2) {
    return Response.json({ error: "Business name is required" }, { status: 400 })
  }

  const query = [name, city, state].filter(Boolean).join(", ")
  const demo = searchMockBusinesses(name, city, state)
  const directory = await searchNominatim(query, city, state)
  const live = await searchLiveMaps(name, city, state, {
    login: body.apiLogin,
    password: body.apiPassword,
  })

  const merged = dedupe([...demo, ...live, ...directory])
  return Response.json({ hits: merged.slice(0, 8) })
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
        state: hitState,
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
  user: { login?: string; password?: string }
): Promise<BusinessCandidate[]> {
  const auth = resolveDataForSeoAuth(user)
  if (!auth) return []
  try {
    const location = [city, state, "United States"].filter(Boolean).join(",")
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
          keyword: name,
          depth: 10,
          search_places: true,
        },
      ]),
    })
    if (!response.ok) return []
    const payload = (await response.json()) as {
      tasks?: Array<{
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
    const items = payload.tasks?.[0]?.result?.[0]?.items ?? []
    return items
      .filter((item) => item.type === "maps_search" && item.title && namesMatch(item.title, name))
      .map((item) => {
        const lat = item.latitude ?? 0
        const lng = item.longitude ?? 0
        return {
          title: item.title ?? name,
          address: item.address ?? [city, state].filter(Boolean).join(", "),
          city,
          state,
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
  } catch {
    return []
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
