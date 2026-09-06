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

export type LicenseStatus = {
  required: boolean
  configured: boolean
  valid: boolean
  keyHint: string
  code: string
  detail: string
  expiry: string | null
  seller: boolean
}

export type KeygenStatus = {
  accountId: string
  productId: string
  policyId: string
  tokenHint: string
  connected: boolean
  canIssue: boolean
}

export type IssuedLicense = {
  id: string
  key: string
  name: string
  email: string
  createdAt: string
  expiry: string | null
}

export type AuthUser = {
  id: string
  name: string
  email: string
  role: "customer" | "admin"
  createdAt: string
}

export type OrderInfo = {
  id: string
  name: string
  email: string
  amount: string
  status: "paid" | "pending_license"
  licenseKey: string | null
  createdAt: string
  emailedAt: string | null
}

export type MailStatus = {
  configured: boolean
  fromEmail: string
  fromName: string
  keyHint: string
}

export type RuntimeInfo = {
  seller: boolean
  store: boolean
  admin: boolean
  user: AuthUser | null
  hosted: HostedKeyStatus
  license: LicenseStatus
  keygen: KeygenStatus
}
