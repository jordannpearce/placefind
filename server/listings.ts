import { randomBytes } from "node:crypto"
import { normalizeKeywords } from "../src/lib/keywords.ts"
import { mapsPlaceUrl } from "./match.ts"
import { toStateAbbr } from "./states.ts"
import { readCollection, writeCollection } from "./store.ts"
import type { BusinessListing, SearchQuery, SearchResponse } from "./types.ts"

export const SEED_OWNER_ID = "seed-directory"

export type MapsStatus = "pending" | "found" | "not_found"

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
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    ...(includeOwner ? { ownerUserId: listing.ownerUserId } : {}),
  }
}

export function seedDirectoryListings(force = false): DirectoryListing[] {
  const existing = readListings()
  if (existing.length > 0 && !force) return existing
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
