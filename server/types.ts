export type SearchQuery = {
  name: string
  city: string
  state: string
  keyword?: string
}

export type ApiKeys = {
  scrappeyKey?: string
  dataforseoLogin?: string
  dataforseoPassword?: string
  enrichWithScrappey?: boolean
}

export type ListingSource = "dataforseo" | "scrappey" | "sample"

export type HoursRow = {
  day: string
  hours: string
}

export type BusinessListing = {
  title: string
  address: string
  city?: string
  state?: string
  phone?: string | null
  website?: string | null
  category?: string | null
  categories?: string[]
  rating?: number | null
  reviewCount?: number | null
  hours?: string | null
  hoursDetail?: HoursRow[]
  currentStatus?: string | null
  claimed?: boolean | null
  priceLevel?: string | null
  placeId?: string | null
  cid?: string | null
  lat?: number | null
  lng?: number | null
  mapsUrl: string
  image?: string | null
  source: ListingSource
  matchScore: number
  isBestMatch: boolean
}

export type SearchResponse = {
  query: SearchQuery
  best: BusinessListing | null
  others: BusinessListing[]
  mode: "live" | "sample" | "partial"
  sources: { dataforseo: boolean; scrappey: boolean }
  warning?: string
  error?: string
  elapsedMs: number
}

export type KeyTestResult = {
  ok: boolean
  service: "dataforseo" | "scrappey"
  message: string
  detail?: string
}
