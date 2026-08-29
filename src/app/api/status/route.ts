import { hasDataForSeoCredentials } from "@/lib/dataforseo"

export async function GET() {
  const live = hasDataForSeoCredentials()
  return Response.json({
    mode: live ? "live" : "mock",
    live,
    message: live
      ? "DataForSEO credentials found. Scans will hit Google Maps SERP live."
      : "No DataForSEO credentials. Scans use a realistic mock grid so you can try the product.",
  })
}
