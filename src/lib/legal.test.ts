import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isLegalPath, legalNavLinks, legalPageFor } from "./legal.ts"
import { isPublicVendorLeak } from "./public-copy.ts"

const ROUTES = ["/terms", "/privacy", "/policy", "/email-policy", "/data-policy", "/refund"] as const

describe("legal pages", () => {
  it("exposes every public legal route", () => {
    for (const route of ROUTES) {
      assert.equal(isLegalPath(route), true, route)
      assert.ok(legalPageFor(route), route)
    }
  })

  it("links every policy from the footer set", () => {
    const hrefs = legalNavLinks().map((link) => link.href)
    assert.deepEqual(hrefs, ["/terms", "/policy", "/email-policy", "/data-policy", "/refund"])
  })

  it("does not name vendors or covert tracking", () => {
    for (const route of ROUTES) {
      const page = legalPageFor(route)
      assert.ok(page)
      const text = [page.title, page.intro, ...page.sections.flatMap((section) => [section.heading, ...section.body])].join("\n")
      assert.equal(isPublicVendorLeak(text), false, route)
      assert.equal(/scrappey|dataforseo|resend|paddle|keygen|leaflet|railway/i.test(text), false, route)
      assert.equal(/we logged your ip|tracking your ip|fingerprint/i.test(text), false, route)
    }
  })
})
