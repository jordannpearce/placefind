import type {
  AiBrand,
  AiCompetitor,
  AiCompetitorHit,
  AiEngineId,
  AiMatchSignals,
  AiModelResult,
  AiSource,
  ScanMode,
} from "./types"

export const AI_ENGINES: Array<{ id: AiEngineId; label: string }> = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "perplexity", label: "Perplexity" },
  { id: "gemini", label: "Gemini" },
  { id: "copilot", label: "Copilot" },
  { id: "aimode", label: "Google AI Mode" },
  { id: "grok", label: "Grok" },
]

const CLORO_BASE = "https://api.cloro.dev/v1/monitor"

type CloroSource = {
  position?: number
  url?: string
  label?: string
  description?: string
}

type CloroResult = {
  text?: string
  markdown?: string
  sources?: CloroSource[]
}

export type BrandCheck = Pick<AiBrand, "name" | "address" | "phone" | "website" | "domain" | "competitors"> &
  Partial<Pick<AiBrand, "street" | "city" | "state" | "zip" | "location">>

function needle(value: string) {
  return value.trim().toLowerCase()
}

function includesTerm(haystack: string, term: string) {
  const t = needle(term)
  if (!t || t.length < 2) return false
  return haystack.includes(t)
}

function domainInUrl(url: string, domain: string) {
  const d = needle(domain)
  if (!d) return false
  return needle(url).includes(d)
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "")
}

function phoneMentioned(haystack: string, phone: string) {
  const want = digitsOnly(phone)
  if (want.length < 7) return false
  const hay = digitsOnly(haystack)
  if (hay.includes(want)) return true
  const last10 = want.slice(-10)
  return last10.length >= 10 && hay.includes(last10)
}

function addressMentioned(haystack: string, address: string) {
  const raw = needle(address)
  if (!raw) return false
  if (haystack.includes(raw)) return true
  const parts = raw.split(/[,\s]+/).filter((part) => part.length > 1)
  const number = parts.find((part) => /^\d/.test(part))
  const street = parts.find((part) => /^[a-z]/.test(part) && !/^(st|ave|rd|dr|blvd|ln|ct|ste|suite|north|south|east|west)$/.test(part))
  if (number && street) return haystack.includes(number) && haystack.includes(street)
  return false
}

function excerptAround(text: string, term: string) {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(term.toLowerCase())
  if (idx < 0) return text.slice(0, 220).trim()
  const start = Math.max(0, idx - 80)
  const end = Math.min(text.length, idx + term.length + 140)
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`
}

function firstMentionIndex(text: string, terms: string[]) {
  const lower = text.toLowerCase()
  let best = Number.POSITIVE_INFINITY
  for (const term of terms) {
    const t = term.toLowerCase()
    if (!t) continue
    const idx = lower.indexOf(t)
    if (idx >= 0 && idx < best) best = idx
  }
  return Number.isFinite(best) ? best : -1
}

function emptySignals(): AiMatchSignals {
  return { name: false, address: false, phone: false, website: false }
}

export function analyzeAnswer(input: {
  engine: AiEngineId
  label: string
  text: string
  sources: CloroSource[]
  brand: BrandCheck
  error?: string | null
}): AiModelResult {
  const text = input.text || ""
  const sourceBlob = input.sources.map((source) => `${source.label || ""} ${source.url || ""}`).join(" ")
  const haystack = `${text} ${sourceBlob}`.toLowerCase()
  const domain = input.brand.domain || needle(input.brand.website).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
  const addressHay = [
    input.brand.address,
    input.brand.street,
    [input.brand.city, input.brand.state].filter(Boolean).join(" "),
    input.brand.zip,
  ]
    .filter(Boolean)
    .join(" ")
  const signals: AiMatchSignals = {
    name: includesTerm(haystack, input.brand.name),
    address: addressMentioned(haystack, addressHay || input.brand.address),
    phone: phoneMentioned(`${text} ${sourceBlob}`, input.brand.phone),
    website: Boolean(domain) && (domainInUrl(haystack, domain) || includesTerm(haystack, domain)),
  }
  const mentioned = signals.name || signals.address || signals.phone || signals.website
  const sources: AiSource[] = input.sources.slice(0, 12).map((source, index) => {
    const url = source.url || ""
    return {
      position: typeof source.position === "number" ? source.position : index + 1,
      url,
      label: source.label || url || `Source ${index + 1}`,
      description: source.description || "",
      citesBrand:
        domainInUrl(url, domain) ||
        includesTerm(`${source.label || ""} ${url}`, input.brand.name) ||
        addressMentioned(`${source.label || ""} ${url} ${source.description || ""}`.toLowerCase(), input.brand.address),
    }
  })
  const cited = sources.some((source) => source.citesBrand)
  const names = [
    { name: input.brand.name, domain, isBrand: true },
    ...input.brand.competitors.map((competitor) => ({ ...competitor, isBrand: false })),
  ]
  const ranked = names
    .map((item) => ({
      ...item,
      index: firstMentionIndex(text, [item.name, item.domain].filter(Boolean)),
    }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
  const mentionRank = ranked.findIndex((item) => item.isBrand) + 1 || null
  const excerptTerm =
    (signals.name && input.brand.name) ||
    (signals.website && domain) ||
    (signals.address && input.brand.address) ||
    (signals.phone && input.brand.phone) ||
    input.brand.name

  const watched = input.brand.competitors.map((competitor) => ({
    name: competitor.name,
    domain: competitor.domain,
    mentioned:
      includesTerm(haystack, competitor.name) || domainInUrl(haystack, competitor.domain),
    cited: sources.some(
      (source) =>
        domainInUrl(source.url, competitor.domain) || includesTerm(source.label, competitor.name)
    ),
  }))

  return {
    engine: input.engine,
    label: input.label,
    mentioned,
    cited,
    mentionRank: mentioned ? mentionRank || 1 : null,
    signals,
    excerpt: mentioned ? excerptAround(text, excerptTerm) : text.slice(0, 220).trim(),
    answer: clipAnswer(text),
    sources,
    competitors: [...watched, ...discoveredCompetitors({ text, haystack, sources, brand: input.brand, watched })],
    error: input.error || null,
  }
}

export function clipAnswer(text: string) {
  return text.trim().slice(0, 4000)
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

function looksLikeDirectory(label: string, url: string) {
  return /wikipedia|yelp|tripadvisor|facebook|instagram|bbb\.org|angi\.com|thumbtack|yellowpages|superpages|nextdoor|google\.com|maps\.google|local directory|local listings|official site/.test(
    `${label} ${url}`.toLowerCase()
  )
}

function discoveredCompetitors(input: {
  text: string
  haystack: string
  sources: AiSource[]
  brand: BrandCheck
  watched: AiCompetitorHit[]
}): AiCompetitorHit[] {
  const skip = new Set(
    [input.brand.name, input.brand.domain, ...input.watched.map((item) => item.name), ...input.watched.map((item) => item.domain)]
      .map((item) => needle(item))
      .filter(Boolean)
  )
  const extras: AiCompetitorHit[] = []
  for (const source of input.sources) {
    if (source.citesBrand) continue
    const label = (source.label || "").replace(/\s+[—-].*$/, "").trim()
    const host = sourceHost(source.url)
    if (looksLikeDirectory(label, source.url)) continue
    const name = label.length >= 2 && label.length <= 80 ? label : host
    if (!name || skip.has(needle(name)) || skip.has(needle(host))) continue
    if (includesTerm(name, input.brand.name) || includesTerm(input.brand.name, name)) continue
    extras.push({
      name,
      domain: host,
      mentioned: includesTerm(input.haystack, name) || domainInUrl(input.haystack, host),
      cited: true,
    })
    skip.add(needle(name))
    if (host) skip.add(needle(host))
    if (extras.length >= 8) break
  }
  return extras
}

export function scanBrandShowing(models: AiModelResult[]) {
  return models.some((model) => model.mentioned)
}

export function scanCompetitorsShowing(models: AiModelResult[]) {
  const names = new Map<string, AiCompetitorHit>()
  for (const model of models) {
    for (const item of model.competitors) {
      if (!item.mentioned && !item.cited) continue
      const key = needle(item.name) || needle(item.domain)
      if (!key) continue
      const prev = names.get(key)
      names.set(key, {
        name: prev?.name || item.name,
        domain: prev?.domain || item.domain,
        mentioned: Boolean(prev?.mentioned || item.mentioned),
        cited: Boolean(prev?.cited || item.cited),
      })
    }
  }
  return Array.from(names.values())
}

function mockAnswer(engine: AiEngineId, brand: BrandCheck) {
  const rival = brand.competitors[0]?.name || "a nearby competitor"
  const where = brand.address ? ` at ${brand.address}` : ""
  const phone = brand.phone ? ` Call ${brand.phone}.` : ""
  const site = brand.website || brand.domain
  const siteLine = site ? ` Their site is ${site}.` : ""
  const templates: Record<AiEngineId, string> = {
    chatgpt: `A common recommendation is ${brand.name}${where}.${phone}${siteLine} ${rival} is a frequent alternative.`,
    perplexity: `Guides often name ${brand.name}${where}.${siteLine} Reviewers also mention ${rival}.${phone}`,
    gemini: `If you want that business, ${brand.name} is frequently recommended${where}.${phone}${siteLine} ${rival} shows up in the same lists.`,
    copilot: `People asking locally often hear ${brand.name} first${where}.${siteLine} ${rival} appears in the same shortlists.${phone}`,
    aimode: `${brand.name} is a typical answer${where}, with ${rival} listed just behind.${siteLine}${phone}`,
    grok: `Short version: ${brand.name} still gets named${where}.${phone}${siteLine} ${rival} wins some leftover mentions.`,
  }
  return templates[engine]
}

function mockSources(brand: BrandCheck): CloroSource[] {
  const domain = brand.domain || needle(brand.name).replace(/[^a-z0-9]+/g, "") + ".com"
  const rival = brand.competitors[0]
  return [
    {
      position: 1,
      url: brand.website?.startsWith("http") ? brand.website : `https://${domain}`,
      label: `${brand.name} — official site`,
      description: [brand.address, brand.phone].filter(Boolean).join(" · ") || "Official listing.",
    },
    {
      position: 2,
      url: "https://example.com/local-directory",
      label: `Local directory listing for ${brand.name}`,
      description: brand.address || `A roundup that names ${brand.name}.`,
    },
    rival
      ? {
          position: 3,
          url: rival.domain ? `https://${rival.domain}` : "https://competitor.example",
          label: rival.name,
          description: "Competitor homepage.",
        }
      : {
          position: 3,
          url: "https://maps.example/listings",
          label: "Local listings",
          description: "Directory of nearby businesses.",
        },
  ]
}

export function mockCloroScan(input: { brand: BrandCheck; engines?: AiEngineId[] }): AiModelResult[] {
  const engines = input.engines?.length ? input.engines : AI_ENGINES.map((item) => item.id)
  return engines.map((engine) => {
    const meta = AI_ENGINES.find((item) => item.id === engine) ?? { id: engine, label: engine }
    return analyzeAnswer({
      engine,
      label: meta.label,
      text: mockAnswer(engine, input.brand),
      sources: mockSources(input.brand),
      brand: input.brand,
    })
  })
}

function engineGeoBody(input: {
  engine: AiEngineId
  prompt: string
  country: string
  location?: string
  state?: string
}) {
  const body: Record<string, unknown> = {
    prompt: input.prompt,
    country: input.country,
    include: { markdown: true },
  }
  if (input.engine === "aimode" && input.location) {
    body.location = input.location
  } else if (input.state) {
    body.state = input.state
  }
  return body
}

async function fetchEngine(input: {
  apiKey: string
  engine: AiEngineId
  prompt: string
  country: string
  location?: string
  state?: string
}): Promise<CloroResult> {
  const response = await fetch(`${CLORO_BASE}/${input.engine}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      engineGeoBody({
        engine: input.engine,
        prompt: input.prompt,
        country: input.country,
        location: input.location,
        state: input.state,
      })
    ),
    signal: AbortSignal.timeout(120_000),
  })
  const data = (await response.json().catch(() => null)) as
    | { success?: boolean; result?: CloroResult; error?: string; message?: string }
    | null
  if (!response.ok || !data?.result) {
    const message =
      data?.error || data?.message || `This model could not be scanned (${response.status}).`
    throw new Error(message)
  }
  return data.result
}

export async function resolveCloroApiKey(saved: string) {
  return saved.trim() || process.env.CLORO_API_KEY?.trim() || ""
}

export async function runCloroPrompt(input: {
  apiKey: string
  prompt: string
  country: string
  brand: BrandCheck
  engines?: AiEngineId[]
  location?: string
}): Promise<{ mode: ScanMode; models: AiModelResult[] }> {
  const engines = input.engines?.length ? input.engines : AI_ENGINES.map((item) => item.id)
  const key = input.apiKey.trim()
  if (!key) {
    return {
      mode: "mock",
      models: mockCloroScan({ brand: input.brand, engines }),
    }
  }

  const settled = await Promise.allSettled(
    engines.map(async (engine) => {
      const meta = AI_ENGINES.find((item) => item.id === engine) ?? { id: engine, label: engine }
      const result = await fetchEngine({
        apiKey: key,
        engine,
        prompt: input.prompt,
        country: input.country,
        location: input.location || input.brand.location,
        state: input.brand.state,
      })
      return analyzeAnswer({
        engine,
        label: meta.label,
        text: result.markdown || result.text || "",
        sources: result.sources || [],
        brand: input.brand,
      })
    })
  )

  const models = settled.map((item, index) => {
    if (item.status === "fulfilled") return item.value
    const engine = engines[index]
    const meta = AI_ENGINES.find((row) => row.id === engine) ?? { id: engine, label: engine }
    return analyzeAnswer({
      engine,
      label: meta.label,
      text: "",
      sources: [],
      brand: input.brand,
      error: item.reason instanceof Error ? item.reason.message : "This model could not be scanned.",
    })
  })

  return { mode: "live", models }
}

export function signalLabels(signals: AiMatchSignals | undefined) {
  if (!signals) return []
  return (
    [
      signals.name ? "Company name" : null,
      signals.address ? "Address" : null,
      signals.phone ? "Phone" : null,
      signals.website ? "Website" : null,
    ] as Array<string | null>
  ).filter((item): item is string => Boolean(item))
}
