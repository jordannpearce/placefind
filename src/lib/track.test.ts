import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  campaignInputFromListing,
  campaignScanFinished,
  confirmedListingFromCampaign,
  confirmedListingFromSearch,
  listingsFromSearch,
  scanBusinessEnabled,
  searchChanged,
  noPinsSelectedMessage,
  startTrafficEnabled,
  startTrafficLabel,
  startTrafficVisible,
  stopTrafficVisible,
  trafficLogEmptyCopy,
} from "./track.ts"
import type { BusinessListing, Campaign, SearchResponse, TrafficJob } from "./types.ts"

const franklin: BusinessListing = {
  title: "Franklin Barbecue",
  address: "900 E 11th St, Austin, TX 78702",
  city: "Austin",
  state: "TX",
  rating: 4.7,
  reviewCount: 8412,
  placeId: "sample-franklin",
  lat: 30.2701,
  lng: -97.7313,
  mapsUrl: "https://maps.example.test/franklin",
  source: "sample",
  matchScore: 1,
  isBestMatch: true,
}

function campaign(partial: Partial<Campaign> = {}): Campaign {
  return {
    id: "c1",
    name: "Austin BBQ",
    businessName: "Franklin Barbecue",
    city: "Austin",
    state: "TX",
    keywords: ["barbecue"],
    gridSize: 5,
    spacingMiles: 1,
    center: null,
    createdAt: "2026-09-06T00:00:00.000Z",
    updatedAt: "2026-09-06T00:00:00.000Z",
    lastScan: null,
    lastGridScan: null,
    recentScans: [],
    ...partial,
  }
}

describe("scanBusinessEnabled", () => {
  it("stays off until a listing is selected", () => {
    assert.equal(scanBusinessEnabled(null), false)
    assert.equal(scanBusinessEnabled(confirmedListingFromSearch({ ...franklin, placeId: "" })), false)
    assert.equal(scanBusinessEnabled(confirmedListingFromSearch({ ...franklin, lat: null })), false)
  })

  it("enables scan after the user confirms a Maps listing", () => {
    const selected = confirmedListingFromSearch(franklin)
    assert.ok(selected)
    assert.equal(scanBusinessEnabled(selected), true)
    assert.equal(selected?.placeId, "sample-franklin")
    assert.equal(selected?.title, "Franklin Barbecue")
    assert.equal(selected?.lat, 30.2701)
  })
})

describe("listingsFromSearch", () => {
  it("lists best then other matches without duplicates", () => {
    const result: SearchResponse = {
      query: { name: "Franklin Barbecue", city: "Austin", state: "TX" },
      best: franklin,
      others: [franklin, { ...franklin, title: "Franklin BBQ Truck", placeId: "sample-truck", isBestMatch: false }],
      mode: "sample",
      sources: { dataforseo: false, scrappey: false },
      elapsedMs: 12,
    }
    const rows = listingsFromSearch(result)
    assert.equal(rows.length, 2)
    assert.equal(rows[0]?.title, "Franklin Barbecue")
    assert.equal(rows[1]?.title, "Franklin BBQ Truck")
  })
})

describe("confirmedListingFromCampaign", () => {
  it("returns null when the campaign has no selected listing", () => {
    assert.equal(confirmedListingFromCampaign(campaign()), null)
    assert.equal(scanBusinessEnabled(confirmedListingFromCampaign(campaign())), false)
  })

  it("restores a stored listing so scan stays enabled", () => {
    const selected = confirmedListingFromCampaign(
      campaign({
        placeId: "sample-franklin",
        listingTitle: "Franklin Barbecue",
        listingAddress: "900 E 11th St, Austin, TX 78702",
        center: { lat: 30.2701, lng: -97.7313 },
      }),
    )
    assert.ok(selected)
    assert.equal(scanBusinessEnabled(selected), true)
    assert.equal(selected?.address, "900 E 11th St, Austin, TX 78702")
  })
})

describe("campaignInputFromListing", () => {
  it("stores placeId, lat, lng, title, and address", () => {
    const selected = confirmedListingFromSearch(franklin)
    assert.ok(selected)
    const input = campaignInputFromListing(selected, { name: "Franklin", city: "Austin", state: "TX" }, { keywords: ["barbecue"] })
    assert.equal(input.placeId, "sample-franklin")
    assert.deepEqual(input.center, { lat: 30.2701, lng: -97.7313 })
    assert.equal(input.listingTitle, "Franklin Barbecue")
    assert.equal(input.listingAddress, "900 E 11th St, Austin, TX 78702")
    assert.deepEqual(input.keywords, ["barbecue"])
  })
})

describe("start traffic button", () => {
  const scanned = campaign({
    placeId: "sample-franklin",
    listingTitle: "Franklin Barbecue",
    listingAddress: "900 E 11th St, Austin, TX 78702",
    center: { lat: 30.2701, lng: -97.7313 },
    lastGridScan: {
      id: "g1",
      scannedAt: "2026-09-06T00:00:00.000Z",
      keyword: "barbecue",
      gridSize: 3,
      spacingMiles: 1,
      center: { lat: 30.2701, lng: -97.7313 },
      pointCount: 9,
      foundCount: 0,
      points: [],
    },
  })

  it("is visible after confirm and stays visible when a scan found nothing", () => {
    const listing = confirmedListingFromCampaign(scanned)
    assert.equal(startTrafficVisible(listing), true)
    assert.equal(campaignScanFinished(scanned), true)
    assert.equal(campaignScanFinished(campaign()), false)
    assert.equal(startTrafficEnabled({ listing, campaign: scanned }), true)
    assert.equal(startTrafficEnabled({ listing, campaign: campaign({ placeId: "sample-franklin" }) }), false)
  })

  it("disables while a scan is running and labels Scan first before one exists", () => {
    const listing = confirmedListingFromSearch(franklin)
    assert.equal(startTrafficLabel({ scanFinished: false }), "Scan first")
    assert.equal(startTrafficLabel({ scanning: true, scanFinished: false }), "Scanning…")
    assert.equal(startTrafficLabel({ starting: true, scanFinished: true }), "Starting traffic…")
    assert.equal(startTrafficLabel({ scanFinished: true }), "Start Traffic")
    assert.equal(startTrafficEnabled({ listing, campaign: scanned, scanning: true }), false)
    assert.equal(startTrafficEnabled({ listing, campaign: scanned, running: true }), false)
    assert.equal(startTrafficVisible(null), false)
    assert.equal(stopTrafficVisible({ status: "running" } as TrafficJob), true)
    assert.equal(stopTrafficVisible({ status: "ok" } as TrafficJob), false)
    assert.equal(noPinsSelectedMessage(), "Select at least one pin")
    assert.match(trafficLogEmptyCopy(), /Select pins/)
  })
})

describe("searchChanged", () => {
  it("clears confirmation when the search fields change", () => {
    const query = { name: "Franklin Barbecue", city: "Austin", state: "TX" }
    assert.equal(searchChanged(query, query), false)
    assert.equal(searchChanged(query, { ...query, name: "Joe's Pizza" }), true)
  })
})
