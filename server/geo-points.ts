import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { pipeline } from "node:stream/promises"
import path from "node:path"
import { randomBytes } from "node:crypto"
import { createWriteStream } from "node:fs"
import {
  parseGeoCsv,
  parseGeoCsvFile,
  geoCsvMissingColumnsMessage,
  type GeoCsvPoint,
} from "./geo-csv.ts"
import { formatLocationCoordinate, gridCellZoom } from "./grid.ts"
import { toStateAbbr } from "./states.ts"
import { dataDir, storeDriver, storePool } from "./store.ts"

type GeoPoint = { lat: number; lng: number }
type GridPoint = { row: number; col: number; lat: number; lng: number; locationCoordinate?: string }

export type PinSource = "grid" | "city_gps"

export type StoredGeoPoint = GeoCsvPoint & { id: string }

export type GeoPointsMeta = {
  importedAt: string | null
  fileName: string
  pointCount: number
  cityCount: number
  available: boolean
}

export type CityGpsApplyResult = {
  points: GridPoint[]
  usedCityGps: boolean
  snappedCount: number
  cityPointCount: number
}

type GeoPointsFile = {
  importedAt: string | null
  fileName: string
  sourceCsv?: string
  points?: StoredGeoPoint[]
}

const MAX_IMPORT_POINTS = 250_000
const CITY_LOOKUP_CAP = 2_000

let points: StoredGeoPoint[] = []
let byCity = new Map<string, StoredGeoPoint[]>()
let byState = new Map<string, StoredGeoPoint[]>()
let meta: GeoPointsMeta = { importedAt: null, fileName: "", pointCount: 0, cityCount: 0, available: false }
let loaded = false

function newId(): string {
  return randomBytes(8).toString("hex")
}

export function cityKey(city: string, state: string): string {
  return `${toStateAbbr(state).toLowerCase()}|${city.trim().toLowerCase()}`
}

export function normalizePinSource(raw: unknown): PinSource {
  const value = String(raw ?? "").trim().toLowerCase()
  return value === "city_gps" || value === "city-gps" || value === "csv" ? "city_gps" : "grid"
}

export function milesBetween(a: GeoPoint, b: GeoPoint): number {
  const latDegPerMile = 1 / 69
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180)
  const cosLat = Math.cos(midLat)
  const lngDegPerMile = 1 / (69 * (Math.abs(cosLat) < 0.01 ? 0.01 : cosLat))
  const dLat = (a.lat - b.lat) / latDegPerMile
  const dLng = (a.lng - b.lng) / lngDegPerMile
  return Math.hypot(dLat, dLng)
}

export function nearestGeoPoints<T extends GeoPoint>(origin: GeoPoint, candidates: T[], limit: number): T[] {
  const n = Math.max(0, Math.floor(Number(limit) || 0))
  if (n === 0 || candidates.length === 0) return []
  return candidates
    .map((point) => ({ point, miles: milesBetween(origin, point) }))
    .sort((a, b) => a.miles - b.miles || a.point.lat - b.point.lat || a.point.lng - b.point.lng)
    .slice(0, n)
    .map((row) => row.point)
}

function rebuildIndex(next: StoredGeoPoint[]) {
  points = next
  byCity = new Map()
  byState = new Map()
  const cities = new Set<string>()
  for (const point of next) {
    const key = cityKey(point.city, point.state)
    cities.add(key)
    const cityBucket = byCity.get(key)
    if (cityBucket) cityBucket.push(point)
    else byCity.set(key, [point])
    const stateKey = toStateAbbr(point.state).toLowerCase()
    const stateBucket = byState.get(stateKey)
    if (stateBucket) stateBucket.push(point)
    else byState.set(stateKey, [point])
  }
  meta = {
    ...meta,
    pointCount: next.length,
    cityCount: cities.size,
    available: next.length > 0,
  }
}

function jsonFile() {
  return path.join(dataDir(), "geo-points.json")
}

function metaFile() {
  return path.join(dataDir(), "geo-points-meta.json")
}

function importedCsvPath() {
  return path.join(dataDir(), "uscities.csv")
}

function bundledUscitiesPath() {
  return path.resolve(process.cwd(), "data/uscities.csv")
}

function sampleCsvPath() {
  return path.resolve(process.cwd(), "data/us-cities-sample.csv")
}

function writeMetaFallback(sourceCsv = "") {
  mkdirSync(dataDir(), { recursive: true })
  const payload: GeoPointsFile = {
    importedAt: meta.importedAt,
    fileName: meta.fileName,
    sourceCsv,
  }
  writeFileSync(metaFile(), JSON.stringify(payload, null, 2))
}

function writeJsonFallback() {
  if (points.length > 2_000) {
    writeMetaFallback(existsSync(importedCsvPath()) ? importedCsvPath() : "")
    return
  }
  mkdirSync(dataDir(), { recursive: true })
  const payload: GeoPointsFile = {
    importedAt: meta.importedAt,
    fileName: meta.fileName,
    points,
  }
  writeFileSync(jsonFile(), JSON.stringify(payload))
}

async function copyCsvStream(fromPath: string) {
  mkdirSync(dataDir(), { recursive: true })
  const dest = importedCsvPath()
  if (path.resolve(fromPath) === path.resolve(dest)) return dest
  await pipeline(createReadStream(fromPath), createWriteStream(dest))
  return dest
}

function loadJsonFallback() {
  const compact = metaFile()
  const file = existsSync(compact) ? compact : jsonFile()
  if (!existsSync(file) && !existsSync(importedCsvPath())) {
    rebuildIndex([])
    meta = { importedAt: null, fileName: "", pointCount: 0, cityCount: 0, available: false }
    return
  }
  try {
    const payload = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as GeoPointsFile) : { importedAt: null, fileName: "", points: [] }
    const rows = Array.isArray(payload.points) ? payload.points : []
    meta = {
      importedAt: payload.importedAt ?? null,
      fileName: payload.fileName ?? "",
      pointCount: 0,
      cityCount: 0,
      available: false,
    }
    if (rows.length > 0) {
      rebuildIndex(
        rows.filter(
          (row) =>
            row &&
            Number.isFinite(row.lat) &&
            Number.isFinite(row.lng) &&
            String(row.city ?? "").trim() &&
            String(row.state ?? "").trim(),
        ),
      )
      return
    }
    rebuildIndex([])
  } catch {
    rebuildIndex([])
    meta = { importedAt: null, fileName: "", pointCount: 0, cityCount: 0, available: false }
  }
}

async function persistPostgres() {
  const pool = storePool()
  if (!pool) return
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("ALTER TABLE geo_points ADD COLUMN IF NOT EXISTS population INTEGER")
    await client.query("DELETE FROM geo_points")
    const chunkSize = 250
    for (let i = 0; i < points.length; i += chunkSize) {
      const chunk = points.slice(i, i + chunkSize)
      const values: string[] = []
      const params: unknown[] = []
      chunk.forEach((row, index) => {
        const offset = index * 8
        values.push(
          `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8})`,
        )
        params.push(row.id, row.city, row.state, row.lat, row.lng, row.zip ?? null, row.name ?? null, row.population ?? null)
      })
      await client.query(
        `INSERT INTO geo_points (id, city, state, lat, lng, zip, name, population) VALUES ${values.join(",")}`,
        params,
      )
    }
    await client.query("DELETE FROM geo_imports")
    await client.query(
      "INSERT INTO geo_imports (id, imported_at, file_name, point_count) VALUES ($1,$2,$3,$4)",
      ["current", meta.importedAt, meta.fileName, meta.pointCount],
    )
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

async function loadPostgres() {
  const pool = storePool()
  if (!pool) {
    loadJsonFallback()
    return
  }
  await pool.query("ALTER TABLE geo_points ADD COLUMN IF NOT EXISTS population INTEGER")
  const imported = await pool.query(
    `SELECT imported_at AS "importedAt", file_name AS "fileName", point_count AS "pointCount"
     FROM geo_imports WHERE id = 'current'`,
  )
  const rows = await pool.query(
    `SELECT id, city, state, lat, lng, zip, name, population FROM geo_points`,
  )
  meta = {
    importedAt: imported.rows[0]?.importedAt ? new Date(imported.rows[0].importedAt).toISOString() : null,
    fileName: imported.rows[0]?.fileName ?? "",
    pointCount: 0,
    cityCount: 0,
    available: false,
  }
  rebuildIndex(
    rows.rows.map((row) => ({
      id: String(row.id),
      city: String(row.city),
      state: toStateAbbr(String(row.state)),
      lat: Number(row.lat),
      lng: Number(row.lng),
      ...(row.zip ? { zip: String(row.zip) } : {}),
      ...(row.name ? { name: String(row.name) } : {}),
      ...(row.population != null && Number.isFinite(Number(row.population)) ? { population: Number(row.population) } : {}),
    })),
  )
}

function storedFromRows(rows: GeoCsvPoint[]): StoredGeoPoint[] {
  return rows.map((row) => ({
    id: newId(),
    city: row.city.trim(),
    state: toStateAbbr(row.state),
    lat: row.lat,
    lng: row.lng,
    ...(row.zip ? { zip: row.zip } : {}),
    ...(row.name ? { name: row.name } : {}),
    ...(row.population != null ? { population: row.population } : {}),
  }))
}

function adoptPoints(rows: GeoCsvPoint[], fileName = "") {
  if (rows.length > MAX_IMPORT_POINTS) {
    throw new Error(`That file has too many points. Import at most ${MAX_IMPORT_POINTS.toLocaleString()} rows.`)
  }
  meta = {
    importedAt: new Date().toISOString(),
    fileName: fileName.trim(),
    pointCount: 0,
    cityCount: 0,
    available: false,
  }
  rebuildIndex(storedFromRows(rows))
  loaded = true
  return geoPointsMeta()
}

export function resetGeoPointsForTests() {
  loaded = true
  rebuildIndex([])
  meta = { importedAt: null, fileName: "", pointCount: 0, cityCount: 0, available: false }
}

export function geoPointsMeta(): GeoPointsMeta {
  ensureLoaded()
  return { ...meta, available: meta.pointCount > 0 }
}

export function geoPointsAvailable(): boolean {
  ensureLoaded()
  return meta.pointCount > 0
}

export function listGeoPointsForCity(city: string, state: string): StoredGeoPoint[] {
  ensureLoaded()
  return byCity.get(cityKey(city, state)) ?? []
}

export function listNearbyGeoPoints(origin: GeoPoint, city: string, state: string, limit: number): StoredGeoPoint[] {
  ensureLoaded()
  const n = Math.max(0, Math.floor(Number(limit) || 0))
  if (n === 0) return []
  const exact = listGeoPointsForCity(city, state)
  if (exact.length >= n) return nearestGeoPoints(origin, exact, n)
  const stateKey = toStateAbbr(state).toLowerCase()
  const sameState = stateKey ? (byState.get(stateKey) ?? []) : []
  if (sameState.length >= n) return nearestGeoPoints(origin, sameState, n)
  if (sameState.length > exact.length) return nearestGeoPoints(origin, sameState, Math.min(n, sameState.length))
  return nearestGeoPoints(origin, points, n)
}

export function importGeoPoints(rows: GeoCsvPoint[], fileName = ""): GeoPointsMeta {
  const next = adoptPoints(rows, fileName)
  writeJsonFallback()
  if (storeDriver() === "postgres") {
    void persistPostgres().catch((error) => {
      console.error("PlaceFind could not persist city GPS points to Postgres.", error)
    })
  }
  return next
}

export async function importGeoPointsAndWait(rows: GeoCsvPoint[], fileName = ""): Promise<GeoPointsMeta> {
  const next = importGeoPoints(rows, fileName)
  const pool = storePool()
  if (storeDriver() === "postgres" && pool) {
    await persistPostgres()
  }
  return next
}

export function importGeoCsvText(csv: string, fileName = ""): { meta: GeoPointsMeta; skipped: number } {
  const parsed = parseGeoCsv(csv)
  if (parsed.points.length === 0) {
    const missing = geoCsvMissingColumnsMessage(parsed.columns)
    throw new Error(missing || "That CSV did not contain any usable city GPS points.")
  }
  mkdirSync(dataDir(), { recursive: true })
  if (csv.length < 15 * 1024 * 1024) {
    writeFileSync(importedCsvPath(), csv.startsWith("\uFEFF") ? csv : csv)
  }
  const next = adoptPoints(parsed.points, fileName)
  writeMetaFallback(importedCsvPath())
  if (storeDriver() === "postgres") {
    void persistPostgres().catch((error) => {
      console.error("PlaceFind could not persist city GPS points to Postgres.", error)
    })
  }
  return { meta: next, skipped: parsed.skipped }
}

export async function importGeoCsvFile(filePath: string, fileName = ""): Promise<{ meta: GeoPointsMeta; skipped: number }> {
  const parsed = await parseGeoCsvFile(filePath)
  if (parsed.points.length === 0) {
    const missing = geoCsvMissingColumnsMessage(parsed.columns)
    throw new Error(missing || "That CSV did not contain any usable city GPS points.")
  }
  const dest = await copyCsvStream(filePath)
  const next = adoptPoints(parsed.points, fileName || path.basename(filePath))
  writeMetaFallback(dest)
  if (storeDriver() === "postgres") {
    await persistPostgres().catch((error) => {
      console.error("PlaceFind could not persist city GPS points to Postgres.", error)
    })
  }
  return { meta: next, skipped: parsed.skipped }
}

export function importBundledSampleGeoPoints(): GeoPointsMeta {
  const file = sampleCsvPath()
  if (!existsSync(file)) {
    throw new Error("The sample city GPS file is missing.")
  }
  return importGeoCsvText(readFileSync(file, "utf8"), "us-cities-sample.csv").meta
}

export async function importBundledUscitiesGeoPoints(): Promise<GeoPointsMeta> {
  const file = bundledUscitiesPath()
  if (!existsSync(file)) {
    throw new Error("The US cities GPS file is missing. Upload it from Admin.")
  }
  return (await importGeoCsvFile(file, "uscities.csv")).meta
}

function layoutGeoPoints(picks: GeoPoint[], zoom: number): GridPoint[] {
  const size = Math.max(1, Math.ceil(Math.sqrt(picks.length)))
  return picks.map((pick, index) => ({
    row: Math.floor(index / size),
    col: index % size,
    lat: pick.lat,
    lng: pick.lng,
    locationCoordinate: formatLocationCoordinate(pick.lat, pick.lng, zoom),
  }))
}

export function applyCityGpsBackup(
  grid: GridPoint[],
  cityPoints: GeoPoint[],
  zoom: number,
  spacingMiles = 1,
): CityGpsApplyResult {
  const cityPointCount = cityPoints.length
  if (grid.length === 0 || cityPointCount === 0) {
    return { points: grid, usedCityGps: false, snappedCount: 0, cityPointCount }
  }

  const center = grid[Math.floor(grid.length / 2)] ?? grid[0]!
  const candidates = nearestGeoPoints(center, cityPoints, Math.min(grid.length, CITY_LOOKUP_CAP))
  const remaining = [...candidates]
  const maxSnapMiles = Math.max(spacingMiles * 2.5, 2)
  let snappedCount = 0

  const next = grid.map((cell) => {
    if (remaining.length === 0) return cell
    let bestIndex = -1
    let bestMiles = Infinity
    remaining.forEach((candidate, index) => {
      const miles = milesBetween(cell, candidate)
      if (miles < bestMiles) {
        bestMiles = miles
        bestIndex = index
      }
    })
    if (bestIndex < 0 || bestMiles > maxSnapMiles) return cell
    const pick = remaining.splice(bestIndex, 1)[0]!
    snappedCount += 1
    return {
      ...cell,
      lat: pick.lat,
      lng: pick.lng,
      locationCoordinate: formatLocationCoordinate(pick.lat, pick.lng, zoom),
    }
  })

  return {
    points: next,
    usedCityGps: snappedCount > 0,
    snappedCount,
    cityPointCount,
  }
}

export function resolveScanPoints(input: {
  center: GeoPoint
  city: string
  state: string
  gridSize: number
  spacingMiles: number
  zoom?: number
  pinSource?: PinSource | string
  buildGrid: (center: GeoPoint, gridSize: number, spacingMiles: number, zoom: number) => GridPoint[]
}): CityGpsApplyResult & { pinSource: PinSource; zoom: number } {
  const pinSource = normalizePinSource(input.pinSource)
  const zoom = input.zoom == null ? gridCellZoom(input.spacingMiles) : input.zoom
  const grid = input.buildGrid(input.center, input.gridSize, input.spacingMiles, zoom)
  const needed = grid.length
  if (pinSource !== "city_gps") {
    return {
      points: grid,
      usedCityGps: false,
      snappedCount: 0,
      cityPointCount: listGeoPointsForCity(input.city, input.state).length,
      pinSource,
      zoom,
    }
  }

  const exact = listGeoPointsForCity(input.city, input.state)
  if (exact.length >= needed) {
    const applied = applyCityGpsBackup(grid, exact, zoom, input.spacingMiles)
    return { ...applied, pinSource, zoom }
  }

  const nearby = listNearbyGeoPoints(input.center, input.city, input.state, needed)
  if (nearby.length >= needed) {
    return {
      points: layoutGeoPoints(nearby, zoom),
      usedCityGps: true,
      snappedCount: nearby.length,
      cityPointCount: nearby.length,
      pinSource,
      zoom,
    }
  }
  if (nearby.length === 0) {
    return { points: grid, usedCityGps: false, snappedCount: 0, cityPointCount: exact.length, pinSource, zoom }
  }
  const applied = applyCityGpsBackup(grid, nearby, zoom, input.spacingMiles)
  return { ...applied, cityPointCount: nearby.length, pinSource, zoom }
}

function ensureLoaded() {
  if (loaded) return
  loadJsonFallback()
  loaded = true
}

export async function initGeoPoints(): Promise<GeoPointsMeta> {
  if (storeDriver() === "postgres" && storePool()) {
    try {
      await loadPostgres()
      loaded = true
      if (points.length > 0) return geoPointsMeta()
    } catch (error) {
      console.warn("PlaceFind could not load city GPS points from Postgres. Using the local file.", error)
    }
  }
  loadJsonFallback()
  loaded = true
  if (points.length > 0) return geoPointsMeta()

  const imported = importedCsvPath()
  const bundled = bundledUscitiesPath()
  const source = existsSync(imported) ? imported : existsSync(bundled) ? bundled : ""
  if (source) {
    try {
      const result = await importGeoCsvFile(source, path.basename(source))
      return result.meta
    } catch (error) {
      console.warn("PlaceFind could not import the bundled US cities GPS file.", error)
    }
  }
  return geoPointsMeta()
}

export function usingCityGpsBackupNote() {
  return "Using city GPS backup"
}
