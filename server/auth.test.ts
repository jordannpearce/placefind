import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hashPassword, parseCookies, verifyPassword } from "./auth.ts"

describe("password hashing", () => {
  it("verifies a matching password and rejects a wrong one", () => {
    const stored = hashPassword("correct-horse")
    assert.equal(verifyPassword("correct-horse", stored), true)
    assert.equal(verifyPassword("wrong-horse", stored), false)
    assert.equal(stored.includes("correct-horse"), false)
  })
})

describe("parseCookies", () => {
  it("reads the PlaceFind session cookie", () => {
    const cookies = parseCookies("pf_session=abc123; other=1")
    assert.equal(cookies.pf_session, "abc123")
  })
})
