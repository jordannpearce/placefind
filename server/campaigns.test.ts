import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import {
  CampaignError,
  MAX_KEYWORDS,
  MAX_GRID_SIZE,
  bestGridRank,
  buildGridPoints,
  createCampaign,
  hasConfirmedListing,
  listingNotConfirmedForScheduleMessage,
  listingNotConfirmedMessage,
  listCampaignScans,
  loadCampaignGrid,
  mapsKeysMissingMessage,
  mapsScanConfigured,
  mergeKeywordRanks,
  normalizeGridSize,
  normalizeKeywords,
  rankColor,
  readCampaigns,
  saveCampaign,
  scanCampaign,
  selectScanKeywords,
  updateCampaign,
  validateCampaign,
  type Campaign,
  type KeywordRank,
} from "./campaigns.ts"
import type { MapsGridClient, MapsItem } from "./dataforseo.ts"
import { emptyApiKeys, resetHostedKeysCacheForTests } from "./hosted-keys.ts"
import { reloadStoreFromDisk, resetStoreForTests } from "./store.ts"

function rank(keyword: string, position: number | null): KeywordRank {
  return {
    keyword,
    rank: position,
    listingTitle: position ? "Franklin Barbecue" : null,
    rating: position ? 4.7 : null,
    address: position ? "900 E 11th St, Austin, TX" : null,
    mapsUrl: position ? "https://www.google.com/maps?cid=1" : null,
    scannedAt: "2026-09-06T00:00:00.000Z",
  }
}

describe("normalizeKeywords", () => {
  it("trims, drops blanks, and keeps the first casing of duplicates", () => {
    assert.deepEqual(normalizeKeywords(["  barbecue ", "", "BBQ", "barbecue", "bbq"]), ["barbecue", "BBQ"])
  })

  it("returns an empty list for non-arrays", () => {
    assert.deepEqual(normalizeKeywords("barbecue"), [])
  })
})

describe("validateCampaign", () => {
  it("requires name, business, city, and state", () => {
    assert.equal(validateCampaign({}).error, "Enter a campaign name.")
    assert.equal(validateCampaign({ name: "Austin BBQ" }).error, "Enter the business name to track.")
    assert.equal(validateCampaign({ name: "Austin BBQ", businessName: "Franklin Barbecue" }).error, "Enter the city.")
    assert.equal(
      validateCampaign({ name: "Austin BBQ", businessName: "Franklin Barbecue", city: "Austin" }).error,
      "Choose a state.",
    )
  })

  it("accepts a campaign with no keywords yet", () => {
    const parsed = validateCampaign({
      name: "Austin BBQ",
      businessName: "Franklin Barbecue",
      city: "Austin",
      state: "TX",
    })
    assert.equal(parsed.error, undefined)
    assert.deepEqual(parsed.value?.keywords, [])
  })

  it("rejects more than the keyword cap", () => {
    const keywords = Array.from({ length: MAX_KEYWORDS + 1 }, (_, index) => `keyword ${index + 1}`)
    const parsed = validateCampaign({
      name: "Austin BBQ",
      businessName: "Franklin Barbecue",
      city: "Austin",
      state: "TX",
      keywords,
    })
    assert.equal(parsed.error, `A campaign can have at most ${MAX_KEYWORDS} keywords.`)
  })

  it("accepts the maximum number of unique keywords", () => {
    const keywords = Array.from({ length: MAX_KEYWORDS }, (_, index) => `keyword ${index + 1}`)
    const parsed = validateCampaign({
      name: "Austin BBQ",
      businessName: "Franklin Barbecue",
      city: "Austin",
      state: "TX",
      keywords,
    })
    assert.equal(parsed.value?.keywords.length, MAX_KEYWORDS)
  })

  it("defaults to a 5×5 grid and one-mile spacing", () => {
    const parsed = validateCampaign({
      name: "Austin BBQ",
      businessName: "Franklin Barbecue",
      city: "Austin",
      state: "TX",
    })
    assert.equal(parsed.value?.gridSize, 5)
    assert.equal(parsed.value?.spacingMiles, 1)
  })

  it("rejects a grid larger than 7×7", () => {
    const parsed = validateCampaign({
      name: "Austin BBQ",
      businessName: "Franklin Barbecue",
      city: "Austin",
      state: "TX",
      gridSize: MAX_GRID_SIZE + 2,
    })
    assert.match(parsed.error || "", /at most 7/)
  })

  it("rejects even grid sizes", () => {
    assert.equal(normalizeGridSize(4).error, "Choose a 3×3, 5×5, or 7×7 grid.")
  })
})

describe("buildGridPoints", () => {
  const center = { lat: 30.27, lng: -97.74 }

  it("builds a north-up 3×3 grid around the listing", () => {
    const points = buildGridPoints(center, 3, 1)
    assert.equal(points.length, 9)
    const middle = points.find((point) => point.row === 1 && point.col === 1)
    assert.ok(middle)
    assert.ok(Math.abs(middle.lat - center.lat) < 1e-9)
    assert.ok(Math.abs(middle.lng - center.lng) < 1e-9)
    const north = points.find((point) => point.row === 0 && point.col === 1)
    const south = points.find((point) => point.row === 2 && point.col === 1)
    assert.ok(north && south)
    assert.ok(north.lat > center.lat)
    assert.ok(south.lat < center.lat)
  })

  it("builds a 5×5 grid of 25 points including the center", () => {
    const points = buildGridPoints(center, 5, 1)
    assert.equal(points.length, 25)
    const middle = points.find((point) => point.row === 2 && point.col === 2)
    assert.ok(middle)
    assert.ok(Math.abs(middle.lat - center.lat) < 1e-9)
    assert.ok(Math.abs(middle.lng - center.lng) < 1e-9)
  })

  it("caps a 7×7 grid at 49 points including the center", () => {
    const points = buildGridPoints(center, 7, 0.5)
    assert.equal(points.length, 49)
    const middle = points.find((point) => point.row === 3 && point.col === 3)
    assert.ok(middle)
    assert.ok(Math.abs(middle.lat - center.lat) < 1e-9)
    assert.ok(Math.abs(middle.lng - center.lng) < 1e-9)
  })

  it("labels each cell with a lat,lng,zoom coordinate (max 7 decimals)", () => {
    const points = buildGridPoints({ lat: 40.689199, lng: -73.975035 }, 3, 1, 17)
    const centerPoint = points.find((point) => point.row === 1 && point.col === 1)
    assert.equal(centerPoint?.locationCoordinate, "40.689199,-73.975035,17z")
    assert.ok(points.every((point) => /^[-.\d]+,[-.\d]+,17z$/.test(point.locationCoordinate || "")))
    assert.ok(
      points.every((point) => {
        const [lat, lng] = (point.locationCoordinate || "").split(",")
        return (lat.split(".")[1] ?? "").length <= 7 && (lng.split(".")[1] ?? "").length <= 7
      }),
    )
  })
})

describe("rankColor and bestGridRank", () => {
  it("colors ranks for the map points", () => {
    assert.equal(rankColor(1), "green")
    assert.equal(rankColor(3), "green")
    assert.equal(rankColor(4), "yellow")
    assert.equal(rankColor(10), "yellow")
    assert.equal(rankColor(11), "red")
    assert.equal(rankColor(null), "red")
  })

  it("uses the best found rank and stays null when every point missed", () => {
    assert.equal(
      bestGridRank([
        { row: 0, col: 0, lat: 0, lng: 0, keyword: "bbq", rank: 8, listingTitle: null, rating: null, address: null, mapsUrl: null, scannedAt: "" },
        { row: 0, col: 1, lat: 0, lng: 0, keyword: "bbq", rank: 2, listingTitle: null, rating: null, address: null, mapsUrl: null, scannedAt: "" },
      ]),
      2,
    )
    assert.equal(
      bestGridRank([{ row: 0, col: 0, lat: 0, lng: 0, keyword: "bbq", rank: null, listingTitle: null, rating: null, address: null, mapsUrl: null, scannedAt: "" }]),
      null,
    )
  })
})

describe("campaign store", () => {
  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("keeps campaigns per account and stores grid settings", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-campaigns-")))
    const mine = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        keywords: ["barbecue"],
        gridSize: 7,
        spacingMiles: 1.5,
      },
      "user-a",
    )
    createCampaign(
      {
        name: "NY Pizza",
        businessName: "Joe's Pizza",
        city: "New York",
        state: "NY",
        keywords: ["pizza"],
      },
      "user-b",
    )
    assert.equal(mine.gridSize, 7)
    assert.equal(mine.spacingMiles, 1.5)
    assert.equal(mine.userId, "user-a")
    assert.equal(readCampaigns("user-a").length, 1)
    assert.equal(readCampaigns("user-b").length, 1)
    assert.equal(readCampaigns("user-a")[0]?.name, "Austin BBQ")
  })

  it("returns grid coordinates without scanning", async () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-grid-")))
    const campaign = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        keywords: ["barbecue"],
        gridSize: 5,
        center: { lat: 30.270128, lng: -97.739998 },
      },
      "user-a",
    )
    const preview = await loadCampaignGrid(campaign.id, "user-a")
    assert.equal(preview.points.length, 25)
    const middle = preview.points.find((point) => point.row === 2 && point.col === 2)
    assert.ok(middle)
    assert.ok(Math.abs(middle.lat - 30.270128) < 1e-9)
    assert.ok(Math.abs(middle.lng + 97.739998) < 1e-9)
    const three = await loadCampaignGrid(campaign.id, "user-a", { gridSize: 3 })
    assert.equal(three.points.length, 9)
    const seven = await loadCampaignGrid(campaign.id, "user-a", { gridSize: 7 })
    assert.equal(seven.points.length, 49)
  })

  it("persists the confirmed listing fields", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-listing-")))
    const campaign = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        placeId: "sample-franklin",
        listingTitle: "Franklin Barbecue",
        listingAddress: "900 E 11th St, Austin, TX 78702",
        center: { lat: 30.2701, lng: -97.7313 },
        keywords: ["barbecue"],
      },
      "user-a",
    )
    const stored = readCampaigns("user-a")[0]
    assert.equal(campaign.placeId, "sample-franklin")
    assert.equal(stored?.listingTitle, "Franklin Barbecue")
    assert.equal(stored?.listingAddress, "900 E 11th St, Austin, TX 78702")
    assert.deepEqual(stored?.center, { lat: 30.2701, lng: -97.7313 })
    assert.equal(hasConfirmedListing(stored!), true)
  })

  it("cannot enable a scan or traffic schedule without a confirmed listing", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-schedule-")))
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
    assert.equal(hasConfirmedListing(campaign), false)
    assert.throws(
      () =>
        updateCampaign(
          campaign.id,
          {
            scanSchedule: {
              enabled: true,
              cadence: "daily",
              hour: 9,
              minute: 0,
              timeZone: "utc",
            },
          },
          "user-a",
        ),
      (error: unknown) => {
        assert.ok(error instanceof CampaignError)
        assert.equal(error.status, 400)
        assert.equal(error.message, listingNotConfirmedForScheduleMessage())
        return true
      },
    )
    assert.throws(
      () =>
        updateCampaign(
          campaign.id,
          {
            trafficSchedule: {
              enabled: true,
              cadence: "weekly",
              hour: 8,
              minute: 30,
              weekday: 1,
              timeZone: "local",
              pinMode: "selected",
              lastSelectedPinIds: ["0:0"],
            },
          },
          "user-a",
        ),
      (error: unknown) => {
        assert.ok(error instanceof CampaignError)
        assert.equal(error.message, listingNotConfirmedForScheduleMessage())
        return true
      },
    )
    const confirmed = updateCampaign(
      campaign.id,
      {
        placeId: "sample-franklin",
        listingTitle: "Franklin Barbecue",
        center: { lat: 30.2701, lng: -97.7313 },
        scanSchedule: {
          enabled: true,
          cadence: "daily",
          hour: 9,
          minute: 0,
          timeZone: "utc",
        },
      },
      "user-a",
    )
    assert.equal(confirmed.scanSchedule.enabled, true)
    assert.ok(confirmed.scanSchedule.nextRunAt)
  })

  it("lists saved scans and backfills from the last grid snapshot", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-scan-history-")))
    const campaign = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        placeId: "sample-franklin",
        listingTitle: "Franklin Barbecue",
        center: { lat: 30.2701, lng: -97.7313 },
        keywords: ["barbecue"],
      },
      "user-a",
    )
    saveCampaign({
      ...campaign,
      lastGridScan: {
        id: "scan-old",
        startedAt: "2026-09-06T08:00:00.000Z",
        finishedAt: "2026-09-06T08:05:00.000Z",
        scannedAt: "2026-09-06T08:05:00.000Z",
        keyword: "barbecue",
        gridSize: 3,
        spacingMiles: 1,
        zoom: 17,
        center: { lat: 30.2701, lng: -97.7313 },
        placeId: "sample-franklin",
        pointCount: 1,
        foundCount: 1,
        points: [
          {
            row: 0,
            col: 0,
            lat: 30.2701,
            lng: -97.7313,
            keyword: "barbecue",
            rank: 5,
            listingTitle: "Franklin Barbecue",
            rating: 4.7,
            address: "900 E 11th St",
            mapsUrl: "https://maps.example.test/franklin",
            scannedAt: "2026-09-06T08:05:00.000Z",
          },
        ],
      },
    })
    const rows = listCampaignScans(campaign.id, "user-a")
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.id, "scan-old")
    assert.equal(rows[0]?.keyword, "barbecue")
    const again = listCampaignScans(campaign.id, "user-a")
    assert.equal(again.length, 1)
  })
})

describe("selectScanKeywords", () => {
  const campaign = {
    keywords: ["barbecue", "brisket", "best bbq"],
  } as Campaign

  it("scans every campaign keyword when none are requested", () => {
    assert.deepEqual(selectScanKeywords(campaign), ["barbecue", "brisket", "best bbq"])
  })

  it("only scans keywords that belong to the campaign", () => {
    assert.deepEqual(selectScanKeywords(campaign, ["Brisket", "pizza", ""]), ["Brisket"])
  })
})

describe("mergeKeywordRanks", () => {
  it("replaces scanned keywords and keeps the last rank for the others", () => {
    const merged = mergeKeywordRanks(
      ["barbecue", "brisket", "best bbq"],
      [rank("barbecue", 2), rank("brisket", 8)],
      [rank("brisket", 4)],
    )
    assert.deepEqual(
      merged.map((row) => [row.keyword, row.rank]),
      [
        ["barbecue", 2],
        ["brisket", 4],
      ],
    )
  })

  it("drops ranks for keywords that were removed from the campaign", () => {
    const merged = mergeKeywordRanks(["barbecue"], [rank("barbecue", 1), rank("brisket", 3)], [])
    assert.deepEqual(
      merged.map((row) => row.keyword),
      ["barbecue"],
    )
  })
})

describe("mapsKeysMissingMessage", () => {
  it("does not tell operators to open Settings", () => {
    assert.equal(/settings/i.test(mapsKeysMissingMessage()), false)
  })

  it("stays vendor-free for public rank scans", () => {
    assert.equal(mapsKeysMissingMessage(), "Maps search is not configured, so a rank scan cannot run.")
  })
})

describe("rank scan Maps keys", () => {
  const previous = {
    keysFile: process.env.PLACEFIND_KEYS_FILE,
    login: process.env.DATAFORSEO_LOGIN,
    password: process.env.DATAFORSEO_PASSWORD,
    scrappey: process.env.SCRAPPEY_API_KEY,
    dataDir: process.env.PLACEFIND_DATA_DIR,
  }

  function isolateKeys() {
    resetHostedKeysCacheForTests()
    process.env.PLACEFIND_KEYS_FILE = path.join(tmpdir(), "placefind-missing-hosted-keys.json")
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

  it("returns the public message when Maps keys are missing", async () => {
    isolateKeys()
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-scan-keys-")))
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
    assert.equal(mapsScanConfigured(emptyApiKeys()), false)
    await assert.rejects(
      () => scanCampaign(campaign.id, emptyApiKeys(), ["barbecue"], "user-a"),
      (error: unknown) => {
        assert.ok(error instanceof CampaignError)
        assert.equal(error.message, "Maps search is not configured, so a rank scan cannot run.")
        return true
      },
    )
  })

  it("passes the configured check when env Maps keys are present", () => {
    isolateKeys()
    process.env.DATAFORSEO_LOGIN = "maps-login@example.test"
    process.env.DATAFORSEO_PASSWORD = "maps-password-test"
    assert.equal(mapsScanConfigured(emptyApiKeys()), true)
  })

  it("cannot scan without a selected listing", async () => {
    isolateKeys()
    process.env.DATAFORSEO_LOGIN = "maps-login@example.test"
    process.env.DATAFORSEO_PASSWORD = "maps-password-test"
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-scan-listing-")))
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
    assert.equal(hasConfirmedListing(campaign), false)
    await assert.rejects(
      () => scanCampaign(campaign.id, emptyApiKeys(), ["barbecue"], "user-a"),
      (error: unknown) => {
        assert.ok(error instanceof CampaignError)
        assert.equal(error.status, 400)
        assert.equal(error.message, listingNotConfirmedMessage())
        return true
      },
    )
  })

  it("cannot scan a confirmed listing that has no map coordinates", async () => {
    isolateKeys()
    process.env.DATAFORSEO_LOGIN = "maps-login@example.test"
    process.env.DATAFORSEO_PASSWORD = "maps-password-test"
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-scan-center-")))
    const campaign = createCampaign(
      {
        name: "Austin BBQ",
        businessName: "Franklin Barbecue",
        city: "Austin",
        state: "TX",
        placeId: "sample-franklin",
        listingTitle: "Franklin Barbecue",
        keywords: ["barbecue"],
      },
      "user-a",
    )
    assert.equal(hasConfirmedListing(campaign), true)
    await assert.rejects(
      () => scanCampaign(campaign.id, emptyApiKeys(), ["barbecue"], "user-a"),
      (error: unknown) => {
        assert.ok(error instanceof CampaignError)
        assert.equal(error.status, 400)
        assert.match(error.message, /map location/i)
        return true
      },
    )
  })

  it("does not abort the grid when one pin fails", async () => {
    isolateKeys()
    process.env.DATAFORSEO_LOGIN = "maps-login@example.test"
    process.env.DATAFORSEO_PASSWORD = "maps-password-test"
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-scan-pin-fail-")))
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
    const item: MapsItem = {
      type: "maps_search",
      rank_group: 2,
      title: "Franklin Barbecue",
      place_id: "sample-franklin",
      address: "900 E 11th St, Austin, TX 78702",
    }
    const client: MapsGridClient = {
      postTasks: async (tasks) => tasks.map((task) => ({ id: `task-${task.tag}`, tag: task.tag || "" })),
      getTask: async (id) => {
        if (id === "task-0:0") throw new Error("task_get failed")
        return { id, status_code: 20000, result: [{ items: [item] }] }
      },
      liveAtCoordinate: async (_keyword, point) => {
        if (point.id === "0:0") throw new Error("live failed")
        return { items: [item], error: null }
      },
    }
    const result = await scanCampaign(campaign.id, emptyApiKeys(), ["barbecue"], "user-a", {
      client,
      pollTimeoutMs: 20,
      sleep: async () => {},
    })
    assert.equal(result.grid.points.length, 9)
    assert.equal(result.grid.status, "ok")
    assert.equal(result.grid.points.filter((point) => point.status === "error").length, 1)
    assert.ok(result.grid.points.filter((point) => point.status === "rank").length >= 7)
    assert.equal(result.grid.points.find((point) => point.row === 0 && point.col === 0)?.status, "error")
    assert.match(result.grid.points.find((point) => point.row === 0 && point.col === 0)?.error || "", /Could not reach Maps|timed out|could not finish/i)
  })

  it("finalizes all 9 pins when only the center listing matches", async () => {
    isolateKeys()
    process.env.DATAFORSEO_LOGIN = "maps-login@example.test"
    process.env.DATAFORSEO_PASSWORD = "maps-password-test"
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-scan-one-rank-")))
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
    const client: MapsGridClient = {
      postTasks: async (tasks) => tasks.map((task) => ({ id: `task-${task.tag}`, tag: task.tag || "" })),
      getTask: async (id) => {
        const center = id === "task-1:1"
        return {
          id,
          status_code: 20000,
          result: [
            {
              items: center
                ? [{ type: "maps_search", rank_group: 1, title: "Franklin Barbecue", place_id: "sample-franklin" }]
                : [{ type: "maps_search", rank_group: 1, title: "Other BBQ", place_id: "other" }],
            },
          ],
        }
      },
      liveAtCoordinate: async () => {
        throw new Error("live fallback should not run")
      },
    }
    const result = await scanCampaign(campaign.id, emptyApiKeys(), ["barbecue"], "user-a", {
      client,
      pollTimeoutMs: 20,
      sleep: async () => {},
    })
    assert.equal(result.grid.points.length, 9)
    assert.ok(result.grid.points.every((point) => point.status === "rank" || point.status === "not_found" || point.status === "error"))
    assert.equal(result.grid.points.filter((point) => point.status === "rank").length, 1)
    assert.equal(result.grid.points.filter((point) => point.status === "not_found").length, 8)
    assert.equal(result.grid.zoom, 14)
    assert.ok(result.grid.points.every((point) => (point.locationCoordinate || "").endsWith(",14z")))
  })
})
