const SCRAPPEY_ENDPOINT = "https://publisher.scrappey.com/api/v1"

export type ScrappeyBrowserAction = {
  type: string
  cssSelector?: string
  wait?: number
  waitForSelector?: string
  ignoreErrors?: boolean
}

export type TrafficSessionInput = {
  key: string
  searchUrl: string
  listingUrl: string
  listingTitle: string
  profileId: string
  sessionId: string
}

export type TrafficSessionResult = {
  ok: boolean
  profileId: string
  sessionId: string
  searchUrl: string
  listingUrl: string
  requestCount: number
  error: string | null
}

type ScrappeySolution = {
  verified?: boolean
  currentUrl?: string
  innerText?: string
  markdown?: string
}

type ScrappeyResponse = {
  solution?: ScrappeySolution
  session?: string
  error?: string
}

function runnerUrl(key: string): string {
  return `${SCRAPPEY_ENDPOINT}?key=${encodeURIComponent(key)}`
}

export function sanitizeRunnerError(text: string): string {
  const stripped = text
    .replace(/[?&]key=[^&\s"'\\]+/gi, "")
    .replace(/https?:\/\/[^\s"'\\]*scrappey[^\s"'\\]*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
  if (!stripped) return "Traffic runner could not finish this session."
  if (/scrappey|dataforseo|api key/i.test(stripped)) {
    if (/timeout|timed out/i.test(stripped)) return "Traffic runner timed out."
    return "Traffic runner could not finish this session."
  }
  return stripped
}

export function listingClickActions(title: string): ScrappeyBrowserAction[] {
  const safe = title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return [
    { type: "click", cssSelector: `a[aria-label*="${safe}"]`, ignoreErrors: true, wait: 2 },
    { type: "click", cssSelector: 'a[href*="/maps/place/"]', ignoreErrors: true, wait: 2 },
  ]
}

async function scrappeyRequest(
  key: string,
  body: Record<string, unknown>,
  timeoutMs = 90_000,
): Promise<{ payload: ScrappeyResponse; error: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(runnerUrl(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const payload = (await response.json()) as ScrappeyResponse
    if (payload.error || payload.solution?.verified === false) {
      return { payload, error: payload.error || "Could not open the Maps page." }
    }
    return { payload, error: null }
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError" ? "Traffic runner timed out." : "Could not reach the traffic runner."
    return { payload: {}, error: message }
  } finally {
    clearTimeout(timer)
  }
}

async function runnerGet(
  key: string,
  url: string,
  options: { session?: string; profileId?: string; browserActions?: ScrappeyBrowserAction[] } = {},
): Promise<{ currentUrl: string; error: string | null }> {
  const body: Record<string, unknown> = {
    cmd: "request.get",
    url,
    markdown: true,
    proxyCountry: "UnitedStates",
    overwriteLocale: "en-US",
  }
  if (options.session) body.session = options.session
  if (options.profileId) body.profileId = options.profileId
  if (options.browserActions?.length) body.browserActions = options.browserActions
  const page = await scrappeyRequest(key, body)
  if (page.error) return { currentUrl: url, error: sanitizeRunnerError(page.error) }
  return { currentUrl: page.payload.solution?.currentUrl || url, error: null }
}

async function createRunnerSession(key: string, sessionId: string): Promise<{ sessionId: string; error: string | null }> {
  const result = await scrappeyRequest(key, {
    cmd: "sessions.create",
    session: sessionId,
    proxyCountry: "UnitedStates",
  })
  return { sessionId: result.payload.session || sessionId, error: result.error }
}

async function destroyRunnerSession(key: string, sessionId: string): Promise<void> {
  await scrappeyRequest(key, { cmd: "sessions.destroy", session: sessionId }, 20_000)
}

export async function runMapsTrafficSession(input: TrafficSessionInput): Promise<TrafficSessionResult> {
  const base = {
    profileId: input.profileId,
    sessionId: input.sessionId,
    searchUrl: input.searchUrl,
    listingUrl: input.listingUrl,
  }
  let requestCount = 0
  const created = await createRunnerSession(input.key, input.sessionId)
  const session = created.error ? undefined : created.sessionId
  try {
    requestCount += 1
    const search = await runnerGet(input.key, input.searchUrl, {
      session,
      profileId: input.profileId,
      browserActions: listingClickActions(input.listingTitle),
    })
    if (search.error) return { ...base, ok: false, requestCount, error: search.error }
    requestCount += 1
    const listing = await runnerGet(input.key, input.listingUrl, {
      session,
      profileId: input.profileId,
    })
    if (listing.error) return { ...base, ok: false, requestCount, error: listing.error }
    return { ...base, ok: true, requestCount, error: null }
  } finally {
    if (session) await destroyRunnerSession(input.key, session)
  }
}
