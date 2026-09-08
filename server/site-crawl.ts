import { randomBytes } from "node:crypto"
import { MAX_SITE_URLS, normalizeSiteUrls } from "../src/lib/business-facts.ts"
import { LISTING_MONTHLY_PRICE } from "../src/lib/pricing.ts"
import {
  extractPageSnippet,
  extractPageTitle,
  extractSameOriginLinks,
  extractSiteFacts,
  isSitemapDocument,
  parseSitemapDocument,
} from "../src/lib/site-facts.ts"
import { readHostedKeys } from "./hosted-keys.ts"
import { applyListingProfile, getListing, ListingError, listingsForUser, type DirectoryListing } from "./listings.ts"
import { fetchCrawledPage } from "./scrappey.ts"
import { readCollection, writeCollection } from "./store.ts"

export type CrawlJobStatus = "queued" | "running" | "ok" | "error"

export type CrawlPageResult = {
  url: string
  status: "ok" | "error"
  title: string
  snippet: string
  brand: string
  licenseInfo: string
  yearsInBusiness: string
  specialty: string
  error: string
}

export type CrawlJob = {
  id: string
  userId: string
  listingId: string
  websiteUrl: string
  status: CrawlJobStatus
  sitemapFound: boolean
  pagesCrawled: number
  pages: CrawlPageResult[]
  brand: string
  licenseInfo: string
  yearsInBusiness: string
  specialty: string
  article: string
  error: string
  createdAt: string
  finishedAt: string
}

export const MAX_PAGES = 120
export const MAX_SITEMAP_DOCS = 20
/** Public listing stores at most this many unique same-host page URLs. */
export { MAX_SITE_URLS }

function newId() {
  return randomBytes(8).toString("hex")
}

function nowIso() {
  return new Date().toISOString()
}

function asPage(row: Partial<CrawlPageResult> | null | undefined): CrawlPageResult | null {
  if (!row?.url) return null
  return {
    url: String(row.url),
    status: row.status === "error" ? "error" : "ok",
    title: String(row.title ?? ""),
    snippet: String(row.snippet ?? ""),
    brand: String(row.brand ?? ""),
    licenseInfo: String(row.licenseInfo ?? ""),
    yearsInBusiness: String(row.yearsInBusiness ?? ""),
    specialty: String(row.specialty ?? ""),
    error: String(row.error ?? ""),
  }
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
    pages: Array.isArray(row.pages) ? row.pages.flatMap((page) => {
      const next = asPage(page)
      return next ? [next] : []
    }) : [],
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

export function normalizeWebsite(raw: string): string {
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

export function crawlUrlKey(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ""
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.href
  } catch {
    return url.replace(/\/$/, "")
  }
}

export function sitemapSeedUrls(site: string): string[] {
  try {
    const url = new URL(site)
    return [`${url.origin}/sitemap.xml`, `${url.origin}/sitemap_index.xml`]
  } catch {
    return []
  }
}

export function isAssetUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase()
    return /\.(?:png|jpe?g|gif|webp|svg|ico|pdf|zip|mp4|mp3|css|js|mjs|woff2?|ttf|eot|json)$/i.test(path)
  } catch {
    return true
  }
}

export function isSameOrigin(site: string, url: string): boolean {
  try {
    return new URL(site).origin === new URL(url).origin
  } catch {
    return false
  }
}

export function pickCrawlUrls(home: string, sitemapLocs: string[], discovered: string[] = [], limit = MAX_PAGES): string[] {
  const ordered = [home, ...sitemapLocs, ...discovered]
  const seen = new Set<string>()
  const unique: string[] = []
  for (const url of ordered) {
    const normalized = normalizeWebsite(url)
    if (!normalized || isAssetUrl(normalized) || !isSameOrigin(home, normalized)) continue
    const key = crawlUrlKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(normalized)
    if (unique.length >= limit) break
  }
  return unique
}

export function pageResultFromText(url: string, text: string): CrawlPageResult {
  const facts = extractSiteFacts(text)
  return {
    url,
    status: "ok",
    title: extractPageTitle(text) || facts.brand,
    snippet: extractPageSnippet(text),
    brand: facts.brand,
    licenseInfo: facts.licenseInfo,
    yearsInBusiness: facts.yearsInBusiness,
    specialty: facts.specialty,
    error: "",
  }
}

export function pageResultFromError(url: string, error: string): CrawlPageResult {
  return {
    url,
    status: "error",
    title: "",
    snippet: "",
    brand: "",
    licenseInfo: "",
    yearsInBusiness: "",
    specialty: "",
    error: error || "Could not open that page.",
  }
}

type FetchPage = (url: string) => Promise<{ text: string; error: string | null }>

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

export async function collectSitemapUrls(
  site: string,
  fetchText: FetchPage,
  limit = MAX_PAGES,
): Promise<{ urls: string[]; sitemapFound: boolean }> {
  const queue = sitemapSeedUrls(site)
  const seenDocs = new Set<string>()
  const pages: string[] = []
  const seenPages = new Set<string>()
  let sitemapFound = false
  while (queue.length > 0 && seenDocs.size < MAX_SITEMAP_DOCS && pages.length < limit) {
    const next = queue.shift()
    if (!next) break
    const key = crawlUrlKey(next)
    if (seenDocs.has(key)) continue
    seenDocs.add(key)
    const fetched = await fetchText(next)
    if (!fetched.text || !isSitemapDocument(fetched.text)) continue
    sitemapFound = true
    const parsed = parseSitemapDocument(fetched.text)
    for (const nested of parsed.nested) {
      if (!isSameOrigin(site, nested)) continue
      queue.push(nested)
    }
    for (const url of parsed.pages) {
      if (!isSameOrigin(site, url) || isAssetUrl(url)) continue
      const pageKey = crawlUrlKey(url)
      if (seenPages.has(pageKey)) continue
      seenPages.add(pageKey)
      pages.push(url)
      if (pages.length >= limit) break
    }
  }
  return { urls: pages, sitemapFound }
}

export async function crawlWebsitePages(
  home: string,
  fetchText: FetchPage,
  options: {
    limit?: number
    onProgress?: (pages: CrawlPageResult[], sitemapFound: boolean) => void
  } = {},
): Promise<{ pages: CrawlPageResult[]; sitemapFound: boolean }> {
  const limit = options.limit ?? MAX_PAGES
  const site = normalizeWebsite(home)
  if (!site) return { pages: [], sitemapFound: false }
  const sitemap = await collectSitemapUrls(site, fetchText, limit)
  const queue = pickCrawlUrls(site, sitemap.urls, [], limit)
  const seen = new Set(queue.map(crawlUrlKey))
  const pages: CrawlPageResult[] = []

  while (queue.length > 0 && pages.length < limit) {
    const url = queue.shift()
    if (!url) break
    const fetched = await fetchText(url)
    if (fetched.text && isSitemapDocument(fetched.text)) {
      const parsed = parseSitemapDocument(fetched.text)
      for (const loc of [...parsed.nested, ...parsed.pages]) {
        if (!isSameOrigin(site, loc) || isAssetUrl(loc)) continue
        const key = crawlUrlKey(loc)
        if (seen.has(key) || queue.length + pages.length >= limit) continue
        seen.add(key)
        queue.push(loc)
      }
      continue
    }
    const page = fetched.text ? pageResultFromText(url, fetched.text) : pageResultFromError(url, fetched.error || "Could not open that page.")
    pages.push(page)
    options.onProgress?.(pages, sitemap.sitemapFound)
    if (!fetched.text) continue
    for (const link of extractSameOriginLinks(fetched.text, url)) {
      if (isAssetUrl(link) || !isSameOrigin(site, link)) continue
      const key = crawlUrlKey(link)
      if (seen.has(key) || pages.length + queue.length >= limit) continue
      seen.add(key)
      queue.push(link)
    }
  }

  return { pages, sitemapFound: sitemap.sitemapFound }
}

export function listingSiteUrlsFromPages(
  pages: Array<{ url: string }>,
  home: string,
  limit = MAX_SITE_URLS,
): string[] {
  return normalizeSiteUrls(
    pages.map((page) => page.url),
    home,
    limit,
  )
}

export function publicCrawl(job: CrawlJob) {
  return {
    id: job.id,
    listingId: job.listingId,
    websiteUrl: job.websiteUrl,
    status: job.status,
    sitemapFound: job.sitemapFound,
    pagesCrawled: job.pagesCrawled,
    pages: job.pages,
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

export function deleteCrawlsForUser(userId: string, listingIds: string[] = []) {
  const ids = new Set(listingIds)
  writeJobs(readJobs().filter((row) => row.userId !== userId && !ids.has(row.listingId)))
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
    const crawled = await crawlWebsitePages(running.websiteUrl, fetchPage, {
      limit: MAX_PAGES,
      onProgress: (pages, sitemapFound) => {
        saveJob({
          ...running,
          status: "running",
          sitemapFound,
          pagesCrawled: pages.filter((page) => page.status === "ok").length,
          pages,
        })
      },
    })
    const okPages = crawled.pages.filter((page) => page.status === "ok")
    if (okPages.length === 0) {
      throw new Error("Could not read the website. Check the address and try again.")
    }
    const urls = listingSiteUrlsFromPages(crawled.pages, running.websiteUrl || listing.website)
    const finished = saveJob({
      ...running,
      status: "ok",
      sitemapFound: crawled.sitemapFound,
      pagesCrawled: okPages.length,
      pages: crawled.pages,
      brand: "",
      licenseInfo: "",
      yearsInBusiness: "",
      specialty: "",
      article: "",
      error: "",
      finishedAt: nowIso(),
    })
    applyListingProfile(finished.listingId, {
      crawlStatus: "ok",
      lastCrawledAt: finished.finishedAt,
      profileSiteUrls: urls,
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
    pages: [],
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
): { urls: string[]; sitemapFound: boolean; pagesCrawled: number } {
  return {
    urls: listingSiteUrlsFromPages(
      pages.map((url) => ({ url })),
      listing.website || pages[0] || "",
    ),
    sitemapFound,
    pagesCrawled: pages.length,
  }
}
