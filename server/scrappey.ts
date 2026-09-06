import { mapsPlaceUrl, mapsSearchUrl } from "./match.ts"
import { toStateAbbr } from "./states.ts"
import type { BusinessListing, KeyTestResult, SearchQuery } from "./types.ts"

const SCRAPPEY_ENDPOINT = "https://publisher.scrappey.com/api/v1"

type ScrappeySolution = {
  verified?: boolean
  currentUrl?: string
  statusCode?: number
  innerText?: string
  markdown?: string
  response?: string
}

type ScrappeyResponse = {
  solution?: ScrappeySolution
  data?: string
  error?: string
}

const PHONE_RE = /(?:\+1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/
const RATING_RE = /(\d(?:\.\d)?)\s*(?:stars?)?\s*\((\d{1,3}(?:,\d{3})+|\d+)\)/i
const URL_RE = /https?:\/\/[^\s)>\]]+/g

function scrappeyUrl(key: string): string {
  return `${SCRAPPEY_ENDPOINT}?key=${encodeURIComponent(key)}`
}

async function scrappeyGet(key: string, url: string, timeoutMs = 90_000): Promise<{ text: string; currentUrl: string; error: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(scrappeyUrl(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "request.get",
        url,
        markdown: true,
        proxyCountry: "UnitedStates",
        overwriteLocale: "en-US",
      }),
      signal: controller.signal,
    })
    const payload = (await response.json()) as ScrappeyResponse
    if (payload.error || payload.solution?.verified === false) {
      return { text: "", currentUrl: url, error: payload.error || "Scrappey could not open the Maps page." }
    }
    const text = payload.solution?.markdown || payload.solution?.innerText || ""
    return {
      text,
      currentUrl: payload.solution?.currentUrl || url,
      error: text ? null : "Scrappey returned an empty Maps page.",
    }
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Scrappey timed out." : "Could not reach Scrappey."
    return { text: "", currentUrl: url, error: message }
  } finally {
    clearTimeout(timer)
  }
}

function firstWebsite(text: string): string | null {
  const urls = text.match(URL_RE) ?? []
  const site = urls.find((url) => {
    try {
      const host = new URL(url).hostname
      return !/google\.|gstatic\.|ggpht\.|googleapis\.|schema\.org|w3\.org/i.test(host)
    } catch {
      return false
    }
  })
  return site ?? null
}

function firstPhone(text: string): string | null {
  return text.match(PHONE_RE)?.[0] ?? null
}

function parseHours(text: string): string | null {
  const line = text
    .split("\n")
    .map((row) => row.trim())
    .find((row) => /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|hours|open)/i.test(row) && /\d/.test(row))
  return line || null
}

export function parseMapsMarkdown(text: string, query: SearchQuery, mapsUrl: string): BusinessListing[] {
  const cleaned = text.replace(/\r/g, "").trim()
  if (!cleaned) return []

  const blocks = cleaned.split(/\n{2,}/).map((block) => block.trim()).filter((block) => block.length > 20)
  const listings: BusinessListing[] = []

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean)
    const heading = lines.find((line) => line.startsWith("#"))?.replace(/^#+\s*/, "")
    const ratingMatch = block.match(RATING_RE)
    const phone = firstPhone(block)
    const website = firstWebsite(block)
    const addressLine = lines.find((line) => /\d/.test(line) && /(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane|way|ct|hwy|suite|ste|#)/i.test(line))
    const title = heading || lines[0]
    if (!title || title.length > 80) continue
    if (/cookie|sign in|accessibility|terms of/i.test(title)) continue

    listings.push({
      title: title.replace(/\*+/g, "").trim(),
      address: addressLine || [query.city, toStateAbbr(query.state)].filter(Boolean).join(", "),
      city: query.city,
      state: toStateAbbr(query.state),
      phone,
      website,
      category: lines.find((line) => /restaurant|shop|store|clinic|salon|gym|bar|cafe|hotel|dentist|lawyer|plumber/i.test(line) && line.length < 60) ?? null,
      rating: ratingMatch ? Number(ratingMatch[1]) : null,
      reviewCount: ratingMatch ? Number(ratingMatch[2].replace(/,/g, "")) : null,
      hours: parseHours(block),
      hoursDetail: [],
      currentStatus: /open now|open ⋅|· open/i.test(block) ? "open" : /closed/i.test(block) ? "closed" : null,
      claimed: /claimed|owner of this/i.test(block) ? true : null,
      mapsUrl,
      source: "scrappey",
      matchScore: 0,
      isBestMatch: false,
    })
    if (listings.length >= 8) break
  }

  return listings
}

export function mergeEnrichment(base: BusinessListing, extras: Partial<BusinessListing>): BusinessListing {
  return {
    ...base,
    phone: base.phone || extras.phone || null,
    website: base.website || extras.website || null,
    hours: base.hours || extras.hours || null,
    currentStatus: base.currentStatus || extras.currentStatus || null,
    claimed: base.claimed ?? extras.claimed ?? null,
    rating: base.rating ?? extras.rating ?? null,
    reviewCount: base.reviewCount ?? extras.reviewCount ?? null,
    category: base.category || extras.category || null,
    mapsUrl: extras.mapsUrl || base.mapsUrl,
  }
}

export async function enrichWithScrappey(key: string, listing: BusinessListing): Promise<{ listing: BusinessListing; error: string | null }> {
  const url = listing.mapsUrl || mapsPlaceUrl(listing)
  const page = await scrappeyGet(key, url)
  if (page.error) return { listing, error: page.error }
  const parsed = parseMapsMarkdown(page.text, {
    name: listing.title,
    city: listing.city || "",
    state: listing.state || "",
  }, page.currentUrl)
  const extra = parsed[0]
  return { listing: extra ? mergeEnrichment(listing, extra) : listing, error: null }
}

export async function searchScrappey(query: SearchQuery, key: string): Promise<{ hits: BusinessListing[]; error: string | null }> {
  const url = mapsSearchUrl(query)
  const page = await scrappeyGet(key, url)
  if (page.error) return { hits: [], error: page.error }
  const hits = parseMapsMarkdown(page.text, query, page.currentUrl)
  return { hits, error: hits.length ? null : "Scrappey opened Maps but no listings could be read from the page." }
}

export async function testScrappey(key: string): Promise<KeyTestResult> {
  try {
    const response = await fetch(scrappeyUrl(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "request.get",
        url: "https://example.com",
        requestType: "request",
      }),
    })
    const payload = (await response.json()) as ScrappeyResponse
    if (payload.error || payload.solution?.verified === false) {
      return { ok: false, service: "scrappey", message: payload.error || "Scrappey rejected this API key." }
    }
    return { ok: true, service: "scrappey", message: "Connected. Scrappey accepted the key." }
  } catch {
    return { ok: false, service: "scrappey", message: "Could not reach Scrappey." }
  }
}
