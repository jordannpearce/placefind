import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { maskSecret, openSealed, sealKeys } from "./hosted-keys.ts"

describe("maskSecret", () => {
  it("hides all but the last four characters", () => {
    assert.equal(maskSecret(""), "")
    assert.equal(maskSecret("abcd"), "••••")
    assert.equal(maskSecret("scrappey-key-1234"), "••••••••1234")
  })
})

describe("sealKeys", () => {
  it("encrypts keys so the file is not readable as plaintext", () => {
    const keys = {
      scrappeyKey: "scp_secret_value",
      dataforseoLogin: "owner@example.com",
      dataforseoPassword: "api-password-99",
    }
    const sealed = sealKeys(keys)
    assert.equal(sealed.includes("scp_secret_value"), false)
    assert.equal(sealed.includes("api-password-99"), false)
    assert.deepEqual(openSealed(sealed), keys)
  })

  it("still reads an old plaintext key file", () => {
    const opened = openSealed(JSON.stringify({ scrappeyKey: "plain-key", dataforseoLogin: "a@b.c", dataforseoPassword: "x" }))
    assert.equal(opened?.scrappeyKey, "plain-key")
  })
})
