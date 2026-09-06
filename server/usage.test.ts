import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, afterEach, describe, it } from "node:test"
import { leaksVendorTalk } from "./public-copy.ts"
import { reloadStoreFromDisk, resetStoreForTests, writeCollection } from "./store.ts"
import { CampaignError, createCampaign, scanCampaign, type Campaign, type GridScanRun } from "./campaigns.ts"
import { emptyApiKeys, resetHostedKeysCacheForTests } from "./hosted-keys.ts"
import {
  gridPinId,
  listingNotReadyForTrafficMessage,
  resetTrafficRuntimeForTests,
  startCampaignTraffic,
  stopCampaignTraffic,
} from "./traffic.ts"
import { AiPromptError, AI_PROMPTS_NOT_CONNECTED_MESSAGE, submitAiPrompt } from "./ai-prompts.ts"
import { accountUsageFor, consumeMonthlyUsage, QuotaError, readMonthlyUsage } from "./usage.ts"
import {
  MONTHLY_AI_PROMPTS,
  MONTHLY_RANK_SCANS,
  MONTHLY_TRAFFIC_CAMPAIGNS,
  quotaExceededMessage,
} from "../src/lib/quotas.ts"

function isolateData(label: string) {
  resetStoreForTests(mkdtempSync(path.join(tmpdir(), `placefind-usage-${label}-`)))
}

function writeUser(input: { id: string; role: "customer" | "admin" }) {
  writeCollection("users", [
    {
      id: input.id,
      name: input.role === "admin" ? "Admin" : "Casey",
      email: `${input.id}@example.com`,
      passwordHash: "x",
      role: input.role,
      status: "active",
      createdAt: "2026-09-01T00:00:00.000Z",
    },
  ])
}

function foundScan(campaign: Campaign): GridScanRun {
  return {
    id: "scan-1",
    scannedAt: "2026-09-06T00:00:00.000Z",
    keyword: "barbecue",
    gridSize: 3,
    spacingMiles: 1,
    zoom: 17,
    center: { lat: 30.27, lng: -97.74 },
    placeId: "ChIJ123",
    pointCount: 1,
    foundCount: 1,
    points: [
      {
        row: 0,
        col: 0,
        lat: 30.28,
        lng: -97.75,
        locationCoordinate: "30.28,-97.75,17z",
        keyword: "barbecue",
        rank: 1,
        listingTitle: "Franklin Barbecue",
        rating: 4.7,
        address: "900 E 11th St",
        mapsUrl: "https://www.google.com/maps/search/?api=1&query=Franklin&query_place_id=ChIJ123",
        scannedAt: "2026-09-06T00:00:00.000Z",
      },
    ],
  }
}

function attachScan(campaign: Campaign): Campaign {
  const next = { ...campaign, lastGridScan: foundScan(campaign), lastScan: null }
  writeCollection("campaigns", [next])
  return next
}

describe("monthly usage", () => {
  const previousAi = process.env.PLACEFIND_AI_PROMPTS_URL
  const previousLogin = process.env.DATAFORSEO_LOGIN
  const previousPassword = process.env.DATAFORSEO_PASSWORD
  const previousScrappey = process.env.SCRAPPEY_API_KEY
  const previousKeysFile = process.env.PLACEFIND_KEYS_FILE

  afterEach(async () => {
    await resetTrafficRuntimeForTests()
  })

  after(() => {
    if (previousAi == null) delete process.env.PLACEFIND_AI_PROMPTS_URL
    else process.env.PLACEFIND_AI_PROMPTS_URL = previousAi
    if (previousLogin == null) delete process.env.DATAFORSEO_LOGIN
    else process.env.DATAFORSEO_LOGIN = previousLogin
    if (previousPassword == null) delete process.env.DATAFORSEO_PASSWORD
    else process.env.DATAFORSEO_PASSWORD = previousPassword
    if (previousScrappey == null) delete process.env.SCRAPPEY_API_KEY
    else process.env.SCRAPPEY_API_KEY = previousScrappey
    if (previousKeysFile == null) delete process.env.PLACEFIND_KEYS_FILE
    else process.env.PLACEFIND_KEYS_FILE = previousKeysFile
    resetHostedKeysCacheForTests()
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("increments per user and rolls over on a new UTC month", () => {
    isolateData("rollover")
    writeUser({ id: "user-a", role: "customer" })
    const january = new Date("2026-01-15T12:00:00.000Z")
    const february = new Date("2026-02-01T00:00:00.000Z")
    consumeMonthlyUsage("user-a", "rankScans", january)
    consumeMonthlyUsage("user-a", "rankScans", january)
    assert.equal(readMonthlyUsage("user-a", january).rankScans, 2)
    assert.equal(accountUsageFor("user-a", "customer", january).rankScans.remaining, 2)
    assert.equal(readMonthlyUsage("user-a", february).rankScans, 0)
    assert.equal(accountUsageFor("user-a", "customer", february).rankScans.remaining, MONTHLY_RANK_SCANS)
  })

  it("returns tasteful 429 copy and does not cap admin", () => {
    isolateData("admin")
    writeCollection("users", [
      {
        id: "admin-1",
        name: "Admin",
        email: "admin-1@example.com",
        passwordHash: "x",
        role: "admin",
        status: "active",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "user-a",
        name: "Casey",
        email: "user-a@example.com",
        passwordHash: "x",
        role: "customer",
        status: "active",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    ])
    const now = new Date("2026-09-06T12:00:00.000Z")
    for (let index = 0; index < MONTHLY_RANK_SCANS; index += 1) {
      consumeMonthlyUsage("user-a", "rankScans", now)
    }
    assert.throws(
      () => consumeMonthlyUsage("user-a", "rankScans", now),
      (error: unknown) => {
        assert.ok(error instanceof QuotaError)
        assert.equal(error.status, 429)
        assert.equal(error.message, quotaExceededMessage("rankScans"))
        assert.equal(leaksVendorTalk(error.message), false)
        return true
      },
    )
    for (let index = 0; index < MONTHLY_RANK_SCANS + 1; index += 1) {
      consumeMonthlyUsage("admin-1", "rankScans", now)
    }
    const admin = accountUsageFor("admin-1", "admin", now)
    assert.equal(admin.unlimited, true)
    assert.equal(admin.rankScans.used, MONTHLY_RANK_SCANS + 1)
    assert.ok(admin.rankScans.remaining > 0)
  })

  it("does not increment a rank scan that never starts", async () => {
    isolateData("scan-skip")
    writeUser({ id: "user-a", role: "customer" })
    resetHostedKeysCacheForTests()
    process.env.PLACEFIND_KEYS_FILE = path.join(tmpdir(), "placefind-missing-usage-keys.json")
    delete process.env.DATAFORSEO_LOGIN
    delete process.env.DATAFORSEO_PASSWORD
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
    await assert.rejects(() => scanCampaign(campaign.id, emptyApiKeys(), ["barbecue"], "user-a"))
    assert.equal(readMonthlyUsage("user-a").rankScans, 0)
  })

  it("counts a started rank scan and returns 429 copy when the month is used up", async () => {
    isolateData("scan-429")
    writeUser({ id: "user-a", role: "customer" })
    resetHostedKeysCacheForTests()
    process.env.DATAFORSEO_LOGIN = "maps-login@example.test"
    process.env.DATAFORSEO_PASSWORD = "maps-password-test"
    const campaign = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        placeId: "sample-franklin",
        listingTitle: "Franklin Barbecue",
        listingAddress: "900 E 11th St, Austin, TX 78702",
        keywords: ["barbecue"],
        gridSize: 3,
        center: { lat: 30.2701, lng: -97.7313 },
      },
      "user-a",
    )
    const item = {
      type: "maps_search",
      rank_group: 1,
      title: "Franklin Barbecue",
      place_id: "sample-franklin",
      address: "900 E 11th St, Austin, TX 78702",
    }
    const result = await scanCampaign(campaign.id, emptyApiKeys(), ["barbecue"], "user-a", {
      client: {
        postTasks: async (tasks) => tasks.map((task) => ({ id: `task-${task.tag}`, tag: task.tag || "" })),
        getTask: async (id) => ({ id, status_code: 20000, result: [{ items: [item] }] }),
        liveAtCoordinate: async () => ({ items: [item], error: null }),
      },
      pollTimeoutMs: 20,
      sleep: async () => {},
    })
    assert.equal(result.grid.status, "ok")
    assert.equal(readMonthlyUsage("user-a").rankScans, 1)

    const now = new Date()
    for (let index = readMonthlyUsage("user-a").rankScans; index < MONTHLY_RANK_SCANS; index += 1) {
      consumeMonthlyUsage("user-a", "rankScans", now)
    }
    await assert.rejects(
      () =>
        scanCampaign(campaign.id, emptyApiKeys(), ["barbecue"], "user-a", {
          client: {
            postTasks: async () => {
              throw new Error("scan should not start")
            },
            getTask: async () => {
              throw new Error("scan should not start")
            },
            liveAtCoordinate: async () => {
              throw new Error("scan should not start")
            },
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof CampaignError)
        assert.equal(error.status, 429)
        assert.equal(error.message, "This account has used its 4 rank scans for this month.")
        assert.equal(leaksVendorTalk(error.message), false)
        return true
      },
    )
    assert.equal(readMonthlyUsage("user-a").rankScans, MONTHLY_RANK_SCANS)
  })

  it("does not increment traffic that never starts, then 429s after 30 starts", async () => {
    isolateData("traffic")
    writeUser({ id: "user-a", role: "customer" })
    resetHostedKeysCacheForTests()
    process.env.PLACEFIND_KEYS_FILE = path.join(tmpdir(), "placefind-missing-usage-traffic-keys.json")
    delete process.env.SCRAPPEY_API_KEY
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
    assert.throws(
      () => startCampaignTraffic(campaign.id, emptyApiKeys(), ["0:0"], "user-a"),
      (error: unknown) => {
        assert.ok(error instanceof CampaignError)
        assert.equal(error.message, listingNotReadyForTrafficMessage())
        return true
      },
    )
    assert.equal(readMonthlyUsage("user-a").trafficCampaigns, 0)

    const scanned = attachScan(campaign)
    process.env.SCRAPPEY_API_KEY = "scp_test_runner_key"
    resetHostedKeysCacheForTests()
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ solution: { verified: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch
    try {
      const started = startCampaignTraffic(scanned.id, emptyApiKeys(), [gridPinId(scanned.lastGridScan!.points[0]!)], "user-a")
      assert.equal(started.traffic.status, "running")
      stopCampaignTraffic(scanned.id, "user-a")
    } finally {
      globalThis.fetch = originalFetch
    }
    assert.equal(readMonthlyUsage("user-a").trafficCampaigns, 1)

    const now = new Date()
    for (let index = readMonthlyUsage("user-a").trafficCampaigns; index < MONTHLY_TRAFFIC_CAMPAIGNS; index += 1) {
      consumeMonthlyUsage("user-a", "trafficCampaigns", now)
    }
    assert.throws(
      () => startCampaignTraffic(scanned.id, emptyApiKeys(), [gridPinId(scanned.lastGridScan!.points[0]!)], "user-a"),
      (error: unknown) => {
        assert.ok(error instanceof CampaignError)
        assert.equal(error.status, 429)
        assert.equal(error.message, "This account has used its 30 traffic campaigns for this month.")
        assert.equal(leaksVendorTalk(error.message), false)
        return true
      },
    )
    assert.equal(readMonthlyUsage("user-a").trafficCampaigns, MONTHLY_TRAFFIC_CAMPAIGNS)
  })

  it("checks AI quota, does not increment when prompts are not connected, and increments when accepted", () => {
    isolateData("ai")
    writeUser({ id: "user-a", role: "customer" })
    delete process.env.PLACEFIND_AI_PROMPTS_URL
    assert.throws(
      () => submitAiPrompt("user-a", "customer"),
      (error: unknown) => {
        assert.ok(error instanceof AiPromptError)
        assert.equal(error.status, 503)
        assert.equal(error.message, AI_PROMPTS_NOT_CONNECTED_MESSAGE)
        assert.equal(/cloro/i.test(error.message), false)
        return true
      },
    )
    assert.equal(readMonthlyUsage("user-a").aiPrompts, 0)

    const now = new Date("2026-09-06T12:00:00.000Z")
    for (let index = 0; index < MONTHLY_AI_PROMPTS; index += 1) {
      consumeMonthlyUsage("user-a", "aiPrompts", now)
    }
    assert.throws(
      () => submitAiPrompt("user-a", "customer", now),
      (error: unknown) => {
        assert.ok(error instanceof QuotaError)
        assert.equal(error.status, 429)
        assert.equal(error.message, "This account has used its 10 AI prompts for this month.")
        return true
      },
    )

    isolateData("ai-accept")
    writeUser({ id: "user-a", role: "customer" })
    process.env.PLACEFIND_AI_PROMPTS_URL = "https://example.test/prompts"
    const accepted = submitAiPrompt("user-a", "customer", now)
    assert.equal(accepted.accepted, true)
    assert.equal(readMonthlyUsage("user-a", now).aiPrompts, 1)
  })
})
