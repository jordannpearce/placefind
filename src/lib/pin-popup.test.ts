import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { gridPinLabel, gridPinNumber } from "./grid.ts"
import {
  COMPETITORS_HEADING,
  NO_COMPETITORS_COPY,
  buildPinPopupHtml,
  competitorGeoNote,
  escapePopupHtml,
  pinPopupMaxWidth,
  popupRankText,
} from "./pin-popup.ts"
import { isPublicVendorLeak } from "./public-copy.ts"
import type { CompetitorListing, GridPointResult } from "./types.ts"

function competitor(partial: Partial<CompetitorListing>): CompetitorListing {
  return {
    title: "Austin Barbecue",
    rank: 1,
    rating: 4.4,
    address: "100 Main",
    placeId: "a",
    geoCities: ["Austin"],
    usesStateName: false,
    usesStateAbbr: false,
    ...partial,
  }
}

function point(partial: Partial<GridPointResult> = {}): GridPointResult {
  return {
    row: 0,
    col: 0,
    lat: 30.27,
    lng: -97.74,
    keyword: "barbecue",
    rank: 3,
    listingTitle: "Franklin Barbecue",
    rating: 4.7,
    address: "900 E 11th St, Austin, TX",
    mapsUrl: null,
    scannedAt: "2026-09-06T00:00:00.000Z",
    status: "rank",
    competitors: [
      competitor({ title: "Austin Barbecue", rank: 1, rating: 4.4, geoCities: ["Austin"] }),
      competitor({
        title: "Joe's TX Grill",
        rank: 2,
        rating: 4.1,
        placeId: "c",
        geoCities: [],
        usesStateAbbr: true,
      }),
    ],
    ...partial,
  }
}

describe("grid pin labels", () => {
  it("numbers a 3×3 grid #1–#9 in row-major order", () => {
    assert.equal(gridPinNumber({ row: 0, col: 0 }, 3), 1)
    assert.equal(gridPinNumber({ row: 0, col: 2 }, 3), 3)
    assert.equal(gridPinNumber({ row: 2, col: 2 }, 3), 9)
    assert.equal(gridPinLabel({ row: 1, col: 1 }, 3), "#5")
    assert.equal(gridPinLabel({ row: 0, col: 0 }, 5), "#1")
    assert.equal(gridPinLabel({ row: 4, col: 4 }, 5), "#25")
  })
})

describe("popup rank text", () => {
  it("uses Rank N, Not found, and Error", () => {
    assert.equal(popupRankText(3, undefined, "2026-01-01", "rank"), "Rank 3")
    assert.equal(popupRankText(1, undefined, "2026-01-01", "rank"), "Rank 1")
    assert.equal(popupRankText(null, undefined, "2026-01-01", "not_found"), "Not found")
    assert.equal(popupRankText(null, "No Search Results."), "Not found")
    assert.equal(popupRankText(null, "Maps search could not finish this point.", "2026-01-01", "error"), "Error")
    assert.equal(popupRankText(null, undefined, "", "pending"), "Scanning…")
    assert.equal(popupRankText(null, undefined, "", "unset"), "Not scanned")
  })
})

describe("competitor geo note", () => {
  it("keeps one quiet flag for city or state in the title", () => {
    assert.equal(competitorGeoNote(competitor({ geoCities: ["Austin", "Ava"] })), "Austin")
    assert.equal(competitorGeoNote(competitor({ geoCities: [], usesStateAbbr: true })), "State")
    assert.equal(competitorGeoNote(competitor({ geoCities: [], usesStateName: false, usesStateAbbr: false })), null)
  })
})

describe("buildPinPopupHtml", () => {
  it("shows pin label, target rank, and competitors at that pin", () => {
    const html = buildPinPopupHtml({
      point: point(),
      gridSize: 3,
      targetName: "Franklin Barbecue",
    })
    assert.match(html, /data-testid="pin-popup"/)
    assert.match(html, />#1</)
    assert.match(html, /Franklin Barbecue/)
    assert.match(html, /Rank 3/)
    assert.match(html, /4\.7/)
    assert.match(html, /900 E 11th St/)
    assert.match(html, new RegExp(COMPETITORS_HEADING))
    assert.match(html, /Austin Barbecue/)
    assert.match(html, />#1</)
    assert.match(html, /Joe&#39;s TX Grill/)
    assert.match(html, /4\.4/)
    assert.match(html, /Austin/)
    assert.match(html, /State/)
    assert.equal(html.includes(NO_COMPETITORS_COPY), false)
    assert.equal(isPublicVendorLeak(html), false)
  })

  it("uses the empty competitor copy after a scan with no other listings", () => {
    const html = buildPinPopupHtml({
      point: point({ competitors: [], rank: null, listingTitle: null, rating: null, status: "not_found" }),
      gridSize: 3,
      targetName: "Franklin Barbecue",
    })
    assert.match(html, /Franklin Barbecue/)
    assert.match(html, /Not found/)
    assert.match(html, new RegExp(NO_COMPETITORS_COPY))
    assert.equal(isPublicVendorLeak(NO_COMPETITORS_COPY), false)
    assert.equal(isPublicVendorLeak(html), false)
  })

  it("hides competitors until the pin has been scanned", () => {
    const html = buildPinPopupHtml({
      point: point({
        rank: null,
        listingTitle: null,
        rating: null,
        address: null,
        scannedAt: "",
        status: "unset",
        competitors: undefined,
      }),
      gridSize: 5,
      targetName: "Franklin Barbecue",
    })
    assert.match(html, />#1</)
    assert.match(html, /Not scanned/)
    assert.equal(html.includes(COMPETITORS_HEADING), false)
    assert.equal(html.includes(NO_COMPETITORS_COPY), false)
  })

  it("escapes listing names so popup HTML cannot inject markup", () => {
    assert.equal(escapePopupHtml(`A&B <Grill> "TX"`), "A&amp;B &lt;Grill&gt; &quot;TX&quot;")
    const html = buildPinPopupHtml({
      point: point({
        listingTitle: `<img src=x onerror=alert(1)>`,
        competitors: [competitor({ title: `<script>alert(1)</script>` })],
      }),
      gridSize: 3,
      targetName: `Joe's & "Pits"`,
    })
    assert.equal(html.includes("<script>"), false)
    assert.equal(html.includes("<img"), false)
    assert.match(html, /Joe&#39;s &amp; &quot;Pits&quot;/)
  })
})

describe("pinPopupMaxWidth", () => {
  it("keeps the popup inside a narrow phone viewport", () => {
    assert.equal(pinPopupMaxWidth(360), 280)
    assert.equal(pinPopupMaxWidth(320), 280)
    assert.equal(pinPopupMaxWidth(220), 200)
    assert.ok(pinPopupMaxWidth(360) <= 280)
  })
})
