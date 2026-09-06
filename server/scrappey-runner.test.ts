import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyRunnerFetchError,
  RUNNER_PAGE_TIMEOUT_MS,
  runMapsTrafficSession,
  sanitizeRunnerError,
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
