import type { GeocodeHit } from "@/lib/types"

const NOMINATIM = "https://nominatim.openstreetmap.org"
const USER_AGENT = "GridPin/1.0 (Google Maps grid rank tracker)"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim()
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")

  try {
    if (lat && lng) {
      const url = `${NOMINATIM}/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json`
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        next: { revalidate: 3600 },
      })
      if (!response.ok) {
        return Response.json({ error: "Reverse geocode failed" }, { status: 502 })
      }
      const data = (await response.json()) as { display_name?: string }
      return Response.json({
        hits: [
          {
            label: data.display_name ?? `${lat}, ${lng}`,
            lat: Number(lat),
            lng: Number(lng),
          },
        ] satisfies GeocodeHit[],
      })
    }

    if (!query || query.length < 2) {
      return Response.json({ hits: [] satisfies GeocodeHit[] })
    }

    const url = `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=5`
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      next: { revalidate: 3600 },
    })
    if (!response.ok) {
      return Response.json({ error: "Geocode failed" }, { status: 502 })
    }

    const data = (await response.json()) as Array<{
      display_name: string
      lat: string
      lon: string
    }>

    const hits: GeocodeHit[] = data.map((hit) => ({
      label: hit.display_name,
      lat: Number(hit.lat),
      lng: Number(hit.lon),
    }))

    return Response.json({ hits })
  } catch {
    return Response.json({ error: "Geocode unavailable" }, { status: 502 })
  }
}
