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
  savedToDatabase?: boolean
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
  status: "active" | "suspended"
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

export type MailCampaignType = "welcome" | "activation" | "marketing" | "info" | "updates"

export type MailPreset = {
  type: MailCampaignType
  label: string
  subject: string
  text: string
}

export type OutboxRow = {
  id: string
  to: string
  subject: string
  createdAt?: string
  delivered: boolean
  detail: string
}

export type MailSendResult = {
  sent: number
  delivered: number
  held: number
  skipped: number
  outbox: OutboxRow[]
}

export type ImpersonatingInfo = {
  name: string
  email: string
}

export type RuntimeInfo = {
  seller: boolean
  store: boolean
  desktop: boolean
  admin: boolean
  bootstrap: boolean
  user: AuthUser | null
  impersonating?: ImpersonatingInfo | null
  hosted: HostedKeyStatus
  license: LicenseStatus
  keygen: KeygenStatus
  publicUrl?: string
}

export type GeoPoint = {
  lat: number
  lng: number
}

export type KeywordRank = {
  keyword: string
  rank: number | null
  listingTitle: string | null
  rating: number | null
  address: string | null
  mapsUrl: string | null
  scannedAt: string
  error?: string
}

export type GridPoint = {
  row: number
  col: number
  lat: number
  lng: number
  locationCoordinate?: string
}

export type RankChange = "up" | "down" | "same" | "new" | "lost"

export type GridPointResult = GridPoint & {
  keyword: string
  rank: number | null
  listingTitle: string | null
  rating: number | null
  reviewCount?: number | null
  address: string | null
  domain?: string | null
  placeId?: string | null
  cid?: string | null
  mapsUrl: string | null
  scannedAt: string
  error?: string
  status?: "rank" | "not_found" | "error" | "pending" | "unset"
  change?: RankChange
  previousRank?: number | null
}

export type ScanRun = {
  id: string
  scannedAt: string
  keywordCount: number
  foundCount: number
  results: KeywordRank[]
}

export type GridScanRun = {
  id: string
  campaignId?: string
  startedAt?: string
  finishedAt?: string
  scannedAt: string
  keyword: string
  gridSize: number
  spacingMiles: number
  zoom?: number
  center: GeoPoint
  placeId?: string | null
  pointCount: number
  foundCount: number
  points: GridPointResult[]
  status?: "running" | "ok" | "error"
}

export type ScanComparePin = {
  row: number
  col: number
  lat: number
  lng: number
  previousRank: number | null
  currentRank: number | null
  change: RankChange
}

export type ScanCompare = {
  previous: GridScanRun
  current: GridScanRun
  pins: ScanComparePin[]
  improved: number
  worse: number
  same: number
  added: number
  lost: number
}

export type ScheduleCadence = "daily" | "weekly"
export type ScheduleTimeZone = "local" | "utc"
export type TrafficPinMode = "selected" | "all_found"

export type ScanSchedule = {
  enabled: boolean
  cadence: ScheduleCadence
  hour: number
  minute: number
  weekday?: number
  timeZone: ScheduleTimeZone
  utcOffsetMinutes?: number
  lastRunAt?: string | null
  nextRunAt?: string | null
}

export type TrafficSchedule = ScanSchedule & {
  pinMode: TrafficPinMode
  lastSelectedPinIds: string[]
  lastSelectedKeywords?: string[]
  lastSearchCount?: number
}

export type Campaign = {
  id: string
  userId?: string
  name: string
  businessName: string
  city: string
  state: string
  placeId?: string
  listingTitle?: string
  listingAddress?: string
  keywords: string[]
  gridSize: number
  spacingMiles: number
  zoom?: number
  center: GeoPoint | null
  createdAt: string
  updatedAt: string
  lastScan: ScanRun | null
  lastGridScan: GridScanRun | null
  recentScans: ScanRun[]
  recentGridScans?: GridScanRun[]
  lastTrafficJob?: TrafficJob | null
  scanSchedule?: ScanSchedule
  trafficSchedule?: TrafficSchedule
}

export type TrafficJobStatus = "running" | "ok" | "error" | "stopped"

export type TrafficLogLine = {
  at: string
  message: string
  pinId?: string
  keyword?: string
}

export type TrafficPinResult = {
  pinId: string
  keyword?: string
  row: number
  col: number
  lat: number
  lng: number
  status: "pending" | "running" | "ok" | "fail" | "cancelled"
  finishedAt: string | null
}

export type TrafficJob = {
  id: string
  status: TrafficJobStatus
  startedAt: string
  finishedAt: string | null
  sessionsRequested: number
  sessionsAttempted: number
  sessionsOk: number
  sessionsFailed: number
  requestCount: number
  lastError: string | null
  pinIds?: string[]
  keywords?: string[]
  keywordIds?: string[]
  log?: TrafficLogLine[]
  results?: TrafficPinResult[]
}

export type CampaignInput = {
  name?: string
  businessName?: string
  city?: string
  state?: string
  keywords?: string[]
  placeId?: string
  listingTitle?: string
  listingAddress?: string
  gridSize?: number
  spacingMiles?: number
  zoom?: number
  center?: GeoPoint | null
  scanSchedule?: ScanSchedule | null
  trafficSchedule?: TrafficSchedule | null
}

export type ConfirmedListing = {
  title: string
  address: string
  rating?: number | null
  reviewCount?: number | null
  placeId: string
  lat: number
  lng: number
  city?: string
  state?: string
}
