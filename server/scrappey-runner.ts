import {
  orderTrafficActions,
  parseTrafficVisitOptions,
  resolveTrafficDevice,
  visitActionsForDevice,
  type TrafficActionOrder,
  type TrafficDeviceMode,
  type TrafficProfileAction,
  type TrafficResolvedDevice,
  type TrafficVisitOptions,
} from "../src/lib/traffic-visit.ts"

const SCRAPPEY_ENDPOINT = "https://publisher.scrappey.com/api/v1"

/** Maps + listing clicks routinely take more than 60s. Do not treat that wait as unreachable. */
export const RUNNER_PAGE_TIMEOUT_MS = 180_000
export const RUNNER_SESSION_TIMEOUT_MS = 90_000

export type ScrappeyBrowserAction = {
  type: string
  cssSelector?: string
  wait?: number
  waitForSelector?: string
  ignoreErrors?: boolean
  timeout?: number
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
  dwellSeconds?: number
  actionOrder?: TrafficActionOrder
  actions?: TrafficProfileAction[]
  device?: TrafficDeviceMode
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
  dwellSeconds?: number
  actions?: TrafficProfileAction[]
  visitError?: string | null
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

export function listingVisitTimedOutMessage() {
  return "listing visit timed out after the profile opened"
}

/** Missing Maps buttons must fail fast. The runner default is 60s per click. */
export const CLICK_TIMEOUT_MS = 4_000
export const MAX_DWELL_CHUNK_SECONDS = 25

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
  if (/timeout|timed out|aborted due to timeout/i.test(stripped)) return "Traffic runner timed out."
  if (/scrappey|dataforseo|api key/i.test(stripped)) {
    return "Traffic runner could not finish this session."
  }
  return stripped
}

export function classifyRunnerFetchError(error: unknown, userAborted = false): string {
  if (userAborted) return "Traffic stopped."
  const name = error instanceof Error ? error.name : ""
  const message = error instanceof Error ? error.message : String(error ?? "")
  if (
    name === "TimeoutError" ||
    name === "AbortError" ||
    /timeout|timed out|aborted due to timeout/i.test(`${name} ${message}`)
  ) {
    return "Traffic runner timed out."
  }
  return "Could not reach the traffic runner."
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

function clickAction(cssSelector: string, wait = 1): ScrappeyBrowserAction {
  return { type: "click", cssSelector, ignoreErrors: true, wait, timeout: CLICK_TIMEOUT_MS }
}

/** Click only the confirmed listing — never the first /maps/place/ result. */
export function listingClickActions(listing: TrafficListingTarget | string): ScrappeyBrowserAction[] {
  const target: TrafficListingTarget =
    typeof listing === "string" ? { title: listing, mapsUrl: "" } : listing
  const actions: ScrappeyBrowserAction[] = []
  const title = target.title.trim()
  if (target.placeId) actions.push(clickAction(`a[href*="${target.placeId}"]`, 2))
  if (target.cid) actions.push(clickAction(`a[href*="cid=${target.cid}"]`, 2))
  if (title) actions.push(clickAction(`a[aria-label=${cssStringLiteral(title)}]`, 2))
  actions.push({ type: "scroll", cssSelector: '[role="feed"]', wait: 1, ignoreErrors: true, timeout: CLICK_TIMEOUT_MS })
  if (target.placeId) actions.push(clickAction(`a[href*="${target.placeId}"]`, 1))
  else if (title) actions.push(clickAction(`a[aria-label=${cssStringLiteral(title)}]`, 1))
  return actions
}

function runnerHttpTimeoutError(status: number): string | null {
  if (status === 408 || status === 504 || status === 524) return "Traffic runner timed out."
  return null
}

async function scrappeyRequest(
  key: string,
  body: Record<string, unknown>,
  timeoutMs = RUNNER_PAGE_TIMEOUT_MS,
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
    const httpTimeout = runnerHttpTimeoutError(response.status)
    let payload: ScrappeyResponse
    try {
      payload = (await response.json()) as ScrappeyResponse
    } catch {
      return { payload: {}, error: httpTimeout || "Could not reach the traffic runner." }
    }
    if (httpTimeout && (payload.error || payload.solution?.verified === false)) {
      return { payload, error: httpTimeout }
    }
    if (payload.error || payload.solution?.verified === false) {
      return { payload, error: payload.error || "Could not open the Maps page." }
    }
    if (httpTimeout) return { payload, error: httpTimeout }
    return { payload, error: null }
  } catch (error) {
    return { payload: {}, error: classifyRunnerFetchError(error, Boolean(signal?.aborted)) }
  }
}

export function runnerVisitTimeoutMs(visit: TrafficVisitOptions, device: TrafficResolvedDevice): number {
  const actionCount = visitActionsForDevice(visit, device).length
  const seconds = visit.dwellSeconds + actionCount * 8 + 90
  return Math.max(RUNNER_PAGE_TIMEOUT_MS, seconds * 1000)
}

export function searchClickActions(listing: TrafficListingTarget | string): ScrappeyBrowserAction[] {
  return [
    { type: "wait_for_selector", cssSelector: '[role="feed"]', timeout: 15_000, ignoreErrors: true },
    { type: "wait_for_selector", cssSelector: 'div[role="article"]', timeout: 8_000, ignoreErrors: true },
    ...listingClickActions(listing),
  ]
}

const LISTING_ACTION_SELECTORS: Record<TrafficProfileAction, string[]> = {
  reviews: ['button[aria-label*="Reviews"]', '[role="tab"][aria-label*="Reviews"]'],
  directions: ['button[data-item-id="directions"]', 'button[aria-label*="Directions"]'],
  phone: ['button[data-item-id^="phone:"]', 'a[href^="tel:"]'],
  website: ['a[data-item-id="authority"]', 'a[aria-label*="Website"]'],
}

export function firstDwellChunkSeconds(dwellSeconds: number): number {
  return Math.min(MAX_DWELL_CHUNK_SECONDS, Math.max(0, dwellSeconds))
}

export function remainingDwellSeconds(dwellSeconds: number): number {
  return Math.max(0, dwellSeconds - firstDwellChunkSeconds(dwellSeconds))
}

export function profileVisitActions(
  visit: TrafficVisitOptions,
  device: TrafficResolvedDevice,
  random: () => number = Math.random,
): ScrappeyBrowserAction[] {
  const actions: ScrappeyBrowserAction[] = [{ type: "wait", wait: firstDwellChunkSeconds(visit.dwellSeconds) }]
  const selected = orderTrafficActions(visitActionsForDevice(visit, device), visit.actionOrder, random)
  for (const action of selected) {
    for (const cssSelector of LISTING_ACTION_SELECTORS[action]) {
      actions.push(clickAction(cssSelector, 1))
    }
    if (action === "reviews") {
      actions.push({ type: "scroll", wait: 1, ignoreErrors: true, timeout: CLICK_TIMEOUT_MS })
    }
  }
  return actions
}

async function runnerGet(
  key: string,
  url: string,
  options: {
    session?: string
    profileId?: string
    browserActions?: ScrappeyBrowserAction[]
    signal?: AbortSignal
    timeoutMs?: number
  } = {},
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
  const page = await scrappeyRequest(key, body, options.timeoutMs ?? RUNNER_PAGE_TIMEOUT_MS, options.signal)
  if (page.error) return { currentUrl: url, text: "", error: sanitizeRunnerError(page.error) }
  const text = page.payload.solution?.markdown || page.payload.solution?.innerText || ""
  return { currentUrl: page.payload.solution?.currentUrl || url, text, error: null }
}

async function createRunnerSession(
  key: string,
  sessionId: string,
  options: { profileId?: string; device?: TrafficResolvedDevice; signal?: AbortSignal } = {},
): Promise<{ sessionId: string; error: string | null }> {
  const device = options.device ?? "desktop"
  const result = await scrappeyRequest(
    key,
    {
      cmd: "sessions.create",
      session: sessionId,
      profileId: options.profileId,
      proxyCountry: "UnitedStates",
      device: [device],
      operatingSystem: device === "mobile" ? ["android"] : ["windows"],
    },
    RUNNER_SESSION_TIMEOUT_MS,
    options.signal,
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
  const visit = parseTrafficVisitOptions(input)
  const device = resolveTrafficDevice(visit)
  const base = {
    profileId: input.profileId,
    sessionId: input.sessionId,
    searchUrl: input.searchUrl,
    listingUrl: input.listingUrl,
    dwellSeconds: visit.dwellSeconds,
    actions: visitActionsForDevice(visit, device),
  }
  let requestCount = 0
  const created = await createRunnerSession(input.key, input.sessionId, {
    profileId: input.profileId,
    device,
    signal: input.signal,
  })
  const session = created.error ? undefined : created.sessionId
  try {
    requestCount += 1
    const search = await runnerGet(input.key, input.searchUrl, {
      session,
      profileId: input.profileId,
      browserActions: searchClickActions(listing),
      timeoutMs: RUNNER_PAGE_TIMEOUT_MS,
      signal: input.signal,
    })
    if (search.error) return { ...base, ok: false, requestCount, error: search.error }

    let opened = listingOpenedOnPage(search.currentUrl, search.text, listing)
    let currentUrl = search.currentUrl || input.listingUrl
    if (!opened && !listingPresentInMapsPage(search.text, listing)) {
      return { ...base, ok: false, requestCount, error: listingNotInAreaMessage() }
    }

    if (!opened) {
      requestCount += 1
      const fallback = await runnerGet(input.key, input.listingUrl, {
        session,
        profileId: input.profileId,
        timeoutMs: RUNNER_PAGE_TIMEOUT_MS,
        signal: input.signal,
      })
      if (fallback.error) return { ...base, ok: false, requestCount, error: fallback.error }
      opened = listingOpenedOnPage(fallback.currentUrl, fallback.text, listing) || !fallback.error
      currentUrl = fallback.currentUrl || input.listingUrl
    }

    if (!opened) return { ...base, ok: false, requestCount, error: listingNotFoundMessage() }

    requestCount += 1
    const visitPage = await runnerGet(input.key, currentUrl, {
      session,
      profileId: input.profileId,
      browserActions: profileVisitActions(visit, device),
      timeoutMs: runnerVisitTimeoutMs(visit, device),
      signal: input.signal,
    })
    if (visitPage.error) {
      return {
        ...base,
        ok: true,
        requestCount,
        error: null,
        openedTitle: listing.title,
        visitError: listingVisitTimedOutMessage(),
      }
    }

    let remaining = remainingDwellSeconds(visit.dwellSeconds)
    while (remaining > 0) {
      const chunk = Math.min(MAX_DWELL_CHUNK_SECONDS, remaining)
      requestCount += 1
      const extra = await runnerGet(input.key, currentUrl, {
        session,
        profileId: input.profileId,
        browserActions: [{ type: "wait", wait: chunk }],
        timeoutMs: 90_000,
        signal: input.signal,
      })
      if (extra.error) {
        return {
          ...base,
          ok: true,
          requestCount,
          error: null,
          openedTitle: listing.title,
          visitError: listingVisitTimedOutMessage(),
        }
      }
      remaining -= chunk
    }

    return { ...base, ok: true, requestCount, error: null, openedTitle: listing.title }
  } finally {
    if (session) await destroyRunnerSession(input.key, session)
  }
}
