import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { scheduledScanKeyword, scheduledScanKeywords } from "./scheduler.ts"
import type { Campaign } from "./campaigns.ts"

function campaign(partial: Partial<Campaign> = {}): Campaign {
  return {
    id: "c1",
    userId: "user-a",
    name: "Austin BBQ",
    businessName: "Franklin Barbecue",
    city: "Austin",
    state: "TX",
    placeId: "",
    listingTitle: "",
    listingAddress: "",
    keywords: [],
    gridSize: 5,
    spacingMiles: 1,
    zoom: 14,
    pinSource: "grid",
    center: null,
    createdAt: "2026-09-06T00:00:00.000Z",
    updatedAt: "2026-09-06T00:00:00.000Z",
    lastScan: null,
    lastGridScan: null,
    recentScans: [],
    recentGridScans: [],
    lastTrafficJob: null,
    ...partial,
  }
}

describe("scheduledScanKeywords", () => {
  it("uses every saved campaign keyword", () => {
    assert.deepEqual(
      scheduledScanKeywords(campaign({ keywords: ["barbecue", "brisket"] })),
      ["barbecue", "brisket"],
    )
    assert.equal(scheduledScanKeyword(campaign({ keywords: ["barbecue", "brisket"] })), "barbecue")
  })

  it("falls back to a legacy single-keyword scan", () => {
    assert.deepEqual(
      scheduledScanKeywords(
        campaign({
          lastGridScan: {
            id: "g1",
            scannedAt: "2026-09-06T00:00:00.000Z",
            keyword: "barbecue",
            gridSize: 3,
            spacingMiles: 1,
            zoom: 14,
            center: { lat: 30.27, lng: -97.74 },
            placeId: null,
            pointCount: 9,
            foundCount: 0,
            points: [],
          },
        }),
      ),
      ["barbecue"],
    )
  })
})
