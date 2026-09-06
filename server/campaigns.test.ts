import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MAX_KEYWORDS,
  mergeKeywordRanks,
  normalizeKeywords,
  selectScanKeywords,
  validateCampaign,
  type Campaign,
  type KeywordRank,
} from "./campaigns.ts"

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
