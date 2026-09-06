import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  campaignInputFromListing,
  campaignScanFinished,
  countFinishedScanPins,
  confirmedListingFromCampaign,
  confirmedListingFromDirectory,
  confirmedFromOwnedListingNotice,
  competitorHasGeo,
  competitorsGeoFilterLabel,
  confirmedListingFromSearch,
  filterCompetitors,
  listingHasTrackCoords,
  listingNeedsMapsLookup,
  listingsFromSearch,
  ownedListingLookupFailedMessage,
  ownedListingNeedsConfirmMessage,
  ownedListingTrackHint,
  pickMapsPlaceForListing,
  searchQueryFromListing,
  shouldPersistOwnedListingMatch,
  scanBusinessEnabled,
  searchChanged,
  listedTrafficKeywords,
  noKeywordsSelectedMessage,
  noPinsSelectedMessage,
  scanGridPageError,
  scanLiveStatus,
  selectedKeywordsInListedOrder,
  startTrafficEnabled,
  startTrafficLabel,
  startTrafficVisible,
  stopTrafficVisible,
  trafficKeywordHelpCopy,
  trafficLogEmptyCopy,
} from "./track.ts"
import { isPublicVendorLeak } from "./public-copy.ts"
import type { BusinessListing, Campaign, DirectoryListing, SearchResponse, TrafficJob } from "./types.ts"

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

function directoryListing(partial: Partial<DirectoryListing> = {}): DirectoryListing {
  return {
    id: "l1",
    name: "Franklin Barbecue",
    street: "900 E 11th St",
    city: "Austin",
    state: "TX",
    zip: "78702",
    category: "Barbecue restaurant",
    keywords: ["barbecue", "brisket"],
    phone: "",
    website: "",
    hours: "",
    placeId: "sample-franklin",
    cid: null,
    mapsStatus: "found",
    mapsTitle: "Franklin Barbecue",
    mapsAddress: "900 E 11th St, Austin, TX 78702",
    mapsUrl: null,
    createdAt: "2026-09-06T00:00:00.000Z",
    updatedAt: "2026-09-06T00:00:00.000Z",
    ...partial,
  }
}

describe("owned PlaceFind listings", () => {
  it("fills the rank query from a directory listing", () => {
    const query = searchQueryFromListing(directoryListing())
    assert.equal(query.name, "Franklin Barbecue")
    assert.equal(query.city, "Austin")
    assert.equal(query.state, "TX")
    assert.equal(query.keyword, "barbecue")
  })

  it("confirms a listing that already has a Maps place and coordinates", () => {
    const ready = directoryListing({ lat: 30.2701, lng: -97.7313 })
    assert.equal(listingHasTrackCoords(ready), true)
    assert.equal(listingNeedsMapsLookup(ready), false)
    const selected = confirmedListingFromDirectory(ready)
    assert.ok(selected)
    assert.equal(scanBusinessEnabled(selected), true)
    assert.equal(selected?.placeId, "sample-franklin")
    assert.equal(selected?.lat, 30.2701)
    assert.equal(selected?.lng, -97.7313)
    assert.equal(ownedListingTrackHint(ready), "Ready to track")
    assert.match(confirmedFromOwnedListingNotice("Franklin Barbecue"), /your PlaceFind listing/)
  })

  it("needs a silent Maps lookup when placeId is stored without coordinates", () => {
    const listing = directoryListing({ lat: null, lng: null })
    assert.equal(confirmedListingFromDirectory(listing), null)
    assert.equal(listingNeedsMapsLookup(listing), true)
    assert.equal(ownedListingTrackHint(listing), "Has a Maps match — we'll look up the pin")
    const result: SearchResponse = {
      query: { name: "Franklin Barbecue", city: "Austin", state: "TX" },
      best: franklin,
      others: [{ ...franklin, title: "Franklin BBQ Truck", placeId: "sample-truck", isBestMatch: false }],
      mode: "sample",
      sources: { dataforseo: false, scrappey: false },
      elapsedMs: 12,
    }
    assert.equal(pickMapsPlaceForListing(result, listing)?.placeId, "sample-franklin")
    assert.equal(pickMapsPlaceForListing(result, directoryListing({ placeId: "missing" })), null)
    assert.match(ownedListingLookupFailedMessage(), /Search the name/)
  })

  it("prefills a listing with no Maps match and still lets the owner search once", () => {
    const listing = directoryListing({ placeId: "", mapsStatus: "pending", mapsTitle: "", mapsAddress: "" })
    assert.equal(confirmedListingFromDirectory(listing), null)
    assert.equal(listingNeedsMapsLookup(listing), true)
    assert.equal(ownedListingTrackHint(listing), "Fill the form — confirm the Maps listing once")
    assert.equal(
      pickMapsPlaceForListing(
        {
          query: { name: listing.name, city: listing.city, state: listing.state },
          best: franklin,
          others: [],
          mode: "sample",
          sources: { dataforseo: false, scrappey: false },
          elapsedMs: 1,
        },
        listing,
      ),
      null,
    )
    assert.match(ownedListingNeedsConfirmMessage(), /matching Maps listing/)
    assert.equal(shouldPersistOwnedListingMatch(listing, franklin), true)
    assert.equal(shouldPersistOwnedListingMatch(directoryListing(), { ...franklin, placeId: "other" }), false)
    assert.equal(shouldPersistOwnedListingMatch(directoryListing(), franklin), true)
    assert.equal(shouldPersistOwnedListingMatch(directoryListing(), { ...franklin, lat: null }), false)
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
    assert.equal(noKeywordsSelectedMessage(), "Add at least one keyword")
    assert.match(trafficLogEmptyCopy(), /Select pins/)
    assert.match(trafficKeywordHelpCopy(), /selected pin GPS/)
    assert.match(trafficKeywordHelpCopy(), /listed order/)
  })

  it("keeps selected keywords in campaign listed order", () => {
    const listed = listedTrafficKeywords(
      campaign({ keywords: ["barbecue", "brisket", "smoked meats"] }),
    )
    assert.deepEqual(listed, ["barbecue", "brisket", "smoked meats"])
    assert.deepEqual(selectedKeywordsInListedOrder(listed, ["smoked meats", "barbecue", "unknown"]), [
      "barbecue",
      "smoked meats",
    ])
    assert.deepEqual(selectedKeywordsInListedOrder(listed, []), [])
    assert.deepEqual(
      listedTrafficKeywords(
        campaign({
          keywords: [],
          lastGridScan: {
            id: "g1",
            scannedAt: "2026-09-06T00:00:00.000Z",
            keyword: "barbecue",
            keywords: ["barbecue", "brisket"],
            gridSize: 3,
            spacingMiles: 1,
            center: { lat: 30.27, lng: -97.74 },
            pointCount: 18,
            foundCount: 0,
            points: [],
          },
        }),
      ),
      ["barbecue", "brisket"],
    )
  })
})

describe("live scan status", () => {
  it("counts finished pins and names the current pin", () => {
    assert.equal(scanLiveStatus(0, 9), "Scanning pin 1 of 9…")
    assert.equal(scanLiveStatus(3, 9), "Scanning pin 4 of 9…")
    assert.equal(scanLiveStatus(9, 9), "Scanned 9 of 9 pins")
    assert.equal(
      countFinishedScanPins([
        { status: "rank" },
        { status: "not_found" },
        { status: "error" },
        { status: "pending" },
        { status: "unset" },
      ]),
      3,
    )
  })

  it("only treats a finished grid as an error when every pin failed", () => {
    assert.equal(scanGridPageError([{ status: "rank" }, { status: "error", error: "Maps search timed out." }]), null)
    assert.equal(
      scanGridPageError([
        { status: "error", error: "Could not reach Maps." },
        { status: "error", error: "Could not reach Maps." },
      ]),
      "Could not reach Maps.",
    )
    assert.equal(
      campaignScanFinished(
        campaign({
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
            status: "running",
          },
        }),
      ),
      false,
    )
  })
})

describe("competitor geo filter", () => {
  it("keeps listings that use a nearby city or state name", () => {
    const rows = [
      {
        title: "Austin Barbecue",
        rank: 1,
        rating: 4.4,
        address: "100 Main",
        placeId: "a",
        geoCities: ["Austin"],
        usesStateName: false,
        usesStateAbbr: false,
      },
      {
        title: "Plain Smokehouse",
        rank: 2,
        rating: 4.0,
        address: "200 Main",
        placeId: "b",
        geoCities: [],
        usesStateName: false,
        usesStateAbbr: false,
      },
      {
        title: "Joe's TX Grill",
        rank: 3,
        rating: 4.1,
        address: "300 Main",
        placeId: "c",
        geoCities: [],
        usesStateName: false,
        usesStateAbbr: true,
      },
    ]
    assert.equal(competitorHasGeo(rows[0]!), true)
    assert.equal(competitorHasGeo(rows[1]!), false)
    assert.equal(filterCompetitors(rows, true).map((row) => row.title).join(","), "Austin Barbecue,Joe's TX Grill")
    assert.equal(competitorsGeoFilterLabel(), "Has geo in name")
    assert.equal(isPublicVendorLeak(competitorsGeoFilterLabel()), false)
  })
})

describe("searchChanged", () => {
  it("clears confirmation when the search fields change", () => {
    const query = { name: "Franklin Barbecue", city: "Austin", state: "TX" }
    assert.equal(searchChanged(query, query), false)
    assert.equal(searchChanged(query, { ...query, name: "Joe's Pizza" }), true)
  })
})
