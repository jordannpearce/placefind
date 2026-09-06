import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPublicVendorLeak, usingCityGpsBackupNote } from "./public-copy.ts"

describe("usingCityGpsBackupNote", () => {
  it("stays vendor-free", () => {
    assert.equal(usingCityGpsBackupNote(), "Using city GPS backup")
    assert.equal(isPublicVendorLeak(usingCityGpsBackupNote()), false)
  })
})
