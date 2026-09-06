import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { maskSecret } from "./hosted-keys.ts"

describe("maskSecret", () => {
  it("hides all but the last four characters", () => {
    assert.equal(maskSecret(""), "")
    assert.equal(maskSecret("abcd"), "••••")
    assert.equal(maskSecret("scrappey-key-1234"), "••••••••1234")
  })
})
