export type SearchQuery = {
  name: string
  city: string
  state: string
}

export type ApiKeys = {
  scrappeyKey: string
  dataforseoLogin: string
  dataforseoPassword: string
  enrichWithScrappey: boolean
}

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
  source: "dataforseo" | "scrappey" | "sample"
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

export type HistoryItem = SearchQuery & {
  id: string
  at: string
  title?: string
}

export type KeyTestResult = {
  ok: boolean
  service: "dataforseo" | "scrappey"
  message: string
}

export type InstallerFile = {
  name: string
  size: number
  kind: "setup" | "portable" | "other"
  url: string
}

export type InstallerStatus = {
  status: "idle" | "running" | "ok" | "error"
  log: string
  error?: string
  startedAt?: string
  finishedAt?: string
  files: InstallerFile[]
  folder: string
  setupPath: string
}

export type ProductInfo = {
  name: string
  version: string
  price: string
  pitch: string
}

export type HostedKeyStatus = {
  included: boolean
  scrappey: boolean
  dataforseo: boolean
  scrappeyHint: string
  dataforseoHint: string
  seller: boolean
}

export type RuntimeInfo = {
  seller: boolean
  hosted: HostedKeyStatus
}
