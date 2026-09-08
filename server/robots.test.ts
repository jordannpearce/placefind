import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DEFAULT_PUBLIC_SITE_URL } from "./runtime.ts"
import { robotsTxt, siteOrigin, sitemapXml } from "./robots.ts"

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
    assert.match(xml, /<loc>https:\/\/placefind.example\/pricing<\/loc>/)
    assert.match(xml, /<loc>https:\/\/placefind.example\/join<\/loc>/)
    assert.match(xml, /<loc>https:\/\/placefind.example\/create-profile<\/loc>/)
    assert.match(xml, /<loc>https:\/\/placefind.example\/listings\/harbor-oak-bakery<\/loc>/)
    assert.match(xml, /<loc>https:\/\/placefind.example\/refund<\/loc>/)
    const slashed = sitemapXml("https://placefind.to/", ["/listings/harbor-oak-bakery/"])
    assert.match(slashed, /<loc>https:\/\/placefind.to\/listings\/harbor-oak-bakery<\/loc>/)
    assert.equal(slashed.includes("/listings/harbor-oak-bakery/"), false)
  })

  it("uses the public site origin instead of the request host", () => {
    const previous = process.env.PLACEFIND_PUBLIC_URL
    try {
      delete process.env.PLACEFIND_PUBLIC_URL
      assert.equal(
        siteOrigin({ protocol: "http", get: () => "127.0.0.1:43141" }),
        DEFAULT_PUBLIC_SITE_URL,
      )
      process.env.PLACEFIND_PUBLIC_URL = "https://staging.example/"
      assert.equal(siteOrigin({ protocol: "https", get: () => "preview.example" }), "https://staging.example")
    } finally {
      if (previous == null) delete process.env.PLACEFIND_PUBLIC_URL
      else process.env.PLACEFIND_PUBLIC_URL = previous
    }
  })
})
