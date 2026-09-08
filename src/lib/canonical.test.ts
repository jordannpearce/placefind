import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { DEFAULT_PUBLIC_SITE_URL, publicSiteUrl } from "../../server/runtime.ts"
import {
  applyDocumentHtmlCanonical,
  canonicalPath,
  canonicalUrl,
  publicCanonicalOrigin,
} from "./canonical.ts"

describe("canonical URLs", () => {
  const previous = process.env.PLACEFIND_PUBLIC_URL

  afterEach(() => {
    if (previous == null) delete process.env.PLACEFIND_PUBLIC_URL
    else process.env.PLACEFIND_PUBLIC_URL = previous
  })

  it("builds home, pricing, and listing urls on the public origin", () => {
    delete process.env.PLACEFIND_PUBLIC_URL
    assert.equal(publicSiteUrl(), DEFAULT_PUBLIC_SITE_URL)
    assert.equal(publicCanonicalOrigin(), DEFAULT_PUBLIC_SITE_URL)
    assert.equal(canonicalPath("/"), "/")
    assert.equal(canonicalUrl("/"), `${DEFAULT_PUBLIC_SITE_URL}/`)
    assert.equal(canonicalUrl("/pricing"), `${DEFAULT_PUBLIC_SITE_URL}/pricing`)
    assert.equal(canonicalUrl("/listings/slug"), `${DEFAULT_PUBLIC_SITE_URL}/listings/slug`)
  })

  it("strips search params and trailing slashes", () => {
    assert.equal(canonicalPath("/pricing?utm_source=ad&utm_medium=email"), "/pricing")
    assert.equal(canonicalUrl("/pricing?utm_source=ad"), `${DEFAULT_PUBLIC_SITE_URL}/pricing`)
    assert.equal(canonicalUrl("/listings/slug/?ref=home"), `${DEFAULT_PUBLIC_SITE_URL}/listings/slug`)
    assert.equal(canonicalUrl("/pricing/#plans"), `${DEFAULT_PUBLIC_SITE_URL}/pricing`)
    assert.equal(canonicalUrl("http://127.0.0.1:43141/pricing?utm_source=ad"), `${DEFAULT_PUBLIC_SITE_URL}/pricing`)
    assert.equal(canonicalUrl("https://preview.example/listings/slug?x=1"), `${DEFAULT_PUBLIC_SITE_URL}/listings/slug`)
  })

  it("uses an explicit public origin when set", () => {
    process.env.PLACEFIND_PUBLIC_URL = "https://staging.example/"
    assert.equal(publicSiteUrl(), "https://staging.example")
    assert.equal(canonicalUrl("/pricing", publicSiteUrl()), "https://staging.example/pricing")
    assert.equal(canonicalUrl("/listings/slug/", "https://preview.example/"), "https://preview.example/listings/slug")
    assert.equal(applyDocumentHtmlCanonical("<html><head></head></html>", "/pricing"),
      `<html><head>    <link id="placefind-canonical" rel="canonical" href="${DEFAULT_PUBLIC_SITE_URL}/pricing">\n  </head></html>`)
  })
})
