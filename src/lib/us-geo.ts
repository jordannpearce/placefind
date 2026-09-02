import cities from "@/data/us-cities.json"

import { normalizeName } from "./rank"

export type GeoKind = "city" | "state"

export type GeoMatch = {
  kind: GeoKind
  name: string
  matched: string
}

type Phrase = {
  kind: GeoKind
  name: string
  normalized: string
  tokenCount: number
}

const STATE_ENTRIES: Array<{ name: string; abbr: string }> = [
  { name: "Alabama", abbr: "AL" },
  { name: "Alaska", abbr: "AK" },
  { name: "Arizona", abbr: "AZ" },
  { name: "Arkansas", abbr: "AR" },
  { name: "California", abbr: "CA" },
  { name: "Colorado", abbr: "CO" },
  { name: "Connecticut", abbr: "CT" },
  { name: "Delaware", abbr: "DE" },
  { name: "District of Columbia", abbr: "DC" },
  { name: "Florida", abbr: "FL" },
  { name: "Georgia", abbr: "GA" },
  { name: "Hawaii", abbr: "HI" },
  { name: "Idaho", abbr: "ID" },
  { name: "Illinois", abbr: "IL" },
  { name: "Indiana", abbr: "IN" },
  { name: "Iowa", abbr: "IA" },
  { name: "Kansas", abbr: "KS" },
  { name: "Kentucky", abbr: "KY" },
  { name: "Louisiana", abbr: "LA" },
  { name: "Maine", abbr: "ME" },
  { name: "Maryland", abbr: "MD" },
  { name: "Massachusetts", abbr: "MA" },
  { name: "Michigan", abbr: "MI" },
  { name: "Minnesota", abbr: "MN" },
  { name: "Mississippi", abbr: "MS" },
  { name: "Missouri", abbr: "MO" },
  { name: "Montana", abbr: "MT" },
  { name: "Nebraska", abbr: "NE" },
  { name: "Nevada", abbr: "NV" },
  { name: "New Hampshire", abbr: "NH" },
  { name: "New Jersey", abbr: "NJ" },
  { name: "New Mexico", abbr: "NM" },
  { name: "New York", abbr: "NY" },
  { name: "North Carolina", abbr: "NC" },
  { name: "North Dakota", abbr: "ND" },
  { name: "Ohio", abbr: "OH" },
  { name: "Oklahoma", abbr: "OK" },
  { name: "Oregon", abbr: "OR" },
  { name: "Pennsylvania", abbr: "PA" },
  { name: "Rhode Island", abbr: "RI" },
  { name: "South Carolina", abbr: "SC" },
  { name: "South Dakota", abbr: "SD" },
  { name: "Tennessee", abbr: "TN" },
  { name: "Texas", abbr: "TX" },
  { name: "Utah", abbr: "UT" },
  { name: "Vermont", abbr: "VT" },
  { name: "Virginia", abbr: "VA" },
  { name: "Washington", abbr: "WA" },
  { name: "West Virginia", abbr: "WV" },
  { name: "Wisconsin", abbr: "WI" },
  { name: "Wyoming", abbr: "WY" },
]

const AMBIGUOUS_CITIES = new Set(
  [
    "mobile",
    "nice",
    "best",
    "normal",
    "reading",
    "orange",
    "enterprise",
    "national",
    "universal",
    "superior",
    "pioneer",
    "friendship",
    "welcome",
    "home",
    "love",
    "paradise",
    "opportunity",
    "progress",
    "commerce",
    "industry",
    "union",
    "deal",
    "price",
    "sale",
    "church",
    "center",
    "central",
    "north",
    "south",
    "east",
    "west",
    "city",
    "town",
    "valley",
    "hill",
    "park",
    "lake",
    "beach",
    "springs",
    "junction",
    "crossing",
    "heights",
    "manor",
    "grove",
    "mills",
    "mill",
    "falls",
    "point",
    "port",
    "fort",
    "mount",
    "village",
    "borough",
    "green",
    "white",
    "black",
    "blue",
    "red",
    "gold",
    "silver",
    "imperial",
    "royal",
    "american",
    "united",
    "independence",
    "liberty",
    "freedom",
    "hope",
    "peace",
    "mission",
    "summit",
    "ridge",
    "creek",
    "wood",
    "woods",
    "forest",
    "garden",
    "gardens",
    "view",
    "vista",
    "bay",
    "harbor",
    "island",
    "shore",
    "coast",
    "field",
    "fields",
    "plain",
    "plains",
    "rock",
    "stone",
    "oak",
    "pine",
    "elm",
    "maple",
    "cedar",
    "willow",
    "spring",
    "well",
    "wells",
    "gap",
    "pass",
    "gate",
    "corner",
    "station",
    "landing",
    "bridge",
    "camp",
    "ranch",
    "star",
    "sun",
    "eagle",
    "bear",
    "fox",
    "new",
    "old",
    "san",
    "los",
    "las",
    "la",
    "el",
    "saint",
    "st",
    "high",
    "low",
    "great",
    "grand",
    "little",
    "big",
    "young",
    "rich",
    "happy",
    "first",
    "prime",
    "choice",
    "quality",
    "standard",
    "general",
    "special",
    "express",
    "metro",
    "urban",
    "local",
    "global",
    "day",
    "care",
    "india",
    "china",
    "peru",
    "lebanon",
    "athens",
    "rome",
    "paris",
    "dublin",
    "moscow",
    "berlin",
    "vienna",
    "florence",
    "milan",
    "venice",
  ].map((word) => normalizeName(word))
)

const EXTRA_CITY_ALIASES: Array<{ name: string; alias: string }> = [
  { name: "New York", alias: "New York City" },
  { name: "New York", alias: "NYC" },
  { name: "Los Angeles", alias: "LA" },
  { name: "San Francisco", alias: "SF" },
  { name: "Washington", alias: "Washington DC" },
  { name: "Washington", alias: "Washington D.C." },
  { name: "Saint Louis", alias: "St. Louis" },
  { name: "Saint Louis", alias: "St Louis" },
  { name: "Saint Paul", alias: "St. Paul" },
  { name: "Saint Paul", alias: "St Paul" },
  { name: "Saint Petersburg", alias: "St. Petersburg" },
  { name: "Saint Petersburg", alias: "St Petersburg" },
]

const phrases: Phrase[] = []
const phraseIndex = new Map<string, Phrase[]>()

function addPhrase(kind: GeoKind, name: string, raw: string) {
  const normalized = normalizeName(raw)
  if (!normalized || normalized.length < 2) return
  const tokenCount = normalized.split(" ").length
  const existing = phraseIndex.get(normalized)
  if (existing?.some((item) => item.kind === kind && item.name === name)) return
  const phrase: Phrase = { kind, name, normalized, tokenCount }
  phrases.push(phrase)
  const bucket = phraseIndex.get(normalized) ?? []
  bucket.push(phrase)
  phraseIndex.set(normalized, bucket)
}

for (const state of STATE_ENTRIES) {
  addPhrase("state", state.name, state.name)
  addPhrase("state", state.name, state.abbr)
}

for (const city of cities as string[]) {
  addPhrase("city", city, city)
  if (/^saint /i.test(city)) {
    addPhrase("city", city, city.replace(/^saint /i, "St. "))
    addPhrase("city", city, city.replace(/^saint /i, "St "))
  }
  if (/^fort /i.test(city)) {
    addPhrase("city", city, city.replace(/^fort /i, "Ft. "))
    addPhrase("city", city, city.replace(/^fort /i, "Ft "))
  }
}

for (const alias of EXTRA_CITY_ALIASES) {
  addPhrase("city", alias.name, alias.alias)
}

const MAX_TOKENS = phrases.reduce((max, phrase) => Math.max(max, phrase.tokenCount), 1)

function isAmbiguousCity(normalized: string, tokenCount: number): boolean {
  if (tokenCount !== 1) return false
  if (normalized.length <= 2) return true
  return AMBIGUOUS_CITIES.has(normalized)
}

export function findGeoInName(title: string): GeoMatch[] {
  const normalized = normalizeName(title)
  if (!normalized) return []
  const tokens = normalized.split(" ").filter(Boolean)
  const found: GeoMatch[] = []
  const used = new Set<string>()

  const take = (phrase: Phrase) => {
    const key = `${phrase.kind}:${phrase.name}`
    if (used.has(key)) return
    used.add(key)
    found.push({
      kind: phrase.kind,
      name: phrase.name,
      matched: phrase.normalized,
    })
  }

  for (let i = 0; i < tokens.length; i += 1) {
    for (let size = Math.min(MAX_TOKENS, tokens.length - i); size >= 1; size -= 1) {
      const ngram = tokens.slice(i, i + size).join(" ")
      const hits = phraseIndex.get(ngram)
      if (!hits) continue
      for (const phrase of hits) {
        if (phrase.kind === "city" && isAmbiguousCity(phrase.normalized, phrase.tokenCount)) {
          continue
        }
        take(phrase)
      }
    }
  }

  const hasState = found.some((item) => item.kind === "state")
  if (hasState) {
    for (let i = 0; i < tokens.length; i += 1) {
      const hits = phraseIndex.get(tokens[i])
      if (!hits) continue
      for (const phrase of hits) {
        if (phrase.kind === "city" && isAmbiguousCity(phrase.normalized, phrase.tokenCount)) {
          take(phrase)
        }
      }
    }
  }

  return found.sort((a, b) => b.matched.length - a.matched.length)
}

export type GeoTitlePart = {
  text: string
  geo: boolean
  kind?: GeoKind
}

export function splitTitleByGeo(title: string): GeoTitlePart[] {
  const matches = findGeoInName(title)
  if (matches.length === 0) return [{ text: title, geo: false }]

  const ranges: Array<{ start: number; end: number; kind: GeoKind }> = []
  for (const match of matches) {
    const pattern = match.matched
      .split(" ")
      .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[\\s.,'-]+")
    const regex = new RegExp(`(?<![A-Za-z])${pattern}(?![A-Za-z])`, "ig")
    let found = regex.exec(title)
    if (!found && match.matched.length === 2) {
      const abbr = new RegExp(`(?<![A-Za-z])${match.matched}(?![A-Za-z])`, "ig")
      found = abbr.exec(title)
    }
    if (!found) continue
    ranges.push({
      start: found.index,
      end: found.index + found[0].length,
      kind: match.kind,
    })
  }

  ranges.sort((a, b) => a.start - b.start || b.end - a.end)
  const merged: typeof ranges = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range.start < last.end) continue
    merged.push(range)
  }

  if (merged.length === 0) return [{ text: title, geo: false }]

  const parts: GeoTitlePart[] = []
  let cursor = 0
  for (const range of merged) {
    if (range.start > cursor) {
      parts.push({ text: title.slice(cursor, range.start), geo: false })
    }
    parts.push({
      text: title.slice(range.start, range.end),
      geo: true,
      kind: range.kind,
    })
    cursor = range.end
  }
  if (cursor < title.length) {
    parts.push({ text: title.slice(cursor), geo: false })
  }
  return parts
}

export function geoLabel(matches: GeoMatch[]): string | null {
  if (matches.length === 0) return null
  const hasCity = matches.some((item) => item.kind === "city")
  const hasState = matches.some((item) => item.kind === "state")
  if (hasCity && hasState) return "City + state in name"
  if (hasCity) return "City in name"
  return "State in name"
}
