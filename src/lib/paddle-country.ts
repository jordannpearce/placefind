const COUNTRY_HEADERS = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "x-country-code",
  "cloudfront-viewer-country",
  "x-nf-country",
  "x-geo-country",
  "x-appengine-country",
  "x-forwarded-country",
  "fastly-client-geo-country",
]

const BLOCKED = new Set(["OTHERS", "OTHER", "UNKNOWN", "XX", "T1", "A1", "A2", "ZZ"])

/**
 * Billing country from the edge / CDN. Returns a 2-letter ISO code or null.
 * Never returns `OTHERS` — Paddle rejects that value.
 */
export function detectCheckoutCountry(headerStore: Headers): string | null {
  for (const name of COUNTRY_HEADERS) {
    const code = headerStore.get(name)?.trim().toUpperCase() || ""
    if (!code || BLOCKED.has(code) || !/^[A-Z]{2}$/.test(code)) continue
    return code
  }
  return null
}
