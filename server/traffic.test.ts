import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, afterEach, describe, it } from "node:test"
import { createCampaign, getCampaign, type Campaign, type GridScanRun } from "./campaigns.ts"
import { emptyApiKeys, resetHostedKeysCacheForTests } from "./hosted-keys.ts"
import { leaksVendorTalk, publicTrafficMessage } from "./public-copy.ts"
import { listingClickActions, listingNotInAreaMessage, sanitizeRunnerError } from "./scrappey-runner.ts"
import { reloadStoreFromDisk, resetStoreForTests, writeCollection } from "./store.ts"
import {
  appendTrafficLog,
  confirmedListingForTraffic,
  emptyTrafficJob,
  gridPinId,
  listingNotReadyForTrafficMessage,
  mapsKeywordAtPinUrl,
  mapsKeywordNearUrl,
  MAX_TRAFFIC_LOG_LINES,
  noKeywordsSelectedMessage,
  noPinsSelectedMessage,
  normalizeTrafficSearches,
  normalizeTrafficSessions,
  pairsForTraffic,
  pinsForTraffic,
  pickTrafficOrigins,
  planTrafficPairs,
  recoverStaleTrafficJobs,
  resetTrafficRuntimeForTests,
  runCampaignTraffic,
  selectTrafficKeywords,
  startCampaignTraffic,
  stopCampaignTraffic,
  trafficPairLabel,
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
        locationCoordinate: "30.28,-97.75,17z",
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
        locationCoordinate: "30.26,-97.73,17z",
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

function pinIdsFor(campaign: Campaign): string[] {
  return (campaign.lastGridScan?.points ?? []).map((point) => gridPinId(point))
}

describe("normalizeTrafficSessions", () => {
  it("defaults to 3 and caps at 50", () => {
    assert.equal(normalizeTrafficSessions(undefined), 3)
    assert.equal(normalizeTrafficSearches(undefined), 3)
    assert.equal(normalizeTrafficSessions(1), 1)
    assert.equal(normalizeTrafficSessions(20), 20)
    assert.equal(normalizeTrafficSessions(50), 50)
    assert.equal(normalizeTrafficSessions(99), 50)
    assert.equal(normalizeTrafficSessions(0), 3)
    assert.equal(normalizeTrafficSessions(1.5), 3)
  })
})

describe("mapsKeywordNearUrl", () => {
  it("drops a Maps search at the pin GPS", () => {
    const url = mapsKeywordNearUrl("barbecue", 30.27, -97.74)
    assert.match(url, /^https:\/\/www\.google\.com\/maps\/search\/barbecue\/@30\.27,-97\.74,17z$/)
    const fromPin = mapsKeywordAtPinUrl("barbecue", { lat: 30.28, lng: -97.75, locationCoordinate: "30.28,-97.75,17z" })
    assert.match(fromPin, /\/@30\.28,-97\.75,17z$/)
    assert.equal(fromPin.includes("Austin"), false)
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
  it("targets the confirmed placeId, CID, and exact title — not the first Maps result", () => {
    const actions = listingClickActions({
      title: 'Joe\'s "Pizza"',
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Joe&query_place_id=ChIJ-joe",
      placeId: "ChIJ-joe",
      cid: "12345",
    })
    assert.ok(actions.some((action) => action.cssSelector === 'a[href*="ChIJ-joe"]'))
    assert.ok(actions.some((action) => action.cssSelector === 'a[href*="cid=12345"]'))
    assert.ok(actions.some((action) => /aria-label="Joe\\'s \\"Pizza\\""/.test(action.cssSelector || "") || /aria-label="Joe/.test(action.cssSelector || "")))
    assert.equal(actions.some((action) => action.cssSelector === 'a[href*="/maps/place/"]'), false)
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

describe("appendTrafficLog", () => {
  it("appends lines and caps the log length", () => {
    let job = emptyTrafficJob()
    job = appendTrafficLog(job, "Started pin 0:0 at 30.28000, -97.75000.", "0:0")
    assert.equal(job.log?.length, 1)
    assert.match(job.log?.[0]?.message || "", /Started pin/)
    for (let index = 0; index < MAX_TRAFFIC_LOG_LINES + 20; index += 1) {
      job = appendTrafficLog(job, `line ${index}`)
    }
    assert.equal(job.log?.length, MAX_TRAFFIC_LOG_LINES)
    assert.match(job.log?.[0]?.message || "", /line /)
    assert.equal(job.log?.at(-1)?.message, `line ${MAX_TRAFFIC_LOG_LINES + 19}`)
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

  afterEach(async () => {
    await resetTrafficRuntimeForTests()
  })

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
      () => runCampaignTraffic(campaign.id, emptyApiKeys(), ["0:0"], "user-a"),
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
      () => runCampaignTraffic(campaign.id, emptyApiKeys(), ["0:0"], "user-a"),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.message, listingNotReadyForTrafficMessage())
        assert.equal((error as { status?: number }).status, 400)
        return true
      },
    )
  })

  it("cannot start with zero pins", async () => {
    isolateKeys()
    process.env.SCRAPPEY_API_KEY = "scp_test_runner_key"
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-traffic-zeropin-")))
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
      () => runCampaignTraffic(created.id, emptyApiKeys(), [], "user-a"),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.message, noPinsSelectedMessage())
        assert.equal((error as { status?: number }).status, 400)
        return true
      },
    )
    await assert.rejects(
      () => runCampaignTraffic(created.id, emptyApiKeys(), undefined, "user-a"),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.message, noPinsSelectedMessage())
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
      () => runCampaignTraffic(created.id, emptyApiKeys(), pinIdsFor(attachScan(created, true)), "user-a"),
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
    const pins = pinsForTraffic(scanned, pinIdsFor(scanned))
    assert.equal(pins.length, 2)
    assert.equal(pins[0]?.lat, 30.28)
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

  it("runs one session per selected pin from that pin GPS and appends a log", async () => {
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
    const scanned = attachScan(created, true)
    const selectedPins = pinIdsFor(scanned)

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
      const result = await runCampaignTraffic(created.id, emptyApiKeys(), selectedPins, "user-a")
      assert.equal(result.traffic.status, "ok")
      assert.equal(result.traffic.sessionsRequested, 2)
      assert.equal(result.traffic.sessionsOk, 2)
      assert.equal(result.traffic.sessionsFailed, 0)
      assert.ok(result.traffic.requestCount >= 4)
      assert.equal(result.campaign.lastTrafficJob?.status, "ok")
      assert.ok((result.traffic.log?.length ?? 0) >= 4)
      assert.ok(result.traffic.log?.some((line) => /Started pin/.test(line.message)))
      assert.ok(result.traffic.log?.some((line) => /searching barbecue at 30\.28,-97\.75/.test(line.message)))
      assert.ok(result.traffic.log?.some((line) => /opened Franklin Barbecue/.test(line.message)))
      assert.ok(result.traffic.log?.some((line) => /searching barbecue at /.test(line.message)))
      assert.equal(result.traffic.results?.length, 2)
      assert.ok(result.traffic.results?.every((row) => row.status === "ok"))
      assert.ok(cmds.includes("sessions.create"))
      assert.ok(cmds.includes("request.get"))
      assert.ok(urls.some((url) => url.includes("/maps/search/barbecue/@30.28,-97.75,17z")))
      assert.ok(urls.some((url) => url.includes("/maps/search/barbecue/@30.26,-97.73,17z")))
      assert.equal(urls.some((url) => /Austin|city/i.test(url) && url.includes("maps/search")), false)
      assert.ok(urls.some((url) => url.includes("query_place_id=ChIJ123")))
      assert.equal(profiles.size, 1)
      assert.ok([...profiles][0]?.startsWith("pf-"))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("preserves campaign keyword order and rejects an empty selection", async () => {
    isolateKeys()
    process.env.SCRAPPEY_API_KEY = "scp_test_runner_key"
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-traffic-keywords-")))
    const created = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        keywords: ["barbecue", "brisket", "smoked meats"],
        placeId: "ChIJ123",
        center: { lat: 30.27, lng: -97.74 },
      },
      "user-a",
    )
    const scanned = attachScan(created, true)
    assert.deepEqual(selectTrafficKeywords(scanned, { keywords: ["smoked meats", "barbecue"] }), [
      "barbecue",
      "smoked meats",
    ])
    assert.deepEqual(selectTrafficKeywords(scanned, { keywordIds: ["2", "0"] }), ["barbecue", "smoked meats"])
    assert.deepEqual(selectTrafficKeywords(scanned), ["barbecue", "brisket", "smoked meats"])
    assert.deepEqual(selectTrafficKeywords(scanned, { keywords: [] }), [])
    assert.deepEqual(selectTrafficKeywords(scanned, { keywords: "ribs, barbecue" }), ["barbecue", "ribs"])
    assert.deepEqual(selectTrafficKeywords(scanned, { keywords: ["sliced brisket"] }), ["sliced brisket"])
    const pins = pinsForTraffic(scanned, pinIdsFor(scanned))
    const pairs = pairsForTraffic(pins, ["barbecue", "smoked meats"])
    assert.deepEqual(
      pairs.map((pair) => `${pair.pinId}:${pair.keyword}`),
      ["0:0:barbecue", "0:0:smoked meats", "0:1:barbecue", "0:1:smoked meats"],
    )
    assert.deepEqual(
      planTrafficPairs(pairs, 3).map((pair) => `${pair.pinId}:${pair.keyword}`),
      ["0:0:barbecue", "0:0:smoked meats", "0:1:barbecue"],
    )
    await assert.rejects(
      () => runCampaignTraffic(created.id, emptyApiKeys(), { pinIds: pinIdsFor(scanned), keywords: [] }, "user-a"),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.message, noKeywordsSelectedMessage())
        assert.equal((error as { status?: number }).status, 400)
        return true
      },
    )
    await assert.rejects(
      () => runCampaignTraffic(created.id, emptyApiKeys(), { pinIds: pinIdsFor(scanned), keywordIds: [] }, "user-a"),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.message, noKeywordsSelectedMessage())
        return true
      },
    )
  })

  it("searches selected keywords in listed order from each pin and names them in the log", async () => {
    isolateKeys()
    process.env.SCRAPPEY_API_KEY = "scp_test_runner_key"
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-traffic-kworder-")))
    const created = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        keywords: ["barbecue", "brisket", "smoked meats"],
        placeId: "ChIJ123",
        center: { lat: 30.27, lng: -97.74 },
      },
      "user-a",
    )
    const scanned = attachScan(created, true)
    const originalFetch = globalThis.fetch
    const urls: string[] = []
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as { url?: string }
      if (body.url) urls.push(body.url)
      return new Response(JSON.stringify({ solution: { verified: true, currentUrl: body.url, markdown: "# Franklin Barbecue" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as typeof fetch

    try {
      const result = await runCampaignTraffic(
        created.id,
        emptyApiKeys(),
        { pinIds: ["0:0"], keywords: ["smoked meats", "barbecue"] },
        "user-a",
      )
      assert.equal(result.traffic.status, "ok")
      assert.deepEqual(result.traffic.keywords, ["barbecue", "smoked meats"])
      assert.equal(result.traffic.sessionsRequested, 2)
      assert.equal(result.traffic.sessionsOk, 2)
      const searchUrls = urls.filter((url) => url.includes("/maps/search/"))
      const firstBarbecue = searchUrls.findIndex((url) => url.includes("/maps/search/barbecue/@30.28,-97.75,17z"))
      const firstSmoked = searchUrls.findIndex((url) => url.includes("/maps/search/smoked%20meats/@30.28,-97.75,17z"))
      assert.ok(firstBarbecue >= 0)
      assert.ok(firstSmoked >= 0)
      assert.ok(firstBarbecue < firstSmoked)
      assert.ok(result.traffic.log?.every((line) => !line.pinId || (line.keyword && /\d+\.\d+,\s*-?\d+\.\d+/.test(line.message))))
      assert.ok(result.traffic.log?.some((line) => line.message.includes("barbecue") && line.message.includes("30.28000")))
      assert.ok(result.traffic.log?.some((line) => line.message.includes("smoked meats") && line.message.includes("30.28000")))
      assert.equal(trafficPairLabel("barbecue", { lat: 30.28, lng: -97.75 }), "“barbecue” · 30.28000, -97.75000")
      assert.deepEqual(
        result.traffic.results?.map((row) => `${row.pinId}:${row.keyword}:${row.status}`),
        ["0:0:barbecue:ok", "0:0:smoked meats:ok"],
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("stop flips a running job to stopped", async () => {
    isolateKeys()
    process.env.SCRAPPEY_API_KEY = "scp_test_runner_key"
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-traffic-stop-")))
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
    const scanned = attachScan(created, true)
    const originalFetch = globalThis.fetch
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(
            new Response(JSON.stringify({ solution: { verified: true } }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          )
        }, 20_000)
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer)
          const error = new Error("Aborted")
          error.name = "AbortError"
          reject(error)
        })
      })
    }) as typeof fetch

    try {
      const started = startCampaignTraffic(created.id, emptyApiKeys(), pinIdsFor(scanned), "user-a")
      assert.equal(started.traffic.status, "running")
      const stopped = stopCampaignTraffic(created.id, "user-a")
      assert.equal(stopped.traffic.status, "stopped")
      assert.equal(stopped.campaign.lastTrafficJob?.status, "stopped")
      assert.ok(stopped.traffic.log?.some((line) => /Stop requested/.test(line.message)))
      assert.ok(stopped.traffic.results?.every((row) => row.status === "cancelled" || row.status === "fail"))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("caps pin × keyword pairs at the chosen search count and remembers it", async () => {
    isolateKeys()
    process.env.SCRAPPEY_API_KEY = "scp_test_runner_key"
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-traffic-cap-")))
    const created = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        keywords: ["barbecue", "brisket"],
        placeId: "ChIJ123",
        center: { lat: 30.27, lng: -97.74 },
      },
      "user-a",
    )
    attachScan(created, true)
    const originalFetch = globalThis.fetch
    const urls: string[] = []
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as { url?: string }
      if (body.url) urls.push(body.url)
      return new Response(JSON.stringify({ solution: { verified: true, currentUrl: body.url, markdown: "# Franklin Barbecue" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as typeof fetch

    try {
      const result = await runCampaignTraffic(
        created.id,
        emptyApiKeys(),
        { pinIds: pinIdsFor(attachScan(created, true)), keywords: ["barbecue", "brisket"], searches: 3 },
        "user-a",
      )
      assert.equal(result.traffic.sessionsRequested, 3)
      assert.equal(result.traffic.sessionsOk, 3)
      assert.equal(result.campaign.trafficSchedule.lastSearchCount, 3)
      assert.equal(result.campaign.trafficSchedule.lastDwellSeconds, 20)
      assert.equal(result.traffic.dwellSeconds, 20)
      assert.ok(result.traffic.log?.some((line) => /stayed 20s on the listing/.test(line.message)))
      const searchUrls = urls.filter((url) => /\/maps\/search\/[^?]+\/@/.test(url))
      assert.equal(searchUrls.length, 3)
      assert.ok(result.traffic.log?.some((line) => /3 of 4 searches/.test(line.message)))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("closes a leftover running job after a server restart", () => {
    isolateKeys()
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-traffic-stale-")))
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
    const scanned = attachScan(created, true)
    writeCollection("campaigns", [
      {
        ...scanned,
        lastTrafficJob: {
          ...emptyTrafficJob(),
          id: "stale-job",
          status: "running",
          startedAt: "2026-09-06T03:55:54.456Z",
          sessionsRequested: 2,
        },
      },
    ])
    assert.equal(recoverStaleTrafficJobs(), 1)
    const latest = getCampaign(created.id, "user-a")
    assert.equal(latest?.lastTrafficJob?.status, "error")
    assert.match(latest?.lastTrafficJob?.lastError || "", /server restarted/)
    assert.ok(latest?.lastTrafficJob?.log?.some((line) => /server restarted/.test(line.message)))
  })

  it("keeps a slow runner timeout as timed out so polling can keep the job visible", async () => {
    isolateKeys()
    process.env.SCRAPPEY_API_KEY = "scp_test_runner_key"
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-traffic-timeout-")))
    const created = createCampaign(
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
    attachScan(created, true)
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError")
    }) as typeof fetch

    try {
      const result = await runCampaignTraffic(created.id, emptyApiKeys(), ["0:0"], "user-a")
      assert.equal(result.traffic.status, "error")
      assert.equal(result.traffic.sessionsFailed, 1)
      assert.equal(result.traffic.lastError, "Traffic runner timed out.")
      assert.equal(result.traffic.lastError?.includes("reach"), false)
      assert.ok(result.traffic.log?.some((line) => /Session failed\. Traffic runner timed out/.test(line.message)))
      assert.equal(result.traffic.log?.some((line) => /Could not reach the traffic runner/.test(line.message)), false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("fails one session when the confirmed listing is not in that pin's results, without throwing 500", async () => {
    isolateKeys()
    process.env.SCRAPPEY_API_KEY = "scp_test_runner_key"
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-traffic-nomatch-")))
    const created = createCampaign(
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
    const scanned = attachScan(created, true)
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as { url?: string }
      return new Response(
        JSON.stringify({
          solution: {
            verified: true,
            currentUrl: body.url,
            markdown: "# La Barbecue\n# Terry Black's Barbecue",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }) as typeof fetch

    try {
      const result = await runCampaignTraffic(created.id, emptyApiKeys(), ["0:0"], "user-a")
      assert.equal(result.traffic.status, "error")
      assert.equal(result.traffic.sessionsFailed, 1)
      assert.equal(result.traffic.sessionsOk, 0)
      assert.equal(result.traffic.results?.[0]?.status, "fail")
      assert.ok(result.traffic.log?.some((line) => line.message.includes(listingNotInAreaMessage())))
      assert.equal(result.traffic.lastError, listingNotInAreaMessage())
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
