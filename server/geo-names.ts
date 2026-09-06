import { toStateAbbr, toStateName } from "./states.ts"

export const GEO_NAME_RADIUS_MILES = 50
export const MIN_CITY_TOKEN_LENGTH = 3

export type GeoNameFlags = {
  geoCities: string[]
  usesStateName: boolean
  usesStateAbbr: boolean
}

export type GeoNameContext = {
  cities: string[]
  campaignCity: string
  state: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function hasWord(title: string, token: string): boolean {
  const needle = token.trim()
  if (!needle) return false
  return new RegExp(`\\b${escapeRegExp(needle)}\\b`, "i").test(title)
}

export function cityTokenAllowed(city: string, campaignCity: string): boolean {
  const name = city.trim()
  if (!name) return false
  if (name.length >= MIN_CITY_TOKEN_LENGTH) return true
  return name.toLowerCase() === campaignCity.trim().toLowerCase()
}

export function titleHasCityName(title: string, city: string, campaignCity: string): boolean {
  if (!cityTokenAllowed(city, campaignCity)) return false
  return hasWord(title, city)
}

export function titleHasStateName(title: string, state: string): boolean {
  const full = toStateName(state)
  return Boolean(full) && hasWord(title, full)
}

export function titleHasStateAbbr(title: string, state: string): boolean {
  const abbr = toStateAbbr(state)
  return Boolean(abbr) && hasWord(title, abbr)
}

export function flagGeoInName(title: string, context: GeoNameContext): GeoNameFlags {
  const seen = new Set<string>()
  const geoCities: string[] = []
  for (const city of context.cities) {
    const name = city.trim()
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    if (!titleHasCityName(title, name, context.campaignCity)) continue
    seen.add(key)
    geoCities.push(name)
  }
  return {
    geoCities,
    usesStateName: titleHasStateName(title, context.state),
    usesStateAbbr: titleHasStateAbbr(title, context.state),
  }
}

export function hasGeoInName(flags: Pick<GeoNameFlags, "geoCities" | "usesStateName" | "usesStateAbbr">): boolean {
  return flags.geoCities.length > 0 || flags.usesStateName || flags.usesStateAbbr
}
