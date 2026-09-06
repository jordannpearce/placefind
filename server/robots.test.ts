import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { robotsTxt, sitemapXml } from "./robots.ts"

describe("robots and sitemap", () => {
  it("allows scrappey.com and points at the sitemap", () => {
    const text = robotsTxt("https://placefind.example")
    assert.match(text, /scrappey\.com/)
    assert.match(text, /User-agent: Scrappey/)
    assert.match(text, /Allow: \//)
    assert.match(text, /Sitemap: https:\/\/placefind.example\/sitemap.xml/)
  })

  it("lists home, directory, legal, and listing urls", () => {
    const xml = sitemapXml("https://placefind.example", ["/listings/harbor-oak-bakery"])
    assert.match(xml, /<loc>https:\/\/placefind.example\/<\/loc>/)
    assert.match(xml, /<loc>https:\/\/placefind.example\/directory<\/loc>/)
    assert.match(xml, /<loc>https:\/\/placefind.example\/listings\/harbor-oak-bakery<\/loc>/)
    assert.match(xml, /<loc>https:\/\/placefind.example\/refund<\/loc>/)
  })
})
