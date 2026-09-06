import { searchDataForSeo } from "./dataforseo.ts"
import { mergeHostedKeys } from "./hosted-keys.ts"
import { publicSearchMessage } from "./public-copy.ts"
import { rankListings } from "./match.ts"
import { searchMockBusinesses } from "./mock.ts"
import { enrichWithScrappey, searchScrappey } from "./scrappey.ts"
import type { ApiKeys, BusinessListing, SearchQuery, SearchResponse } from "./types.ts"

function hasDataForSeo(keys: ApiKeys): boolean {
  return Boolean(keys.dataforseoLogin?.trim() && keys.dataforseoPassword?.trim())
}

function hasScrappey(keys: ApiKeys): boolean {
  return Boolean(keys.scrappeyKey?.trim())
}

function envKeys(keys: ApiKeys): ApiKeys {
  return mergeHostedKeys(keys)
}

function publicCopy(text: string): string {
  return text.replace(/DataForSEO/gi, "Maps search").replace(/Scrappey/gi, "the listing page")
}

function finalize(query: SearchQuery, listings: BusinessListing[], extras: Omit<SearchResponse, "query" | "best" | "others" | "elapsedMs">, started: number): SearchResponse {
  const ranked = rankListings(listings, query)
  return {
    query,
    best: ranked.find((item) => item.isBestMatch) ?? ranked[0] ?? null,
    others: ranked.filter((item) => item !== (ranked.find((row) => row.isBestMatch) ?? ranked[0])),
    elapsedMs: Date.now() - started,
    ...extras,
  }
}

export async function searchBusiness(query: SearchQuery, rawKeys: ApiKeys): Promise<SearchResponse> {
  const started = Date.now()
  const keys = envKeys(rawKeys)
  const warnings: string[] = []
  const dfsReady = hasDataForSeo(keys)
  const scrappeyReady = hasScrappey(keys)

  if (!dfsReady && !scrappeyReady) {
    const sample = searchMockBusinesses(query)
    return finalize(
      query,
      sample,
      {
        mode: "sample",
        sources: { dataforseo: false, scrappey: false },
        warning:
          sample.length === 0
            ? "No listing matched that search. Try Franklin Barbecue in Austin, TX."
            : "This is a sample listing so you can see how PlaceFind presents a match.",
      },
      started,
    )
  }

  let hits: BusinessListing[] = []

  if (dfsReady) {
    const live = await searchDataForSeo(query, keys.dataforseoLogin!, keys.dataforseoPassword!)
    hits = live.hits
    if (live.error) warnings.push(publicCopy(live.error))
  }

  if (hits.length === 0 && scrappeyReady) {
    const scraped = await searchScrappey(query, keys.scrappeyKey!)
    hits = scraped.hits
    if (scraped.error) warnings.push(publicCopy(scraped.error))
  } else if (hits.length > 0 && scrappeyReady && keys.enrichWithScrappey !== false) {
    const ranked = rankListings(hits, query)
    const top = ranked[0]
    if (top) {
      const enriched = await enrichWithScrappey(keys.scrappeyKey!, top)
      if (enriched.error) warnings.push(publicCopy(`Listing page: ${enriched.error}`))
      hits = [enriched.listing, ...ranked.slice(1)]
    }
  }

  if (hits.length === 0) {
    return finalize(
      query,
      [],
      {
        mode: dfsReady || scrappeyReady ? "live" : "sample",
        sources: { dataforseo: dfsReady, scrappey: scrappeyReady },
        error: publicSearchMessage(warnings[0]) || "No Google Maps listings matched that name in this city.",
        warning: publicSearchMessage(warnings.slice(1).join(" ")),
      },
      started,
    )
  }

  return finalize(
    query,
    hits,
    {
      mode: dfsReady && scrappeyReady ? "live" : "partial",
      sources: { dataforseo: dfsReady, scrappey: scrappeyReady },
      warning: publicSearchMessage(warnings.join(" ")) || undefined,
    },
    started,
  )
}
