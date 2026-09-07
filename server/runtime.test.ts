import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import {
  DEFAULT_PUBLIC_SITE_URL,
  isDesktopProcess,
  isDesktopRequest,
  isElectronUserAgent,
  isPackagedBuyer,
  isStoreEnabled,
  passwordResetUrl,
  publicSiteUrl,
} from "./runtime.ts"

describe("desktop runtime", () => {
  const previousStatic = process.env.PLACEFIND_STATIC
  const previousDesktop = process.env.PLACEFIND_DESKTOP

  afterEach(() => {
    if (previousStatic == null) delete process.env.PLACEFIND_STATIC
    else process.env.PLACEFIND_STATIC = previousStatic
    if (previousDesktop == null) delete process.env.PLACEFIND_DESKTOP
    else process.env.PLACEFIND_DESKTOP = previousDesktop
  })

  it("treats a packaged buyer copy as desktop", () => {
    process.env.PLACEFIND_STATIC = "1"
    delete process.env.PLACEFIND_DESKTOP
    assert.equal(isPackagedBuyer(), true)
    assert.equal(isDesktopProcess(), true)
    assert.equal(isDesktopRequest(), true)
    assert.equal(isStoreEnabled(), false)
  })

  it("treats PLACEFIND_DESKTOP=1 as desktop even without packaging", () => {
    delete process.env.PLACEFIND_STATIC
    process.env.PLACEFIND_DESKTOP = "1"
    assert.equal(isPackagedBuyer(), false)
    assert.equal(isDesktopProcess(), true)
    assert.equal(isDesktopRequest({ headers: { "user-agent": "Mozilla/5.0 Chrome/120" } }), true)
  })

  it("detects the Electron desktop shell from the user agent", () => {
    delete process.env.PLACEFIND_STATIC
    delete process.env.PLACEFIND_DESKTOP
    assert.equal(isDesktopProcess(), false)
    assert.equal(isElectronUserAgent("Mozilla/5.0 (Windows NT 10.0) Electron/38.1.2 Chrome/140"), true)
    assert.equal(
      isDesktopRequest({ headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0) Electron/38.1.2" } }),
      true,
    )
    assert.equal(isDesktopRequest({ headers: { "user-agent": "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36" } }), false)
    assert.equal(isStoreEnabled(), true)
  })
})

describe("public site URL", () => {
  const previous = process.env.PLACEFIND_PUBLIC_URL

  afterEach(() => {
    if (previous == null) delete process.env.PLACEFIND_PUBLIC_URL
    else process.env.PLACEFIND_PUBLIC_URL = previous
  })

  it("defaults to placefind.to and builds a reset link", () => {
    delete process.env.PLACEFIND_PUBLIC_URL
    assert.equal(publicSiteUrl(), DEFAULT_PUBLIC_SITE_URL)
    assert.equal(
      passwordResetUrl("abc/def"),
      `${DEFAULT_PUBLIC_SITE_URL}/reset?token=${encodeURIComponent("abc/def")}`,
    )
  })

  it("uses PLACEFIND_PUBLIC_URL when set", () => {
    process.env.PLACEFIND_PUBLIC_URL = "https://example.test/"
    assert.equal(publicSiteUrl(), "https://example.test")
    assert.equal(passwordResetUrl("tok"), "https://example.test/reset?token=tok")
  })
})
