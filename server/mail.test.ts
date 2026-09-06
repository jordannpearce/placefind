import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { licenseEmail, welcomeEmail } from "./mail.ts"

describe("licenseEmail", () => {
  it("includes the license key and download steps", () => {
    const message = licenseEmail({
      name: "Jordan Pearce",
      product: "PlaceFind",
      key: "AAAA-BBBB-CCCC",
      downloadUrl: "http://127.0.0.1:43141/download",
    })
    assert.equal(message.subject.includes("license key"), true)
    assert.equal(message.text.includes("AAAA-BBBB-CCCC"), true)
    assert.equal(message.html.includes("AAAA-BBBB-CCCC"), true)
    assert.equal(message.text.includes("http://127.0.0.1:43141/download"), true)
  })
})

describe("welcomeEmail", () => {
  it("names the product and price", () => {
    const message = welcomeEmail({ name: "Jordan", product: "PlaceFind", price: "49" })
    assert.equal(message.subject, "Welcome to PlaceFind")
    assert.equal(message.text.includes("$49"), true)
  })
})
