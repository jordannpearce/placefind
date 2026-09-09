import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyRunnerFetchError,
  profileVisitActions,
  RUNNER_PAGE_TIMEOUT_MS,
  runnerVisitTimeoutMs,
  runMapsTrafficSession,
  sanitizeRunnerError,
  searchClickActions,
} from "./scrappey-runner.ts"

function timeoutError() {
  return new DOMException("The operation was aborted due to timeout", "TimeoutError")
}

describe("classifyRunnerFetchError", () => {
  it("maps Node AbortSignal.timeout() TimeoutError to timed out, not unreachable", () => {
    const error = timeoutError()
    assert.equal(error.name, "TimeoutError")
    assert.equal(error.name === "AbortError", false)
    assert.equal(classifyRunnerFetchError(error), "Traffic runner timed out.")
    assert.equal(classifyRunnerFetchError(error).includes("reach"), false)
  })

  it("maps AbortError from our wait to timed out, and a user stop separately", () => {
    const aborted = new DOMException("This operation was aborted", "AbortError")
    assert.equal(classifyRunnerFetchError(aborted), "Traffic runner timed out.")
    assert.equal(classifyRunnerFetchError(aborted, true), "Traffic stopped.")
  })

  it("keeps a real network failure as unreachable without naming vendors", () => {
    const failed = new TypeError("fetch failed")
    assert.equal(classifyRunnerFetchError(failed), "Could not reach the traffic runner.")
    assert.equal(/scrappey|dataforseo/i.test(classifyRunnerFetchError(failed)), false)
  })
})

describe("sanitizeRunnerError", () => {
  it("treats timeout wording as timed out even when a vendor URL was stripped", () => {
    assert.equal(sanitizeRunnerError("The operation was aborted due to timeout"), "Traffic runner timed out.")
    assert.equal(
      sanitizeRunnerError("POST https://publisher.scrappey.com/api/v1?key=scp_secret timed out"),
      "Traffic runner timed out.",
    )
  })
})

describe("profileVisitActions", () => {
  it("dwells first, then clicks selected listing actions in listed or shuffled order", () => {
    const sequential = profileVisitActions(
      { dwellSeconds: 25, actionOrder: "sequential", actions: ["reviews", "website"], device: "desktop" },
      "desktop",
    )
    assert.equal(sequential[0]?.type, "wait")
    assert.equal(sequential[0]?.wait, 25)
    assert.ok(sequential.some((action) => action.cssSelector?.includes("Reviews")))
    assert.ok(sequential.some((action) => action.cssSelector?.includes("authority") || action.cssSelector?.includes("Website")))
    assert.equal(sequential.some((action) => action.cssSelector?.includes("tel:")), false)
    assert.ok(sequential.every((action) => action.type === "wait" || action.ignoreErrors === true))

    const mobile = profileVisitActions(
      { dwellSeconds: 15, actionOrder: "sequential", actions: ["phone", "directions"], device: "mobile" },
      "mobile",
    )
    assert.ok(mobile.some((action) => action.cssSelector?.includes("phone:") || action.cssSelector?.includes("tel:")))
    assert.ok(mobile.some((action) => action.cssSelector?.includes("directions") || action.cssSelector?.includes("Directions")))
  })

  it("skips call clicks on a desktop profile and sizes the visit timeout from dwell", () => {
    const desktop = profileVisitActions(
      { dwellSeconds: 40, actionOrder: "sequential", actions: ["reviews", "phone", "website"], device: "desktop" },
      "desktop",
    )
    assert.equal(desktop.some((action) => /phone:|tel:|Call/.test(action.cssSelector || "")), false)
    assert.ok(runnerVisitTimeoutMs({ dwellSeconds: 40, actionOrder: "sequential", actions: ["reviews"], device: "auto" }, "desktop") >= 180_000)
    assert.ok(
      runnerVisitTimeoutMs({ dwellSeconds: 120, actionOrder: "sequential", actions: ["reviews", "website"], device: "auto" }, "desktop") >
        RUNNER_PAGE_TIMEOUT_MS,
    )
  })
})

describe("searchClickActions", () => {
  it("waits for Maps results before clicking the confirmed listing", () => {
    const actions = searchClickActions({ title: "Franklin Barbecue", mapsUrl: "", placeId: "ChIJ123" })
    assert.equal(actions[0]?.type, "wait")
    assert.ok(actions.some((action) => action.cssSelector === 'a[href*="ChIJ123"]'))
  })
})

describe("runMapsTrafficSession error mapping", () => {
  it("waits longer than 60s before giving up on a Maps page", () => {
    assert.ok(RUNNER_PAGE_TIMEOUT_MS > 60_000)
    assert.ok(RUNNER_PAGE_TIMEOUT_MS >= 180_000)
  })

  it("records a TimeoutError as timed out so a slow session is not marked unreachable", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      throw timeoutError()
    }) as typeof fetch
    try {
      const result = await runMapsTrafficSession({
        key: "scp_test_runner_key",
        searchUrl: "https://www.google.com/maps/search/barbecue/@30.28,-97.75,17z",
        listingUrl: "https://www.google.com/maps/search/?api=1&query=Franklin&query_place_id=ChIJ123",
        listingTitle: "Franklin Barbecue",
        listingPlaceId: "ChIJ123",
        profileId: "pf-test-profile",
        sessionId: "pf-test-session",
      })
      assert.equal(result.ok, false)
      assert.equal(result.error, "Traffic runner timed out.")
      assert.equal(result.error?.includes("reach"), false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("records a 504 HTML response as timed out, not unreachable", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      return new Response("<html>Gateway Timeout</html>", { status: 504, headers: { "Content-Type": "text/html" } })
    }) as typeof fetch
    try {
      const result = await runMapsTrafficSession({
        key: "scp_test_runner_key",
        searchUrl: "https://www.google.com/maps/search/barbecue/@30.28,-97.75,17z",
        listingUrl: "https://www.google.com/maps/search/?api=1&query=Franklin&query_place_id=ChIJ123",
        listingTitle: "Franklin Barbecue",
        listingPlaceId: "ChIJ123",
        profileId: "pf-test-profile",
        sessionId: "pf-test-session",
      })
      assert.equal(result.ok, false)
      assert.equal(result.error, "Traffic runner timed out.")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("reuses the supplied profile, then dwells on the opened listing", async () => {
    const originalFetch = globalThis.fetch
    const cmds: Array<Record<string, unknown>> = []
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>
      cmds.push(body)
      return new Response(
        JSON.stringify({
          solution: {
            verified: true,
            currentUrl: "https://www.google.com/maps/place/Franklin+Barbecue/@30.27,-97.74,17z/data=!3m1!4b1!4m6!3m5!1sChIJ123",
            markdown: "# Franklin Barbecue\nChIJ123",
          },
          session: "pf-test-session",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }) as typeof fetch
    try {
      const result = await runMapsTrafficSession({
        key: "scp_test_runner_key",
        searchUrl: "https://www.google.com/maps/search/barbecue/@30.28,-97.75,17z",
        listingUrl: "https://www.google.com/maps/search/?api=1&query=Franklin&query_place_id=ChIJ123",
        listingTitle: "Franklin Barbecue",
        listingPlaceId: "ChIJ123",
        profileId: "pf-camp-123",
        sessionId: "pf-test-session",
        dwellSeconds: 25,
        actionOrder: "sequential",
        actions: ["reviews", "website"],
        device: "desktop",
      })
      assert.equal(result.ok, true)
      assert.equal(result.requestCount, 1)
      assert.equal(result.dwellSeconds, 25)
      assert.deepEqual(result.actions, ["reviews", "website"])
      const created = cmds.find((body) => body.cmd === "sessions.create")
      assert.equal(created?.profileId, "pf-camp-123")
      assert.deepEqual(created?.device, ["desktop"])
      const pages = cmds.filter((body) => body.cmd === "request.get")
      assert.equal(pages.length, 1)
      assert.equal(pages[0]?.profileId, "pf-camp-123")
      const visitActions = pages[0]?.browserActions as Array<{ type?: string; wait?: number }>
      assert.ok(visitActions?.some((action) => action.type === "wait" && action.wait === 25))
      assert.ok(visitActions?.some((action) => action.type === "wait" && action.wait === 3))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("still reports unreachable for a connection failure", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed")
    }) as typeof fetch
    try {
      const result = await runMapsTrafficSession({
        key: "scp_test_runner_key",
        searchUrl: "https://www.google.com/maps/search/barbecue/@30.28,-97.75,17z",
        listingUrl: "https://www.google.com/maps/search/?api=1&query=Franklin&query_place_id=ChIJ123",
        listingTitle: "Franklin Barbecue",
        listingPlaceId: "ChIJ123",
        profileId: "pf-test-profile",
        sessionId: "pf-test-session",
      })
      assert.equal(result.ok, false)
      assert.equal(result.error, "Could not reach the traffic runner.")
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
