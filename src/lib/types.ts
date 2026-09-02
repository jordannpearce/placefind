export type GridSize = 3 | 5 | 7 | 9 | 11 | 13

export type ScheduleCadence = "manual" | "daily" | "weekly"

export type DeviceType = "desktop" | "mobile"

export type ScanMode = "live" | "mock"

export type GridPoint = {
  id: string
  row: number
  col: number
  lat: number
  lng: number
}

export type Listing = {
  rankAbsolute: number
  rankGroup: number
  type: "maps_search" | "maps_paid_item"
  title: string
  domain: string | null
  address: string | null
  placeId: string | null
  cid: string | null
  phone: string | null
  category: string | null
  rating: number | null
  reviews: number | null
  latitude: number | null
  longitude: number | null
  url: string | null
  isPaid: boolean
}

export type PointResult = {
  id: string
  lat: number
  lng: number
  locationCoordinate: string
  rank: number | null
  found: boolean
  listings: Listing[]
  error: string | null
}

export type ScanRequest = {
  keyword: string
  targetBusiness: string
  targetPlaceId?: string
  lat: number
  lng: number
  zoom: number
  languageCode: string
  device: DeviceType
  depth: number
  forceMock?: boolean
}

export type ScanPointResponse = PointResult & {
  mode: ScanMode
}

export type GeocodeHit = {
  label: string
  lat: number
  lng: number
}

export type CompetitorStat = {
  title: string
  placeId: string | null
  appearances: number
  averageRank: number
  top3Share: number
  rating: number | null
  reviews: number | null
}

export type ScanStats = {
  points: number
  completed: number
  found: number
  notFound: number
  errors: number
  averageRank: number | null
  atr: number | null
  top3Share: number
  coverage: number
  competitors: CompetitorStat[]
}

export type ScanConfig = {
  keywords: string[]
  activeKeyword: string
  targetBusiness: string
  targetPlaceId: string
  businessCity: string
  businessState: string
  mapsUrl: string
  locationLabel: string
  center: { lat: number; lng: number }
  gridSize: GridSize
  radiusMiles: number
  spacingMiles: number
  zoom: number
  languageCode: string
  device: DeviceType
  depth: number
  forceMock: boolean
  schedule: ScheduleCadence
}

export type ApiSettings = {
  login: string
  password: string
}

export type BusinessCandidate = {
  title: string
  address: string
  city: string
  state: string
  lat: number
  lng: number
  placeId: string | null
  mapsUrl: string
  source: "maps" | "directory" | "demo"
}

export type Campaign = {
  id: string
  name: string
  brand: string
  keywords: string[]
  activeKeyword: string
  businessName: string
  businessCity: string
  businessState: string
  placeId: string
  mapsUrl: string
  locationLabel: string
  center: { lat: number; lng: number }
  gridSize: GridSize
  radiusMiles: number
  languageCode: string
  device: DeviceType
  schedule: ScheduleCadence
  createdAt: string
  lastScanAt: string | null
  nextScanAt: string | null
}

export type KeywordResults = Record<string, Record<string, PointResult>>

export type KeywordStatRow = {
  keyword: string
  stats: ScanStats
}
