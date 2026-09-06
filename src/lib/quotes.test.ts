import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { MISSING_QUOTE_EMAIL_MESSAGE, validateQuoteLead } from "./quotes.ts"

describe("quote leads", () => {
  it("requires a name, reply email, and a real request", () => {
    assert.equal(validateQuoteLead({ name: "A", email: "maya@example.com", need: "Need a catering quote" }).error, "Enter your name.")
    assert.equal(
      validateQuoteLead({ name: "Maya Chen", email: "not-an-email", need: "Need a catering quote" }).error,
      "Enter an email so the business can write you back.",
    )
    assert.equal(validateQuoteLead({ name: "Maya Chen", email: "maya@example.com", need: "Help" }).error, "Tell the business what you need.")
    assert.ok(
      validateQuoteLead({
        name: "Maya Chen",
        email: "Maya@Example.com",
        phone: "(207) 555-0100",
        need: "Two dozen sandwich loaves for a Friday office lunch.",
      }).value,
    )
  })

  it("keeps the missing-email copy owner-facing and vendor-free", () => {
    assert.match(MISSING_QUOTE_EMAIL_MESSAGE, /has not published a contact email/)
    assert.match(MISSING_QUOTE_EMAIL_MESSAGE, /owner can add one/)
    assert.equal(/resend|lorem|ipsum/i.test(MISSING_QUOTE_EMAIL_MESSAGE), false)
  })
})
