import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { toStateAbbr } from "./states.ts"

export type GeoCsvPoint = {
  city: string
  state: string
  lat: number
  lng: number
  zip?: string
  name?: string
  population?: number
}

export type GeoCsvParseResult = {
  points: GeoCsvPoint[]
  skipped: number
  columns: {
    city?: string
    state?: string
    lat?: string
    lng?: string
    zip?: string
    name?: string
    gps?: string
    population?: string
  }
}

const CITY_ALIASES = ["city", "city_ascii", "town", "municipality", "locality", "place_city"]
const STATE_ALIASES = [
  "state",
  "st",
  "state_id",
  "state_abbreviation",
  "state_abbr",
  "state_code",
  "region",
  "province",
  "state_name",
]
const LAT_ALIASES = ["lat", "latitude", "y"]
const LNG_ALIASES = ["lng", "lon", "long", "longitude", "x"]
const GPS_ALIASES = ["gps", "coord", "coords", "coordinate", "coordinates", "location", "geo", "latlng", "lat_lng"]
const ZIP_ALIASES = ["zip", "zips", "zipcode", "zip_code", "postal", "postal_code", "postcode"]
const NAME_ALIASES = ["name", "place", "label", "title", "location_name", "point_name"]
const POPULATION_ALIASES = ["population", "pop", "city_population"]

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
}

function pickColumn(headers: string[], aliases: string[]): string | undefined {
  const normalized = headers.map(normalizeHeader)
  for (const alias of aliases) {
    const index = normalized.indexOf(alias)
    if (index >= 0) return headers[index]
  }
  return undefined
}

/** Split one CSV line, honoring quoted commas and escaped quotes. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

export function parseLatLngPair(raw: string): { lat: number; lng: number } | null {
  const text = String(raw ?? "").trim()
  if (!text) return null
  const match = text.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function cell(row: Record<string, string>, header?: string): string {
  if (!header) return ""
  return String(row[header] ?? "").trim()
}

export function mapGeoCsvColumns(headers: string[]): GeoCsvParseResult["columns"] {
  return {
    city: pickColumn(headers, CITY_ALIASES),
    state: pickColumn(headers, STATE_ALIASES),
    lat: pickColumn(headers, LAT_ALIASES),
    lng: pickColumn(headers, LNG_ALIASES),
    zip: pickColumn(headers, ZIP_ALIASES),
    name: pickColumn(headers, NAME_ALIASES),
    gps: pickColumn(headers, GPS_ALIASES),
    population: pickColumn(headers, POPULATION_ALIASES),
  }
}

function requiredColumnsReady(columns: GeoCsvParseResult["columns"]): boolean {
  return Boolean(columns.city && columns.state && ((columns.lat && columns.lng) || columns.gps))
}

export function pointFromGeoCsvRow(headers: string[], values: string[], columns: GeoCsvParseResult["columns"]): GeoCsvPoint | null {
  const row: Record<string, string> = {}
  headers.forEach((header, index) => {
    row[header] = values[index] ?? ""
  })

  const city = cell(row, columns.city)
  const state = toStateAbbr(cell(row, columns.state))
  const latText = cell(row, columns.lat)
  const lngText = cell(row, columns.lng)
  let lat = latText ? Number(latText) : Number.NaN
  let lng = lngText ? Number(lngText) : Number.NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const pair = parseLatLngPair(cell(row, columns.gps))
    if (pair) {
      lat = pair.lat
      lng = pair.lng
    }
  }
  if (!city || !state || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  const zip = cell(row, columns.zip)
  const name = cell(row, columns.name)
  const populationRaw = Number(cell(row, columns.population).replace(/,/g, ""))
  const population = Number.isFinite(populationRaw) && populationRaw >= 0 ? Math.round(populationRaw) : undefined
  return {
    city,
    state,
    lat,
    lng,
    ...(zip ? { zip } : {}),
    ...(name ? { name } : {}),
    ...(population != null ? { population } : {}),
  }
}

export function parseGeoCsv(text: string): GeoCsvParseResult {
  const raw = String(text ?? "").replace(/^\uFEFF/, "")
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) {
    return { points: [], skipped: 0, columns: {} }
  }

  const headers = splitCsvLine(lines[0]!)
  const columns = mapGeoCsvColumns(headers)
  if (!requiredColumnsReady(columns)) {
    return { points: [], skipped: Math.max(0, lines.length - 1), columns }
  }

  const points: GeoCsvPoint[] = []
  let skipped = 0
  for (const line of lines.slice(1)) {
    const point = pointFromGeoCsvRow(headers, splitCsvLine(line), columns)
    if (point) points.push(point)
    else skipped += 1
  }

  return { points, skipped, columns }
}

/** Stream a city GPS CSV from disk so a large US file is never held as one string. */
export async function parseGeoCsvFile(filePath: string): Promise<GeoCsvParseResult> {
  const stream = createReadStream(filePath, { encoding: "utf8" })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  let headers: string[] | null = null
  let columns: GeoCsvParseResult["columns"] = {}
  const points: GeoCsvPoint[] = []
  let skipped = 0
  let sawHeader = false

  try {
    for await (const rawLine of lines) {
      const line = (sawHeader ? rawLine : rawLine.replace(/^\uFEFF/, "")).trim()
      if (!line) continue
      if (!headers) {
        headers = splitCsvLine(line)
        columns = mapGeoCsvColumns(headers)
        sawHeader = true
        continue
      }
      if (!requiredColumnsReady(columns)) {
        skipped += 1
        continue
      }
      const point = pointFromGeoCsvRow(headers, splitCsvLine(line), columns)
      if (point) points.push(point)
      else skipped += 1
    }
  } finally {
    lines.close()
    stream.destroy()
  }

  if (!requiredColumnsReady(columns)) {
    return { points: [], skipped, columns }
  }
  return { points, skipped, columns }
}

export function geoCsvMissingColumnsMessage(columns: GeoCsvParseResult["columns"]): string {
  const missing: string[] = []
  if (!columns.city) missing.push("city")
  if (!columns.state) missing.push("state")
  if (!columns.lat && !columns.gps) missing.push("latitude")
  if (!columns.lng && !columns.gps) missing.push("longitude")
  if (missing.length === 0) return ""
  return `That CSV needs ${missing.join(", ")} columns. Use city, state, lat, and lng — latitude, longitude, gps, or coord also work.`
}
