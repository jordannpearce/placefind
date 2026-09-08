import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  factsChanged,
  hasOwnerFacts,
  keepOwnerFact,
  listingFactRows,
  listingFactsFromInput,
  MAX_SITE_URLS,
  normalizeSiteUrls,
} from "./business-facts.ts"

describe("listing business facts", () => {
  it("trims owner facts and hides empty rows", () => {
    const facts = listingFactsFromInput({
      yearsInBusiness: "  2014  ",
      licenseInfo: "City license 4418",
      insuranceInfo: "",
      priceOptions: "  Wheel classes from $65 ",
      serviceArea: "South Austin",
      paymentMethods: "Cash and cards",
    })
    assert.equal(facts.yearsInBusiness, "2014")
    assert.equal(facts.priceOptions, "Wheel classes from $65")
    assert.equal(hasOwnerFacts(facts), true)
    assert.deepEqual(
      listingFactRows(facts).map((row) => row.label),
      ["Year started", "License", "Price options", "Service area", "Payment methods"],
    )
    assert.equal(hasOwnerFacts(listingFactsFromInput({})), false)
    assert.equal(factsChanged({ yearsInBusiness: "2014" }, facts), true)
    assert.equal(factsChanged(facts, facts), false)
  })

  it("keeps owner-filled facts when the profile is customized or the field is set", () => {
    assert.equal(keepOwnerFact("2014", "Since 1999", false), "2014")
    assert.equal(keepOwnerFact("", "Since 1999", true), "")
    assert.equal(keepOwnerFact("", "Since 1999", false), "Since 1999")
    assert.equal(keepOwnerFact("", undefined, false), "")
  })

  it("caps unique same-host page URLs and skips assets", () => {
    assert.equal(MAX_SITE_URLS, 80)
    const urls = normalizeSiteUrls(
      [
        "https://shop.example/about",
        "https://shop.example/about#team",
        "https://shop.example/about/",
        "https://shop.example/logo.png",
        "https://other.example/nope",
        "ftp://shop.example/files",
        "https://shop.example/menu",
      ],
      "https://shop.example/",
    )
    assert.deepEqual(urls, ["https://shop.example/about", "https://shop.example/menu"])
    const many = normalizeSiteUrls(
      Array.from({ length: 120 }, (_, index) => `https://shop.example/p/${index}`),
      "https://shop.example/",
    )
    assert.equal(many.length, MAX_SITE_URLS)
  })
})
