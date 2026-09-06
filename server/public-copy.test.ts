import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { leaksVendorTalk, publicCheckoutWarning, publicSearchMessage } from "./public-copy.ts"

describe("publicSearchMessage", () => {
  it("leaves ordinary lookup copy alone", () => {
    assert.equal(publicSearchMessage("No Google Maps listings matched that name in this city."), "No Google Maps listings matched that name in this city.")
  })

  it("does not name vendors or API keys", () => {
    const samples = [
      "Sample listing. Add your DataForSEO and Scrappey keys in Settings to search live Google Maps.",
      "Could not reach DataForSEO.",
      "Scrappey timed out.",
      "No API keys yet, and no sample listing matches that search.",
    ]
    for (const sample of samples) {
      const next = publicSearchMessage(sample) || ""
      assert.equal(leaksVendorTalk(next), false, next)
      assert.match(next, /Maps|sample listing|PlaceFind/i)
    }
  })
})

describe("publicCheckoutWarning", () => {
  it("never forwards Keygen errors to the customer", () => {
    const warning = publicCheckoutWarning("Keygen is not connected.")
    assert.ok(warning)
    assert.equal(leaksVendorTalk(warning), false)
    assert.match(warning, /license key/i)
  })
})
