import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPublicVendorLeak, sampleSearchUsedMessage, usingCityGpsBackupNote } from "./public-copy.ts"

describe("usingCityGpsBackupNote", () => {
  it("stays vendor-free", () => {
    assert.equal(usingCityGpsBackupNote(), "Using city GPS backup")
    assert.equal(isPublicVendorLeak(usingCityGpsBackupNote()), false)
  })
})

describe("sampleSearchUsedMessage", () => {
  it("never mentions tracking or vendors", () => {
    const text = sampleSearchUsedMessage()
    assert.equal(text, "This sample search is already in use. Download PlaceFind to run unlimited lookups.")
    assert.equal(isPublicVendorLeak(text), false)
    assert.equal(/\bip\b|rate limit|tracking|we log|fingerprint/i.test(text), false)
  })
})
