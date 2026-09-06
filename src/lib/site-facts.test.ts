import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  extractPageSnippet,
  extractPageTitle,
  extractSameOriginLinks,
  extractSiteFacts,
  mergeSiteFacts,
  parseSitemapDocument,
  parseSitemapLocs,
  writeProfileArticle,
} from "./site-facts.ts"

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

  it("splits nested sitemaps from page locs and reads same-origin links", () => {
    const index = parseSitemapDocument(
      `<sitemapindex><sitemap><loc>https://shop.example/sitemap-pages.xml</loc></sitemap></sitemapindex>`,
    )
    assert.deepEqual(index.nested, ["https://shop.example/sitemap-pages.xml"])
    assert.deepEqual(index.pages, [])
    const pages = parseSitemapDocument(
      `<urlset><url><loc>https://shop.example/about</loc></url><url><loc>https://shop.example/sitemap-blog.xml</loc></url></urlset>`,
    )
    assert.deepEqual(pages.pages, ["https://shop.example/about"])
    assert.deepEqual(pages.nested, ["https://shop.example/sitemap-blog.xml"])
    assert.equal(extractPageTitle("# About Harbor & Oak"), "About Harbor & Oak")
    assert.match(extractPageSnippet("We bake bread every morning on Exchange Street."), /bake bread/)
    assert.deepEqual(
      extractSameOriginLinks(
        `<a href="/contact">Contact</a> [Menu](https://shop.example/menu) https://other.example/nope`,
        "https://shop.example/about",
      ),
      ["https://shop.example/contact", "https://shop.example/menu"],
    )
  })
})
