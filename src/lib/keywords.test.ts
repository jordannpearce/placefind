import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPublicVendorLeak } from "./public-copy.ts"
import {
  MAX_KEYWORDS,
  acceptKeywordText,
  formatKeywordText,
  keywordCapMessage,
  keywordHelpCopy,
  listingKeywordHelpCopy,
  mergeKeywordLists,
  normalizeKeywords,
  parseKeywordText,
  parseKeywordsOrError,
  scanKeywordsLabel,
  trafficKeywordTypeHelpCopy,
} from "./keywords.ts"

describe("parseKeywordText", () => {
  it("splits commas, newlines, and semicolons, then trims blanks", () => {
    assert.deepEqual(parseKeywordText("barbecue, brisket; smoked meats\nbest bbq"), [
      "barbecue",
      "brisket",
      "smoked meats",
      "best bbq",
    ])
    assert.deepEqual(parseKeywordText("  , ; \n  "), [])
    assert.deepEqual(parseKeywordText(""), [])
  })

  it("deduplicates case-insensitively and keeps the first spelling", () => {
    assert.deepEqual(parseKeywordText("Barbecue, barbecue, BBQ; bbq\nbrisket"), ["Barbecue", "BBQ", "brisket"])
  })
})

describe("normalizeKeywords", () => {
  it("accepts arrays, delimited strings, and legacy single-keyword records", () => {
    assert.deepEqual(normalizeKeywords(["  barbecue ", "", "BBQ", "barbecue", "bbq"]), ["barbecue", "BBQ"])
    assert.deepEqual(normalizeKeywords("barbecue"), ["barbecue"])
    assert.deepEqual(normalizeKeywords("barbecue, brisket"), ["barbecue", "brisket"])
    assert.deepEqual(normalizeKeywords({ keyword: "barbecue" }), ["barbecue"])
    assert.deepEqual(normalizeKeywords({ keywords: "barbecue; brisket", keyword: "ignored" }), ["barbecue", "brisket"])
    assert.deepEqual(normalizeKeywords({ keywords: ["Barbecue", "barbecue"] }), ["Barbecue"])
    assert.deepEqual(normalizeKeywords(null), [])
  })

  it("splits delimited items that were stored inside an array", () => {
    assert.deepEqual(normalizeKeywords(["barbecue, brisket", "BBQ"]), ["barbecue", "brisket", "BBQ"])
  })
})

describe("parseKeywordsOrError", () => {
  it("caps the unique list with a vendor-free message", () => {
    const tooMany = Array.from({ length: MAX_KEYWORDS + 1 }, (_, index) => `keyword ${index + 1}`).join(", ")
    const parsed = parseKeywordsOrError(tooMany)
    assert.equal(parsed.error, keywordCapMessage())
    assert.equal(parsed.keywords.length, MAX_KEYWORDS + 1)
    assert.equal(parseKeywordsOrError("barbecue, brisket").error, undefined)
    assert.deepEqual(parseKeywordsOrError("barbecue, brisket").keywords, ["barbecue", "brisket"])
    assert.equal(MAX_KEYWORDS, 5)
    assert.equal(keywordCapMessage(), "Up to 5 keywords.")
    assert.equal(listingKeywordHelpCopy(), "Up to 5 keywords.")
    assert.match(keywordHelpCopy(), /Up to 5 keywords\./)
    assert.equal(isPublicVendorLeak(keywordCapMessage()), false)
    assert.equal(isPublicVendorLeak(keywordHelpCopy()), false)
    assert.equal(isPublicVendorLeak(trafficKeywordTypeHelpCopy()), false)
  })

  it("rejects a sixth keyword in the editor without keeping it", () => {
    const five = "barbecue, brisket, ribs, sausage, turkey"
    const sixth = acceptKeywordText(five, `${five}, burnt ends`)
    assert.equal(sixth.text, five)
    assert.equal(sixth.error, "Up to 5 keywords.")
    const kept = acceptKeywordText(five, "barbecue, brisket, ribs")
    assert.equal(kept.error, undefined)
    assert.equal(kept.text, "barbecue, brisket, ribs")
  })
})

describe("keyword labels", () => {
  it("formats saved keywords and scan labels", () => {
    assert.equal(formatKeywordText(["barbecue", "brisket"]), "barbecue, brisket")
    assert.equal(scanKeywordsLabel({ keywords: ["barbecue", "brisket"] }), "barbecue, brisket")
    assert.equal(scanKeywordsLabel({ keyword: "barbecue" }), "barbecue")
    assert.deepEqual(mergeKeywordLists(["barbecue"], "brisket, barbecue"), ["barbecue", "brisket"])
  })
})
