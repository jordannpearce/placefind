import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { createCampaign, type Campaign, type GridScanRun } from "./campaigns.ts"
import { emptyApiKeys, resetHostedKeysCacheForTests } from "./hosted-keys.ts"
import { leaksVendorTalk, publicTrafficMessage } from "./public-copy.ts"
import { listingClickActions, sanitizeRunnerError } from "./scrappey-runner.ts"
import { reloadStoreFromDisk, resetStoreForTests, writeCollection } from "./store.ts"
import {
  confirmedListingForTraffic,
  listingNotReadyForTrafficMessage,
  mapsKeywordNearUrl,
  normalizeTrafficSessions,
  pickTrafficOrigins,
  runCampaignTraffic,
  trafficRunnerMissingMessage,
} from "./traffic.ts"

function foundScan(campaign: Campaign, found: boolean): GridScanRun {
  return {
    id: "scan-1",
    scannedAt: "2026-09-06T00:00:00.000Z",
    keyword: "barbecue",
    gridSize: 3,
    spacingMiles: 1,
    zoom: 17,
    center: { lat: 30.27, lng: -97.74 },
    placeId: found ? "ChIJ123" : null,
    pointCount: 2,
    foundCount: found ? 1 : 0,
    points: [
      {
        row: 0,
        col: 0,
        lat: 30.28,
        lng: -97.75,
        keyword: "barbecue",
        rank: found ? 1 : null,
        listingTitle: found ? "Franklin Barbecue" : null,
        rating: found ? 4.7 : null,
        address: found ? "900 E 11th St" : null,
        mapsUrl: found ? "https://www.google.com/maps/search/?api=1&query=Franklin&query_place_id=ChIJ123" : null,
        scannedAt: "2026-09-06T00:00:00.000Z",
      },
      {
        row: 0,
        col: 1,
        lat: 30.26,
        lng: -97.73,
        keyword: "barbecue",
        rank: found ? 3 : null,
        listingTitle: found ? "Franklin Barbecue" : null,
        rating: found ? 4.7 : null,
        address: found ? "900 E 11th St" : null,
        mapsUrl: found ? "https://www.google.com/maps/search/?api=1&query=Franklin&query_place_id=ChIJ123" : null,
        scannedAt: "2026-09-06T00:00:00.000Z",
      },
    ],
  }
}

function attachScan(campaign: Campaign, found: boolean): Campaign {
  const next = { ...campaign, lastGridScan: foundScan(campaign, found), lastScan: null }
  const rows = [next]
  writeCollection("campaigns", rows)
  return next
}

describe("normalizeTrafficSessions", () => {
  it("defaults to 3 and caps at 20", () => {
    assert.equal(normalizeTrafficSessions(undefined), 3)
    assert.equal(normalizeTrafficSessions(1), 1)
    assert.equal(normalizeTrafficSessions(20), 20)
    assert.equal(normalizeTrafficSessions(99), 20)
    assert.equal(normalizeTrafficSessions(0), 3)
    assert.equal(normalizeTrafficSessions(1.5), 3)
  })
})

describe("mapsKeywordNearUrl", () => {
  it("builds a Maps search URL from a keyword and grid point", () => {
    const url = mapsKeywordNearUrl("barbecue", 30.27, -97.74)
    assert.match(url, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/)
    assert.match(decodeURIComponent(url), /barbecue near 30\.27,-97\.74/)
  })
})

describe("sanitizeRunnerError", () => {
  it("never returns the runner key", () => {
    const next = sanitizeRunnerError("POST https://publisher.scrappey.com/api/v1?key=scp_secret_value failed")
    assert.equal(next.includes("scp_secret_value"), false)
    assert.equal(next.includes("key="), false)
    assert.equal(/scrappey/i.test(next), false)
  })
})

describe("listingClickActions", () => {
  it("uses official click actions for the listing name and Maps place link", () => {
    const actions = listingClickActions('Joe\'s "Pizza"')
    assert.equal(actions[0]?.type, "click")
    assert.match(actions[0]?.cssSelector || "", /aria-label/)
    assert.equal(actions[1]?.cssSelector, 'a[href*="/maps/place/"]')
    assert.equal(actions[0]?.ignoreErrors, true)
  })
})

describe("publicTrafficMessage", () => {
  it("keeps the configured-missing copy and strips vendor names", () => {
    assert.equal(publicTrafficMessage("Traffic runner is not configured."), "Traffic runner is not configured.")
    const hidden = publicTrafficMessage("Scrappey rejected this API key.")
    assert.equal(leaksVendorTalk(hidden), false)
    assert.match(hidden, /Traffic runner/)
  })
})

describe("runCampaignTraffic", () => {
  const previous = {
    keysFile: process.env.PLACEFIND_KEYS_FILE,
    login: process.env.DATAFORSEO_LOGIN,
    password: process.env.DATAFORSEO_PASSWORD,
    scrappey: process.env.SCRAPPEY_API_KEY,
    dataDir: process.env.PLACEFIND_DATA_DIR,
  }

  function isolateKeys() {
    resetHostedKeysCacheForTests()
    process.env.PLACEFIND_KEYS_FILE = path.join(tmpdir(), "placefind-missing-traffic-keys.json")
    delete process.env.DATAFORSEO_LOGIN
    delete process.env.DATAFORSEO_PASSWORD
    delete process.env.SCRAPPEY_API_KEY
  }

  after(() => {
    resetHostedKeysCacheForTests()
    if (previous.keysFile == null) delete process.env.PLACEFIND_KEYS_FILE
    else process.env.PLACEFIND_KEYS_FILE = previous.keysFile
    if (previous.login == null) delete process.env.DATAFORSEO_LOGIN
    else process.env.DATAFORSEO_LOGIN = previous.login
    if (previous.password == null) delete process.env.DATAFORSEO_PASSWORD
    else process.env.DATAFORSEO_PASSWORD = previous.password
    if (previous.scrappey == null) delete process.env.SCRAPPEY_API_KEY
    else process.env.SCRAPPEY_API_KEY = previous.scrappey
    if (previous.dataDir == null) delete process.env.PLACEFIND_DATA_DIR
    else process.env.PLACEFIND_DATA_DIR = previous.dataDir
    reloadStoreFromDisk()
  })

  it("returns 400 when the campaign is confirmed but has not been scanned", async () => {
    isolateKeys()
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-traffic-noscans-")))
    const campaign = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        keywords: ["barbecue"],
        placeId: "ChIJ123",
        listingTitle: "Franklin Barbecue",
        center: { lat: 30.27, lng: -97.74 },
      },
      "user-a",
    )
    assert.equal(confirmedListingForTraffic(campaign), null)
    await assert.rejects(
      () => runCampaignTraffic(campaign.id, emptyApiKeys(), 3, "user-a"),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.message, listingNotReadyForTrafficMessage())
        return true
      },
    )
  })

  it("returns 400 when the campaign has no confirmed listing", async () => {
    isolateKeys()
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-traffic-none-")))
    const campaign = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        keywords: ["barbecue"],
      },
      "user-a",
    )
    assert.equal(confirmedListingForTraffic(campaign), null)
    await assert.rejects(
      () => runCampaignTraffic(campaign.id, emptyApiKeys(), 3, "user-a"),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.message, listingNotReadyForTrafficMessage())
        assert.equal((error as { status?: number }).status, 400)
        return true
      },
    )
  })

  it("returns a clear error when the traffic runner key is missing", async () => {
    isolateKeys()
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-traffic-nokey-")))
    const created = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        keywords: ["barbecue"],
        placeId: "ChIJ123",
        center: { lat: 30.27, lng: -97.74 },
      },
      "user-a",
    )
    attachScan(created, true)
    await assert.rejects(
      () => runCampaignTraffic(created.id, emptyApiKeys(), 2, "user-a"),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.message, trafficRunnerMissingMessage())
        assert.equal(error.message.includes("Scrappey"), false)
        return true
      },
    )
  })

  it("allows traffic after a finished scan even when no ranks were found", () => {
    isolateKeys()
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-traffic-notfound-")))
    const created = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        keywords: ["barbecue"],
        placeId: "ChIJ123",
        listingTitle: "Franklin Barbecue",
        listingAddress: "900 E 11th St",
        center: { lat: 30.27, lng: -97.74 },
      },
      "user-a",
    )
    const scanned = attachScan(created, false)
    const listing = confirmedListingForTraffic(scanned)
    assert.ok(listing)
    assert.match(listing.mapsUrl, /maps/)
    assert.equal(listing.title, "Franklin Barbecue")
    const origins = pickTrafficOrigins(scanned, 2)
    assert.equal(origins.length, 2)
  })

  it("spreads traffic origins across scanned grid points", () => {
    const campaign = {
      lastGridScan: foundScan(
        {
          businessName: "Franklin Barbecue",
        } as Campaign,
        true,
      ),
      center: { lat: 30.27, lng: -97.74 },
    } as Campaign
    const origins = pickTrafficOrigins(campaign, 2)
    assert.equal(origins.length, 2)
    assert.ok(origins[0] && origins[1])
    assert.ok(origins[0].lat !== origins[1].lat || origins[0].lng !== origins[1].lng)
  })

  it("runs traffic sessions against the listing URL when the runner responds", async () => {
    isolateKeys()
    process.env.SCRAPPEY_API_KEY = "scp_test_runner_key"
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-traffic-ok-")))
    const created = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        keywords: ["barbecue"],
        placeId: "ChIJ123",
        center: { lat: 30.27, lng: -97.74 },
      },
      "user-a",
    )
    attachScan(created, true)

    const originalFetch = globalThis.fetch
    const cmds: string[] = []
    const urls: string[] = []
    const profiles = new Set<string>()
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const href = String(_input)
      assert.equal(href.includes("scp_test_runner_key"), true)
      const body = JSON.parse(String(init?.body || "{}")) as { cmd?: string; url?: string; profileId?: string }
      cmds.push(body.cmd || "")
      if (body.url) urls.push(body.url)
      if (body.profileId) profiles.add(body.profileId)
      return new Response(JSON.stringify({ solution: { verified: true, currentUrl: body.url, markdown: "# Franklin Barbecue\nOpen now" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as typeof fetch

    try {
      const result = await runCampaignTraffic(created.id, emptyApiKeys(), 2, "user-a")
      assert.equal(result.traffic.status, "ok")
      assert.equal(result.traffic.sessionsRequested, 2)
      assert.equal(result.traffic.sessionsOk, 2)
      assert.equal(result.traffic.sessionsFailed, 0)
      assert.ok(result.traffic.requestCount >= 4)
      assert.equal(result.campaign.lastTrafficJob?.status, "ok")
      assert.ok(cmds.includes("sessions.create"))
      assert.ok(cmds.includes("request.get"))
      assert.ok(urls.some((url) => url.includes("maps/search")))
      assert.ok(urls.some((url) => url.includes("query_place_id=ChIJ123")))
      assert.ok(profiles.size >= 2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
