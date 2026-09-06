import { randomBytes } from "node:crypto"
import { LISTING_MONTHLY_PRICE } from "../src/lib/pricing.ts"
import { mergeSiteFacts, parseSitemapLocs, writeProfileArticle, type SiteFacts } from "../src/lib/site-facts.ts"
import { readHostedKeys } from "./hosted-keys.ts"
import { applyListingProfile, getListing, ListingError, listingsForUser, type DirectoryListing } from "./listings.ts"
import { fetchCrawledPage } from "./scrappey.ts"
import { readCollection, writeCollection } from "./store.ts"

export type CrawlJobStatus = "queued" | "running" | "ok" | "error"

export type CrawlJob = {
  id: string
  userId: string
  listingId: string
  websiteUrl: string
  status: CrawlJobStatus
  sitemapFound: boolean
  pagesCrawled: number
  brand: string
  licenseInfo: string
  yearsInBusiness: string
  specialty: string
  article: string
  error: string
  createdAt: string
  finishedAt: string
}

const MAX_PAGES = 6

function newId() {
  return randomBytes(8).toString("hex")
}

function nowIso() {
  return new Date().toISOString()
}

function asJob(row: Partial<CrawlJob> | null | undefined): CrawlJob | null {
  if (!row?.id || !row.listingId) return null
  return {
    id: String(row.id),
    userId: String(row.userId ?? ""),
    listingId: String(row.listingId),
    websiteUrl: String(row.websiteUrl ?? ""),
    status: row.status === "running" || row.status === "ok" || row.status === "error" || row.status === "queued" ? row.status : "queued",
    sitemapFound: Boolean(row.sitemapFound),
    pagesCrawled: Number(row.pagesCrawled) || 0,
    brand: String(row.brand ?? ""),
    licenseInfo: String(row.licenseInfo ?? ""),
    yearsInBusiness: String(row.yearsInBusiness ?? ""),
    specialty: String(row.specialty ?? ""),
    article: String(row.article ?? ""),
    error: String(row.error ?? ""),
    createdAt: String(row.createdAt ?? nowIso()),
    finishedAt: String(row.finishedAt ?? ""),
  }
}

function readJobs(): CrawlJob[] {
  return readCollection<CrawlJob>("crawls").flatMap((row) => {
    const job = asJob(row)
    return job ? [job] : []
  })
}

function writeJobs(rows: CrawlJob[]) {
  writeCollection("crawls", rows)
}

function saveJob(next: CrawlJob) {
  const rows = readJobs()
  writeJobs([next, ...rows.filter((row) => row.id !== next.id)])
  return next
}

function normalizeWebsite(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
    if (url.protocol !== "http:" && url.protocol !== "https:") return ""
    return url.href
  } catch {
    return ""
  }
}

function sitemapUrls(site: string): string[] {
  try {
    const url = new URL(site)
    return [`${url.origin}/sitemap.xml`, `${url.origin}/sitemap_index.xml`]
  } catch {
    return []
  }
}

function pickCrawlUrls(home: string, sitemapLocs: string[]): string[] {
  const preferred = sitemapLocs.filter((loc) =>
    /about|contact|license|licens|our-story|story|services|practice|menu/i.test(loc),
  )
  const rest = sitemapLocs.filter((loc) => !preferred.includes(loc))
  const ordered = [home, ...preferred, ...rest]
  const seen = new Set<string>()
  const unique: string[] = []
  for (const url of ordered) {
    const key = url.replace(/\/$/, "")
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(url)
    if (unique.length >= MAX_PAGES) break
  }
  return unique
}

async function fetchPage(url: string): Promise<{ text: string; error: string | null }> {
  const key = readHostedKeys().scrappeyKey
  if (key) {
    const crawled = await fetchCrawledPage(key, url, 180_000)
    if (crawled.text) return { text: crawled.text, error: null }
    if (crawled.error && !/empty/i.test(crawled.error)) {
      return { text: "", error: "Could not open that page." }
    }
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    const response = await fetch(url, {
      headers: { "User-Agent": "PlaceFindDirectory/1.0", Accept: "text/html,application/xml,text/plain" },
      signal: controller.signal,
    })
    clearTimeout(timer)
    const text = await response.text()
    if (!response.ok) return { text: "", error: "Could not open that page." }
    return { text, error: text.trim() ? null : "That page was empty." }
  } catch {
    return { text: "", error: "Could not open that page." }
  }
}

function finishFacts(listing: DirectoryListing, facts: SiteFacts): SiteFacts {
  return {
    brand: facts.brand || listing.brand || listing.name,
    licenseInfo: facts.licenseInfo || listing.licenseInfo,
    yearsInBusiness: facts.yearsInBusiness || listing.yearsInBusiness,
    specialty: facts.specialty || listing.specialty || listing.category,
  }
}

export function publicCrawl(job: CrawlJob) {
  return {
    id: job.id,
    listingId: job.listingId,
    websiteUrl: job.websiteUrl,
    status: job.status,
    sitemapFound: job.sitemapFound,
    pagesCrawled: job.pagesCrawled,
    brand: job.brand,
    licenseInfo: job.licenseInfo,
    yearsInBusiness: job.yearsInBusiness,
    specialty: job.specialty,
    article: job.article,
    error: job.error,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt || null,
    monthlyPrice: LISTING_MONTHLY_PRICE,
  }
}

export function crawlsForUser(userId: string, admin = false): CrawlJob[] {
  return readJobs()
    .filter((row) => admin || row.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getCrawl(id: string, userId: string, admin = false): CrawlJob {
  const job = readJobs().find((row) => row.id === id)
  if (!job) throw new ListingError(404, "That crawl request was not found.")
  if (!admin && job.userId !== userId) throw new ListingError(403, "You can only see crawls you requested.")
  return job
}

async function runCrawlJob(id: string) {
  const job = readJobs().find((row) => row.id === id)
  if (!job) return
  const running = saveJob({ ...job, status: "running" })
  applyListingProfile(running.listingId, { crawlStatus: "running" })
  try {
    const listing = getListing(running.listingId)
    const sitemapPages: string[] = []
    let sitemapFound = false
    for (const sitemap of sitemapUrls(running.websiteUrl)) {
      const fetched = await fetchPage(sitemap)
      if (!fetched.text) continue
      const locs = parseSitemapLocs(fetched.text)
      if (locs.length === 0) continue
      sitemapFound = true
      sitemapPages.push(...locs)
      break
    }
    const targets = pickCrawlUrls(running.websiteUrl, sitemapPages)
    const pages: string[] = []
    for (const url of targets) {
      const fetched = await fetchPage(url)
      if (fetched.text) pages.push(fetched.text)
    }
    if (pages.length === 0) {
      throw new Error("Could not read the website. Check the address and try again.")
    }
    const facts = finishFacts(listing, mergeSiteFacts(pages, listing.name))
    const article = writeProfileArticle(facts, listing)
    const finished = saveJob({
      ...running,
      status: "ok",
      sitemapFound,
      pagesCrawled: pages.length,
      brand: facts.brand,
      licenseInfo: facts.licenseInfo,
      yearsInBusiness: facts.yearsInBusiness,
      specialty: facts.specialty,
      article,
      error: "",
      finishedAt: nowIso(),
    })
    applyListingProfile(finished.listingId, {
      ...facts,
      profileContent: article,
      crawlStatus: "ok",
      lastCrawledAt: finished.finishedAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "The website crawl could not finish."
    saveJob({
      ...running,
      status: "error",
      error: /scrappey|dataforseo/i.test(message) ? "The website crawl could not finish." : message,
      finishedAt: nowIso(),
    })
    applyListingProfile(running.listingId, { crawlStatus: "error" })
  }
}

export function requestListingCrawl(listingId: string, userId: string, admin: boolean, website?: string): CrawlJob {
  const listing = getListing(listingId)
  if (!admin && listing.ownerUserId !== userId) {
    throw new ListingError(403, "You can only crawl a listing you created.")
  }
  const owned = listingsForUser(userId)
  if (!admin && !owned.some((row) => row.id === listingId)) {
    throw new ListingError(403, "You can only crawl a listing you created.")
  }
  const websiteUrl = normalizeWebsite(website || listing.website)
  if (!websiteUrl) throw new ListingError(400, "Add a website to the listing before you request a crawl.")
  const active = readJobs().find(
    (row) => row.listingId === listingId && (row.status === "queued" || row.status === "running"),
  )
  if (active) return active
  const job = saveJob({
    id: newId(),
    userId,
    listingId,
    websiteUrl,
    status: "queued",
    sitemapFound: false,
    pagesCrawled: 0,
    brand: "",
    licenseInfo: "",
    yearsInBusiness: "",
    specialty: "",
    article: "",
    error: "",
    createdAt: nowIso(),
    finishedAt: "",
  })
  applyListingProfile(listingId, { crawlStatus: "queued" })
  void runCrawlJob(job.id)
  return job
}

export function runCrawlFromPages(
  listing: DirectoryListing,
  pages: string[],
  sitemapFound = false,
): { facts: SiteFacts; article: string; sitemapFound: boolean; pagesCrawled: number } {
  const facts = finishFacts(listing, mergeSiteFacts(pages, listing.name))
  return {
    facts,
    article: writeProfileArticle(facts, listing),
    sitemapFound,
    pagesCrawled: pages.length,
  }
}
