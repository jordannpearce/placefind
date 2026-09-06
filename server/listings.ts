import { randomBytes } from "node:crypto"
import { normalizeKeywords } from "../src/lib/keywords.ts"
import { LISTING_MONTHLY_PRICE } from "../src/lib/pricing.ts"
import { mapsPlaceUrl } from "./match.ts"
import { toStateAbbr } from "./states.ts"
import { readCollection, writeCollection } from "./store.ts"
import type { BusinessListing, SearchQuery, SearchResponse } from "./types.ts"

export const SEED_OWNER_ID = "seed-directory"

export type MapsStatus = "pending" | "found" | "not_found"
export type CrawlStatus = "idle" | "queued" | "running" | "ok" | "error"

export type DirectoryListing = {
  id: string
  ownerUserId: string
  name: string
  city: string
  state: string
  category: string
  keywords: string[]
  phone: string
  website: string
  hours: string
  placeId: string
  cid: string
  mapsStatus: MapsStatus
  mapsTitle: string
  mapsAddress: string
  monthlyPrice: number
  brand: string
  licenseInfo: string
  yearsInBusiness: string
  specialty: string
  profileContent: string
  crawlStatus: CrawlStatus
  lastCrawledAt: string
  createdAt: string
  updatedAt: string
}

export type ListingInput = {
  name?: string
  city?: string
  state?: string
  category?: string
  keywords?: string[] | string
  phone?: string
  website?: string
  hours?: string
}

export type ListingQuery = {
  name?: string
  city?: string
  state?: string
  keyword?: string
}

export class ListingError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ListingError"
    this.status = status
  }
}

const SEED_LISTINGS: Omit<DirectoryListing, "id" | "createdAt" | "updatedAt">[] = [
  {
    ownerUserId: SEED_OWNER_ID,
    name: "Harbor & Oak Bakery",
    city: "Portland",
    state: "ME",
    category: "Bakery",
    keywords: ["pastry", "coffee", "sourdough"],
    phone: "(207) 555-0142",
    website: "https://harborandoak.example",
    hours: "Tue–Sun 7:00 AM–3:00 PM",
    placeId: "sample-harbor-oak",
    cid: "sample-harbor-oak-cid",
    mapsStatus: "found",
    mapsTitle: "Harbor & Oak Bakery",
    mapsAddress: "18 Exchange St, Portland, ME 04101",
    monthlyPrice: LISTING_MONTHLY_PRICE,
    brand: "Harbor & Oak",
    licenseInfo: "License BAK-4418",
    yearsInBusiness: "Since 2014",
    specialty: "naturally leavened bread and morning pastry",
    profileContent:
      "Harbor & Oak is a bakery in Portland, ME. The shop has been open since 2014. License BAK-4418 is on file.\n\nHarbor & Oak specializes in naturally leavened bread and morning pastry.\n\nThis profile was written from the business website and the listing the owner published on PlaceFind. Reviews from visitors appear below the facts.",
    crawlStatus: "ok",
    lastCrawledAt: "2026-08-12T14:00:00.000Z",
  },
  {
    ownerUserId: SEED_OWNER_ID,
    name: "Red Mesa Dental",
    city: "Santa Fe",
    state: "NM",
    category: "Dentist",
    keywords: ["family dentist", "teeth cleaning"],
    phone: "(505) 555-0198",
    website: "https://redmesadental.example",
    hours: "Mon–Thu 8:00 AM–5:00 PM",
    placeId: "sample-red-mesa",
    cid: "sample-red-mesa-cid",
    mapsStatus: "found",
    mapsTitle: "Red Mesa Dental",
    mapsAddress: "412 Cerrillos Rd, Santa Fe, NM 87501",
    monthlyPrice: LISTING_MONTHLY_PRICE,
    brand: "Red Mesa Dental",
    licenseInfo: "License DDS-2201",
    yearsInBusiness: "12 years in business",
    specialty: "family dentistry and preventive cleanings",
    profileContent:
      "Red Mesa Dental is a dentist in Santa Fe, NM. 12 years in business. License DDS-2201 is on file.\n\nRed Mesa Dental specializes in family dentistry and preventive cleanings.\n\nThis profile was written from the business website and the listing the owner published on PlaceFind. Reviews from visitors appear below the facts.",
    crawlStatus: "ok",
    lastCrawledAt: "2026-08-12T14:00:00.000Z",
  },
  {
    ownerUserId: SEED_OWNER_ID,
    name: "Northside Bike Works",
    city: "Minneapolis",
    state: "MN",
    category: "Bicycle shop",
    keywords: ["bike repair", "tune up"],
    phone: "(612) 555-0164",
    website: "https://northsidebikes.example",
    hours: "Wed–Sat 10:00 AM–6:00 PM",
    placeId: "",
    cid: "",
    mapsStatus: "pending",
    mapsTitle: "",
    mapsAddress: "",
    monthlyPrice: LISTING_MONTHLY_PRICE,
    brand: "Northside Bike Works",
    licenseInfo: "",
    yearsInBusiness: "",
    specialty: "",
    profileContent: "",
    crawlStatus: "idle",
    lastCrawledAt: "",
  },
  {
    ownerUserId: SEED_OWNER_ID,
    name: "Citrus & Salt Seafood",
    city: "Tampa",
    state: "FL",
    category: "Seafood restaurant",
    keywords: ["oysters", "grouper sandwich"],
    phone: "(813) 555-0117",
    website: "https://citrusandsalt.example",
    hours: "Daily 11:30 AM–9:00 PM",
    placeId: "sample-citrus-salt",
    cid: "sample-citrus-salt-cid",
    mapsStatus: "found",
    mapsTitle: "Citrus & Salt Seafood",
    mapsAddress: "907 N Franklin St, Tampa, FL 33602",
    monthlyPrice: LISTING_MONTHLY_PRICE,
    brand: "Citrus & Salt",
    licenseInfo: "License FDBPR-9912",
    yearsInBusiness: "Since 2009",
    specialty: "Gulf oysters and grouper sandwiches",
    profileContent:
      "Citrus & Salt is a seafood restaurant in Tampa, FL. The shop has been open since 2009. License FDBPR-9912 is on file.\n\nCitrus & Salt specializes in Gulf oysters and grouper sandwiches.\n\nThis profile was written from the business website and the listing the owner published on PlaceFind. Reviews from visitors appear below the facts.",
    crawlStatus: "ok",
    lastCrawledAt: "2026-08-12T14:00:00.000Z",
  },
  {
    ownerUserId: SEED_OWNER_ID,
    name: "Copper Bell Books",
    city: "Asheville",
    state: "NC",
    category: "Bookstore",
    keywords: ["independent bookstore", "used books"],
    phone: "(828) 555-0133",
    website: "",
    hours: "Thu–Mon 11:00 AM–7:00 PM",
    placeId: "",
    cid: "",
    mapsStatus: "not_found",
    mapsTitle: "",
    mapsAddress: "",
    monthlyPrice: LISTING_MONTHLY_PRICE,
    brand: "Copper Bell Books",
    licenseInfo: "",
    yearsInBusiness: "Since 1998",
    specialty: "used and independent titles",
    profileContent:
      "Copper Bell Books is a bookstore in Asheville, NC. The shop has been open since 1998.\n\nCopper Bell Books specializes in used and independent titles.\n\nThis profile was written from the business website and the listing the owner published on PlaceFind. Reviews from visitors appear below the facts.",
    crawlStatus: "ok",
    lastCrawledAt: "2026-08-12T14:00:00.000Z",
  },
  {
    ownerUserId: SEED_OWNER_ID,
    name: "Lamppost Hardware",
    city: "Boise",
    state: "ID",
    category: "Hardware store",
    keywords: ["keys", "paint", "garden"],
    phone: "(208) 555-0188",
    website: "https://lampposthardware.example",
    hours: "Mon–Sat 8:00 AM–6:00 PM",
    placeId: "sample-lamppost",
    cid: "sample-lamppost-cid",
    mapsStatus: "found",
    mapsTitle: "Lamppost Hardware",
    mapsAddress: "2214 N 13th St, Boise, ID 83702",
    monthlyPrice: LISTING_MONTHLY_PRICE,
    brand: "Lamppost Hardware",
    licenseInfo: "License RET-118",
    yearsInBusiness: "40 years in business",
    specialty: "keys, paint, and garden hardware",
    profileContent:
      "Lamppost Hardware is a hardware store in Boise, ID. 40 years in business. License RET-118 is on file.\n\nLamppost Hardware specializes in keys, paint, and garden hardware.\n\nThis profile was written from the business website and the listing the owner published on PlaceFind. Reviews from visitors appear below the facts.",
    crawlStatus: "ok",
    lastCrawledAt: "2026-08-12T14:00:00.000Z",
  },
]

function newId() {
  return randomBytes(8).toString("hex")
}

function nowIso() {
  return new Date().toISOString()
}

function mapsStatusOf(value: unknown): MapsStatus {
  if (value === "found" || value === "not_found" || value === "pending") return value
  return "pending"
}

function crawlStatusOf(value: unknown): CrawlStatus {
  if (value === "queued" || value === "running" || value === "ok" || value === "error" || value === "idle") return value
  return "idle"
}

function asListing(row: Partial<DirectoryListing> | null | undefined): DirectoryListing | null {
  if (!row?.id || !row.name) return null
  return {
    id: String(row.id),
    ownerUserId: String(row.ownerUserId ?? ""),
    name: String(row.name),
    city: String(row.city ?? ""),
    state: toStateAbbr(String(row.state ?? "")) || String(row.state ?? ""),
    category: String(row.category ?? ""),
    keywords: normalizeKeywords(row.keywords),
    phone: String(row.phone ?? ""),
    website: String(row.website ?? ""),
    hours: String(row.hours ?? ""),
    placeId: String(row.placeId ?? ""),
    cid: String(row.cid ?? ""),
    mapsStatus: mapsStatusOf(row.mapsStatus),
    mapsTitle: String(row.mapsTitle ?? ""),
    mapsAddress: String(row.mapsAddress ?? ""),
    monthlyPrice: Number(row.monthlyPrice) > 0 ? Number(row.monthlyPrice) : LISTING_MONTHLY_PRICE,
    brand: String(row.brand ?? ""),
    licenseInfo: String(row.licenseInfo ?? ""),
    yearsInBusiness: String(row.yearsInBusiness ?? ""),
    specialty: String(row.specialty ?? ""),
    profileContent: String(row.profileContent ?? ""),
    crawlStatus: crawlStatusOf(row.crawlStatus),
    lastCrawledAt: String(row.lastCrawledAt ?? ""),
    createdAt: String(row.createdAt ?? nowIso()),
    updatedAt: String(row.updatedAt ?? row.createdAt ?? nowIso()),
  }
}

function readListings(): DirectoryListing[] {
  return readCollection<DirectoryListing>("listings").flatMap((row) => {
    const listing = asListing(row)
    return listing ? [listing] : []
  })
}

function writeListings(rows: DirectoryListing[]) {
  writeCollection("listings", rows)
}

function haystack(listing: DirectoryListing) {
  return [listing.name, listing.city, listing.state, listing.category, listing.keywords.join(" "), listing.mapsTitle, listing.mapsAddress]
    .join(" ")
    .toLowerCase()
}

export function validateListing(input: ListingInput): { value?: ListingInput; error?: string } {
  const name = input.name?.trim() ?? ""
  const city = input.city?.trim() ?? ""
  const state = toStateAbbr(input.state?.trim() ?? "") || (input.state?.trim() ?? "")
  const category = input.category?.trim() ?? ""
  const keywords = normalizeKeywords(input.keywords)
  const phone = input.phone?.trim() ?? ""
  const website = input.website?.trim() ?? ""
  const hours = input.hours?.trim() ?? ""
  if (name.length < 2) return { error: "Enter the business name." }
  if (city.length < 2) return { error: "Enter the city." }
  if (!state) return { error: "Choose a state." }
  return { value: { name, city, state, category, keywords, phone, website, hours } }
}

export function publicListing(listing: DirectoryListing, includeOwner = false) {
  return {
    id: listing.id,
    name: listing.name,
    city: listing.city,
    state: listing.state,
    category: listing.category,
    keywords: listing.keywords,
    phone: listing.phone,
    website: listing.website,
    hours: listing.hours,
    placeId: listing.placeId || null,
    cid: listing.cid || null,
    mapsStatus: listing.mapsStatus,
    mapsTitle: listing.mapsTitle,
    mapsAddress: listing.mapsAddress,
    mapsUrl: listing.placeId
      ? mapsPlaceUrl({
          title: listing.mapsTitle || listing.name,
          address: listing.mapsAddress,
          placeId: listing.placeId,
          cid: listing.cid,
        })
      : null,
    monthlyPrice: listing.monthlyPrice,
    brand: listing.brand,
    licenseInfo: listing.licenseInfo,
    yearsInBusiness: listing.yearsInBusiness,
    specialty: listing.specialty,
    profileContent: listing.profileContent,
    crawlStatus: listing.crawlStatus,
    lastCrawledAt: listing.lastCrawledAt || null,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    ...(includeOwner ? { ownerUserId: listing.ownerUserId } : {}),
  }
}

export function seedDirectoryListings(force = false): DirectoryListing[] {
  const existing = readListings()
  if (existing.length > 0 && !force) {
    const seeded = new Map(
      SEED_LISTINGS.map((row, index) => [
        `seed-${index + 1}`,
        { ...row, id: `seed-${index + 1}`, createdAt: existing.find((item) => item.id === `seed-${index + 1}`)?.createdAt ?? "2026-08-12T14:00:00.000Z", updatedAt: existing.find((item) => item.id === `seed-${index + 1}`)?.updatedAt ?? "2026-08-12T14:00:00.000Z" },
      ]),
    )
    let changed = false
    const next = existing.map((row) => {
      const fresh = seeded.get(row.id)
      if (!fresh || row.profileContent) return row
      changed = true
      return { ...row, ...fresh, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt }
    })
    if (changed) writeListings(next)
    return readListings()
  }
  const at = "2026-08-12T14:00:00.000Z"
  const seeded = SEED_LISTINGS.map((row, index) => ({
    ...row,
    id: `seed-${index + 1}`,
    createdAt: at,
    updatedAt: at,
  }))
  writeListings(force ? [...existing.filter((row) => !row.id.startsWith("seed-")), ...seeded] : seeded)
  return readListings()
}

export function listPublicListings(query: ListingQuery = {}): DirectoryListing[] {
  seedDirectoryListings()
  const name = query.name?.trim().toLowerCase() ?? ""
  const city = query.city?.trim().toLowerCase() ?? ""
  const state = (toStateAbbr(query.state?.trim() ?? "") || query.state?.trim() || "").toLowerCase()
  const keyword = query.keyword?.trim().toLowerCase() ?? ""
  return readListings()
    .filter((listing) => {
      if (name && !listing.name.toLowerCase().includes(name) && !haystack(listing).includes(name)) return false
      if (city && listing.city.toLowerCase() !== city && !listing.city.toLowerCase().includes(city)) return false
      if (state && listing.state.toLowerCase() !== state) return false
      if (keyword && !haystack(listing).includes(keyword)) return false
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getListing(id: string): DirectoryListing {
  const listing = readListings().find((row) => row.id === id)
  if (!listing) throw new ListingError(404, "That listing is not in the directory.")
  return listing
}

export function listingsForUser(userId: string): DirectoryListing[] {
  return readListings()
    .filter((row) => row.ownerUserId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function createListing(input: ListingInput, ownerUserId: string): DirectoryListing {
  const parsed = validateListing(input)
  if (parsed.error || !parsed.value) throw new ListingError(400, parsed.error || "Could not save the listing.")
  const at = nowIso()
  const listing: DirectoryListing = {
    id: newId(),
    ownerUserId,
    name: parsed.value.name ?? "",
    city: parsed.value.city ?? "",
    state: parsed.value.state ?? "",
    category: parsed.value.category ?? "",
    keywords: parsed.value.keywords ?? [],
    phone: parsed.value.phone ?? "",
    website: parsed.value.website ?? "",
    hours: parsed.value.hours ?? "",
    placeId: "",
    cid: "",
    mapsStatus: "pending",
    mapsTitle: "",
    mapsAddress: "",
    monthlyPrice: LISTING_MONTHLY_PRICE,
    brand: "",
    licenseInfo: "",
    yearsInBusiness: "",
    specialty: "",
    profileContent: "",
    crawlStatus: "idle",
    lastCrawledAt: "",
    createdAt: at,
    updatedAt: at,
  }
  writeListings([listing, ...readListings()])
  return listing
}

function assertCanEdit(listing: DirectoryListing, userId: string, admin: boolean) {
  if (admin || listing.ownerUserId === userId) return
  throw new ListingError(403, "You can only change a listing you created.")
}

export function updateListing(id: string, input: ListingInput, userId: string, admin = false): DirectoryListing {
  const current = getListing(id)
  assertCanEdit(current, userId, admin)
  const parsed = validateListing({ ...current, ...input })
  if (parsed.error || !parsed.value) throw new ListingError(400, parsed.error || "Could not save the listing.")
  const next: DirectoryListing = {
    ...current,
    name: parsed.value.name ?? current.name,
    city: parsed.value.city ?? current.city,
    state: parsed.value.state ?? current.state,
    category: parsed.value.category ?? current.category,
    keywords: parsed.value.keywords ?? current.keywords,
    phone: parsed.value.phone ?? current.phone,
    website: parsed.value.website ?? current.website,
    hours: parsed.value.hours ?? current.hours,
    updatedAt: nowIso(),
  }
  writeListings(readListings().map((row) => (row.id === id ? next : row)))
  return next
}

export function deleteListing(id: string, userId: string, admin = false) {
  const current = getListing(id)
  assertCanEdit(current, userId, admin)
  writeListings(readListings().filter((row) => row.id !== id))
}

export function listingSearchQuery(listing: Pick<DirectoryListing, "name" | "city" | "state" | "keywords">): SearchQuery {
  return {
    name: listing.name,
    city: listing.city,
    state: listing.state,
    keyword: listing.keywords[0] ?? "",
  }
}

export function applyMapsMatch(
  listing: DirectoryListing,
  match: { placeId?: string; cid?: string; title?: string; address?: string } | null,
  status: MapsStatus,
): DirectoryListing {
  const next: DirectoryListing = {
    ...listing,
    placeId: match?.placeId?.trim() ?? "",
    cid: match?.cid?.trim() ?? "",
    mapsTitle: match?.title?.trim() ?? "",
    mapsAddress: match?.address?.trim() ?? "",
    mapsStatus: status,
    updatedAt: nowIso(),
  }
  writeListings(readListings().map((row) => (row.id === listing.id ? next : row)))
  return next
}

export function confirmListingMatch(
  id: string,
  userId: string,
  admin: boolean,
  match: { placeId?: string; cid?: string; title?: string; address?: string; mapsStatus?: MapsStatus },
): DirectoryListing {
  const current = getListing(id)
  assertCanEdit(current, userId, admin)
  if (match.mapsStatus === "not_found") {
    return applyMapsMatch(current, null, "not_found")
  }
  const placeId = match.placeId?.trim() ?? ""
  if (!placeId) throw new ListingError(400, "Choose a Google Maps place to confirm.")
  return applyMapsMatch(
    current,
    { placeId, cid: match.cid, title: match.title, address: match.address },
    "found",
  )
}

export function applyListingProfile(
  id: string,
  input: {
    brand?: string
    licenseInfo?: string
    yearsInBusiness?: string
    specialty?: string
    profileContent?: string
    crawlStatus?: CrawlStatus
    lastCrawledAt?: string
  },
): DirectoryListing {
  const current = getListing(id)
  const next: DirectoryListing = {
    ...current,
    brand: input.brand?.trim() ?? current.brand,
    licenseInfo: input.licenseInfo?.trim() ?? current.licenseInfo,
    yearsInBusiness: input.yearsInBusiness?.trim() ?? current.yearsInBusiness,
    specialty: input.specialty?.trim() ?? current.specialty,
    profileContent: input.profileContent?.trim() ?? current.profileContent,
    crawlStatus: input.crawlStatus ?? current.crawlStatus,
    lastCrawledAt: input.lastCrawledAt ?? current.lastCrawledAt,
    updatedAt: nowIso(),
  }
  writeListings(readListings().map((row) => (row.id === id ? next : row)))
  return next
}

export async function verifyListingOnMaps(
  id: string,
  userId: string,
  admin: boolean,
  search: (query: SearchQuery) => Promise<SearchResponse>,
): Promise<{ listing: DirectoryListing; result: SearchResponse; candidates: BusinessListing[] }> {
  const current = getListing(id)
  assertCanEdit(current, userId, admin)
  const result = await search(listingSearchQuery(current))
  const candidates = [result.best, ...result.others].filter((row): row is BusinessListing => Boolean(row))
  if (candidates.length === 0) {
    const listing = applyMapsMatch(current, null, "not_found")
    return { listing, result, candidates }
  }
  const listing = current.mapsStatus === "found" ? current : applyMapsMatch(current, null, "pending")
  return { listing, result, candidates }
}
