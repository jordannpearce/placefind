export const MAX_SITE_URLS = 80

export const BUSINESS_FACT_MAX: Record<BusinessFactKey, number> = {
  yearsInBusiness: 80,
  licenseInfo: 200,
  insuranceInfo: 200,
  priceOptions: 240,
  serviceArea: 200,
  paymentMethods: 200,
}

export const BUSINESS_FACT_FIELDS = [
  {
    key: "yearsInBusiness",
    label: "Year started",
    help: "The year you opened, such as 2014, or how long you have been in business.",
    placeholder: "2018",
  },
  {
    key: "licenseInfo",
    label: "License",
    help: "License number or the line neighbors should see.",
    placeholder: "City license 4418",
  },
  {
    key: "insuranceInfo",
    label: "Insurance",
    help: "Coverage you carry, such as general liability.",
    placeholder: "General liability on file",
  },
  {
    key: "priceOptions",
    label: "Price options",
    help: "A range, starting price, or how you charge.",
    placeholder: "Wheel classes from $65",
  },
  {
    key: "serviceArea",
    label: "Service area",
    help: "Neighborhoods or cities you serve.",
    placeholder: "South Austin and nearby",
  },
  {
    key: "paymentMethods",
    label: "Payment methods",
    help: "Cash, cards, or other ways you take payment.",
    placeholder: "Cash, Visa, Mastercard",
  },
] as const

export type BusinessFactKey = (typeof BUSINESS_FACT_FIELDS)[number]["key"]

export type ListingBusinessFacts = {
  [K in BusinessFactKey]: string
}

const ASSET_PATH = /\.(?:png|jpe?g|gif|webp|svg|ico|pdf|zip|mp4|mp3|css|js|mjs|woff2?|ttf|eot|json)$/i

export function emptyBusinessFacts(): ListingBusinessFacts {
  return {
    yearsInBusiness: "",
    licenseInfo: "",
    insuranceInfo: "",
    priceOptions: "",
    serviceArea: "",
    paymentMethods: "",
  }
}

function cleanFact(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
}

export function listingFactsFromInput(input: Partial<ListingBusinessFacts> | null | undefined): ListingBusinessFacts {
  const next = emptyBusinessFacts()
  for (const field of BUSINESS_FACT_FIELDS) {
    next[field.key] = cleanFact(input?.[field.key], BUSINESS_FACT_MAX[field.key])
  }
  return next
}

export function listingFactRows(
  listing: Partial<ListingBusinessFacts> | null | undefined,
): { key: BusinessFactKey; label: string; value: string }[] {
  return BUSINESS_FACT_FIELDS.flatMap((field) => {
    const value = String(listing?.[field.key] ?? "").trim()
    return value ? [{ key: field.key, label: field.label, value }] : []
  })
}

export function hasOwnerFacts(facts: Partial<ListingBusinessFacts> | null | undefined): boolean {
  return listingFactRows(facts).length > 0
}

export function factsChanged(
  current: Partial<ListingBusinessFacts> | null | undefined,
  next: ListingBusinessFacts,
): boolean {
  return BUSINESS_FACT_FIELDS.some((field) => String(current?.[field.key] ?? "").trim() !== next[field.key])
}

export function keepOwnerFact(
  current: string,
  incoming: string | undefined,
  profileCustomized: boolean,
): string {
  if (incoming == null) return current
  if (profileCustomized || current.trim()) return current
  return cleanFact(incoming, 240)
}

export function websiteOrigin(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).origin
  } catch {
    return ""
  }
}

function crawlUrlKey(url: URL): string {
  const next = new URL(url.href)
  next.hash = ""
  if (next.pathname !== "/" && next.pathname.endsWith("/")) {
    next.pathname = next.pathname.slice(0, -1)
  }
  return next.href
}

/** Unique http(s) pages on the same host. Skips assets. Caps at MAX_SITE_URLS (80). */
export function normalizeSiteUrls(urls: unknown, home = "", limit = MAX_SITE_URLS): string[] {
  const origin = websiteOrigin(home)
  const seen = new Set<string>()
  const unique: string[] = []
  const rows = Array.isArray(urls) ? urls : []
  for (const raw of rows) {
    const href = String(raw ?? "").trim()
    if (!href) continue
    try {
      const url = new URL(href)
      if (url.protocol !== "http:" && url.protocol !== "https:") continue
      if (ASSET_PATH.test(url.pathname)) continue
      if (origin && url.origin !== origin) continue
      const key = crawlUrlKey(url)
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(key)
      if (unique.length >= limit) break
    } catch {
      continue
    }
  }
  return unique
}
