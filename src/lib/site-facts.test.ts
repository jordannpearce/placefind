import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { extractSiteFacts, mergeSiteFacts, parseSitemapLocs, writeProfileArticle } from "./site-facts.ts"

const PAGE = `
# Harbor & Oak Bakery
title: Harbor & Oak
Established in 2014. License #BAK-4418.
We specialize in naturally leavened bread and morning pastry.
`

describe("site facts", () => {
  it("reads brand, license, years, and specialty", () => {
    const facts = extractSiteFacts(PAGE, "Fallback")
    assert.equal(facts.brand, "Harbor & Oak")
    assert.equal(facts.licenseInfo, "License BAK-4418")
    assert.equal(facts.yearsInBusiness, "Since 2014")
    assert.match(facts.specialty, /naturally leavened bread/)
  })

  it("merges facts across pages and writes a profile", () => {
    const facts = mergeSiteFacts(["# Other", "12 years in business. We offer family dentistry."], "Red Mesa Dental")
    assert.equal(facts.yearsInBusiness, "12 years in business")
    const article = writeProfileArticle(facts, { name: "Red Mesa Dental", city: "Santa Fe", state: "NM", category: "Dentist" })
    assert.match(article, /Red Mesa Dental|family dentistry/)
    assert.match(article, /Santa Fe/)
    assert.match(article, /Reviews from visitors/)
  })

  it("parses sitemap loc tags", () => {
    const locs = parseSitemapLocs(
      `<urlset><url><loc>https://shop.example/about</loc></url><url><loc>https://shop.example/about</loc></url></urlset>`,
    )
    assert.deepEqual(locs, ["https://shop.example/about"])
  })
})
