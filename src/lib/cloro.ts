import type { AiCompetitor, AiEngineId, AiModelResult, AiSource, ScanMode } from "./types"

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

export function analyzeAnswer(input: {
  engine: AiEngineId
  label: string
  text: string
  sources: CloroSource[]
  brandName: string
  brandDomain: string
  competitors: AiCompetitor[]
  error?: string | null
}): AiModelResult {
  const text = input.text || ""
  const haystack = `${text} ${input.sources.map((source) => `${source.label || ""} ${source.url || ""}`).join(" ")}`.toLowerCase()
  const mentioned = includesTerm(haystack, input.brandName) || domainInUrl(haystack, input.brandDomain)
  const sources: AiSource[] = input.sources.slice(0, 12).map((source, index) => {
    const url = source.url || ""
    return {
      position: typeof source.position === "number" ? source.position : index + 1,
      url,
      label: source.label || url || `Source ${index + 1}`,
      description: source.description || "",
      citesBrand: domainInUrl(url, input.brandDomain) || includesTerm(`${source.label || ""} ${url}`, input.brandName),
    }
  })
  const cited = sources.some((source) => source.citesBrand)
  const names = [
    { name: input.brandName, domain: input.brandDomain, isBrand: true },
    ...input.competitors.map((competitor) => ({ ...competitor, isBrand: false })),
  ]
  const ranked = names
    .map((item) => ({
      ...item,
      index: firstMentionIndex(text, [item.name, item.domain].filter(Boolean)),
    }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
  const mentionRank = ranked.findIndex((item) => item.isBrand) + 1 || null

  return {
    engine: input.engine,
    label: input.label,
    mentioned,
    cited,
    mentionRank: mentioned ? mentionRank || 1 : null,
    excerpt: mentioned ? excerptAround(text, input.brandName) : text.slice(0, 220).trim(),
    sources,
    competitors: input.competitors.map((competitor) => ({
      name: competitor.name,
      domain: competitor.domain,
      mentioned:
        includesTerm(haystack, competitor.name) || domainInUrl(haystack, competitor.domain),
      cited: sources.some(
        (source) =>
          domainInUrl(source.url, competitor.domain) || includesTerm(source.label, competitor.name)
      ),
    })),
    error: input.error || null,
  }
}

function mockAnswer(engine: AiEngineId, brandName: string, competitors: AiCompetitor[]) {
  const rival = competitors[0]?.name || "a nearby competitor"
  const templates: Record<AiEngineId, string> = {
    chatgpt: `For espresso downtown, locals often start with ${brandName}. ${rival} is a common backup when the line is long. Official hours and the menu live on the brand site.`,
    perplexity: `Recent guides name ${brandName} among the stronger specialty shops in the area. Reviewers also mention ${rival}. Sources include local roundups and the shop homepage.`,
    gemini: `If you want a specialty pour-over, ${brandName} is frequently recommended. ${rival} shows up for patio seating. Confirm current hours before you go.`,
    copilot: `People looking for coffee near the capitol often hear ${brandName} first. ${rival} appears in the same shortlists. Maps listings and the shop sites are the usual citations.`,
    aimode: `${brandName} is a typical answer for “best coffee nearby,” with ${rival} listed just behind. Local pack pages and review sites are cited.`,
    grok: `Short version: ${brandName} still gets the nod on specialty drinks. ${rival} wins some late-night mentions. Treat this as a vibe check, not a ranking from one street.`,
  }
  return templates[engine]
}

function mockSources(brandName: string, brandDomain: string, competitors: AiCompetitor[]): CloroSource[] {
  const domain = brandDomain || `${brandName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`
  const rival = competitors[0]
  return [
    {
      position: 1,
      url: `https://${domain.replace(/^https?:\/\//, "")}`,
      label: `${brandName} — official site`,
      description: "Hours, locations, and menu.",
    },
    {
      position: 2,
      url: "https://austin.example/best-coffee",
      label: "Best coffee in downtown Austin",
      description: `A local roundup that names ${brandName}.`,
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
          description: "Directory of nearby coffee shops.",
        },
  ]
}

export function mockCloroScan(input: {
  brandName: string
  brandDomain: string
  competitors: AiCompetitor[]
  engines?: AiEngineId[]
}): AiModelResult[] {
  const engines = input.engines?.length ? input.engines : AI_ENGINES.map((item) => item.id)
  return engines.map((engine) => {
    const meta = AI_ENGINES.find((item) => item.id === engine) ?? { id: engine, label: engine }
    const text = mockAnswer(engine, input.brandName, input.competitors)
    return analyzeAnswer({
      engine,
      label: meta.label,
      text,
      sources: mockSources(input.brandName, input.brandDomain, input.competitors),
      brandName: input.brandName,
      brandDomain: input.brandDomain,
      competitors: input.competitors,
    })
  })
}

async function fetchEngine(input: {
  apiKey: string
  engine: AiEngineId
  prompt: string
  country: string
}): Promise<CloroResult> {
  const response = await fetch(`${CLORO_BASE}/${input.engine}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: input.prompt,
      country: input.country,
      include: { markdown: true },
    }),
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
  brandName: string
  brandDomain: string
  competitors: AiCompetitor[]
  engines?: AiEngineId[]
}): Promise<{ mode: ScanMode; models: AiModelResult[] }> {
  const engines = input.engines?.length ? input.engines : AI_ENGINES.map((item) => item.id)
  const key = input.apiKey.trim()
  if (!key) {
    return {
      mode: "mock",
      models: mockCloroScan({
        brandName: input.brandName,
        brandDomain: input.brandDomain,
        competitors: input.competitors,
        engines,
      }),
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
      })
      return analyzeAnswer({
        engine,
        label: meta.label,
        text: result.markdown || result.text || "",
        sources: result.sources || [],
        brandName: input.brandName,
        brandDomain: input.brandDomain,
        competitors: input.competitors,
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
      brandName: input.brandName,
      brandDomain: input.brandDomain,
      competitors: input.competitors,
      error: item.reason instanceof Error ? item.reason.message : "This model could not be scanned.",
    })
  })

  return { mode: "live", models }
}
