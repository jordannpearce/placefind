const SCRAPPEY_ENDPOINT = "https://publisher.scrappey.com/api/v1"

export type ScrappeyBrowserAction = {
  type: string
  cssSelector?: string
  wait?: number
  waitForSelector?: string
  ignoreErrors?: boolean
}

export type TrafficListingTarget = {
  title: string
  mapsUrl: string
  placeId?: string | null
  cid?: string | null
}

export type TrafficSessionInput = {
  key: string
  searchUrl: string
  listingUrl: string
  listingTitle: string
  listingPlaceId?: string | null
  listingCid?: string | null
  profileId: string
  sessionId: string
  signal?: AbortSignal
}

export type TrafficSessionResult = {
  ok: boolean
  profileId: string
  sessionId: string
  searchUrl: string
  listingUrl: string
  requestCount: number
  error: string | null
  openedTitle?: string | null
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

export function listingNotInAreaMessage() {
  return "listing not in this area"
}

export function listingNotFoundMessage() {
  return "could not find the listing"
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
  if (/could not find the listing/i.test(stripped)) return listingNotFoundMessage()
  if (/listing not in this area/i.test(stripped)) return listingNotInAreaMessage()
  if (/scrappey|dataforseo|api key/i.test(stripped)) {
    if (/timeout|timed out/i.test(stripped)) return "Traffic runner timed out."
    return "Traffic runner could not finish this session."
  }
  return stripped
}

export function cssStringLiteral(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

export function listingTargetFromSession(input: TrafficSessionInput): TrafficListingTarget {
  return {
    title: input.listingTitle,
    mapsUrl: input.listingUrl,
    placeId: input.listingPlaceId ?? placeIdFromMapsUrl(input.listingUrl),
    cid: input.listingCid ?? cidFromMapsUrl(input.listingUrl),
  }
}

export function placeIdFromMapsUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get("query_place_id")
  } catch {
    const match = url.match(/query_place_id=([^&]+)/i)
    return match ? decodeURIComponent(match[1]!) : null
  }
}

export function cidFromMapsUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get("cid")
  } catch {
    const match = url.match(/[?&]cid=([^&]+)/i)
    return match ? decodeURIComponent(match[1]!) : null
  }
}

export function listingPresentInMapsPage(text: string, listing: TrafficListingTarget): boolean {
  if (!text) return false
  const hay = text
  if (listing.placeId && hay.includes(listing.placeId)) return true
  if (listing.cid && hay.includes(String(listing.cid))) return true
  const title = listing.title.trim()
  if (title && hay.toLowerCase().includes(title.toLowerCase())) return true
  return false
}

export function mapsUrlLooksLikeListing(url: string, listing: TrafficListingTarget): boolean {
  if (!url) return false
  let hay = url
  try {
    hay = decodeURIComponent(url)
  } catch {
    hay = url
  }
  if (listing.placeId && hay.includes(listing.placeId)) return true
  if (listing.cid && hay.includes(String(listing.cid))) return true
  const title = listing.title.trim()
  if (!title || !/\/maps\/place\//i.test(hay)) return false
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "")
  const compact = hay.toLowerCase().replace(/[^a-z0-9]+/g, "")
  return Boolean(slug && compact.includes(slug))
}

/** Click only the confirmed listing — never the first /maps/place/ result. */
export function listingClickActions(listing: TrafficListingTarget | string): ScrappeyBrowserAction[] {
  const target: TrafficListingTarget =
    typeof listing === "string" ? { title: listing, mapsUrl: "" } : listing
  const actions: ScrappeyBrowserAction[] = []
  const title = target.title.trim()
  if (target.placeId) {
    actions.push({ type: "click", cssSelector: `a[href*="${target.placeId}"]`, ignoreErrors: true, wait: 2 })
    actions.push({ type: "click", cssSelector: `[data-place-id="${target.placeId}"]`, ignoreErrors: true, wait: 2 })
  }
  if (target.cid) {
    actions.push({ type: "click", cssSelector: `a[href*="cid=${target.cid}"]`, ignoreErrors: true, wait: 2 })
    actions.push({ type: "click", cssSelector: `a[href*="${target.cid}"]`, ignoreErrors: true, wait: 2 })
  }
  if (title) {
    const quoted = cssStringLiteral(title)
    actions.push({ type: "click", cssSelector: `a[aria-label=${quoted}]`, ignoreErrors: true, wait: 2 })
    actions.push({ type: "click", cssSelector: `div[role="article"][aria-label=${quoted}]`, ignoreErrors: true, wait: 2 })
  }
  actions.push({ type: "scroll", cssSelector: '[role="feed"]', wait: 1, ignoreErrors: true })
  if (target.placeId) {
    actions.push({ type: "click", cssSelector: `a[href*="${target.placeId}"]`, ignoreErrors: true, wait: 2 })
  }
  if (title) {
    actions.push({ type: "click", cssSelector: `a[aria-label=${cssStringLiteral(title)}]`, ignoreErrors: true, wait: 2 })
  }
  return actions
}

async function scrappeyRequest(
  key: string,
  body: Record<string, unknown>,
  timeoutMs = 90_000,
  signal?: AbortSignal,
): Promise<{ payload: ScrappeyResponse; error: string | null }> {
  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  try {
    const response = await fetch(runnerUrl(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: combined,
    })
    const payload = (await response.json()) as ScrappeyResponse
    if (payload.error || payload.solution?.verified === false) {
      return { payload, error: payload.error || "Could not open the Maps page." }
    }
    return { payload, error: null }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (signal?.aborted) return { payload: {}, error: "Traffic stopped." }
      return { payload: {}, error: "Traffic runner timed out." }
    }
    return { payload: {}, error: "Could not reach the traffic runner." }
  }
}

async function runnerGet(
  key: string,
  url: string,
  options: { session?: string; profileId?: string; browserActions?: ScrappeyBrowserAction[]; signal?: AbortSignal } = {},
): Promise<{ currentUrl: string; text: string; error: string | null }> {
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
  const page = await scrappeyRequest(key, body, 90_000, options.signal)
  if (page.error) return { currentUrl: url, text: "", error: sanitizeRunnerError(page.error) }
  const text = page.payload.solution?.markdown || page.payload.solution?.innerText || ""
  return { currentUrl: page.payload.solution?.currentUrl || url, text, error: null }
}

async function createRunnerSession(
  key: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<{ sessionId: string; error: string | null }> {
  const result = await scrappeyRequest(
    key,
    {
      cmd: "sessions.create",
      session: sessionId,
      proxyCountry: "UnitedStates",
    },
    90_000,
    signal,
  )
  return { sessionId: result.payload.session || sessionId, error: result.error }
}

async function destroyRunnerSession(key: string, sessionId: string): Promise<void> {
  await scrappeyRequest(key, { cmd: "sessions.destroy", session: sessionId }, 20_000)
}

export function listingOpenedOnPage(url: string, text: string, listing: TrafficListingTarget): boolean {
  if (mapsUrlLooksLikeListing(url, listing)) return true
  if (/\/maps\/place\//i.test(url) && listingPresentInMapsPage(text, listing)) return true
  return false
}

export async function runMapsTrafficSession(input: TrafficSessionInput): Promise<TrafficSessionResult> {
  const listing = listingTargetFromSession(input)
  const base = {
    profileId: input.profileId,
    sessionId: input.sessionId,
    searchUrl: input.searchUrl,
    listingUrl: input.listingUrl,
  }
  let requestCount = 0
  const created = await createRunnerSession(input.key, input.sessionId, input.signal)
  const session = created.error ? undefined : created.sessionId
  try {
    requestCount += 1
    const search = await runnerGet(input.key, input.searchUrl, {
      session,
      profileId: input.profileId,
      browserActions: listingClickActions(listing),
      signal: input.signal,
    })
    if (search.error) return { ...base, ok: false, requestCount, error: search.error }

    if (listingOpenedOnPage(search.currentUrl, search.text, listing)) {
      return { ...base, ok: true, requestCount, error: null, openedTitle: listing.title }
    }

    const inResults = listingPresentInMapsPage(search.text, listing)
    if (!inResults) {
      return { ...base, ok: false, requestCount, error: listingNotInAreaMessage() }
    }

    requestCount += 1
    const fallback = await runnerGet(input.key, input.listingUrl, {
      session,
      profileId: input.profileId,
      signal: input.signal,
    })
    if (!fallback.error && (listingOpenedOnPage(fallback.currentUrl, fallback.text, listing) || !fallback.error)) {
      return { ...base, ok: true, requestCount, error: null, openedTitle: listing.title }
    }
    return { ...base, ok: false, requestCount, error: listingNotFoundMessage() }
  } finally {
    if (session) await destroyRunnerSession(input.key, session)
  }
}
