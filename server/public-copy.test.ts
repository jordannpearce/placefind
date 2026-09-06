import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  leaksVendorTalk,
  publicCheckoutWarning,
  publicPinScanMessage,
  publicSearchMessage,
  publicTrafficMessage,
  usingCityGpsBackupNote,
} from "./public-copy.ts"

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

describe("publicPinScanMessage", () => {
  it("uses human pin copy and hides vendor names", () => {
    assert.equal(publicPinScanMessage("DataForSEO timed out."), "Maps search timed out.")
    assert.equal(publicPinScanMessage("Could not reach DataForSEO."), "Could not reach Maps.")
    assert.equal(publicPinScanMessage("No Search Results."), "No results at this point.")
    assert.equal(leaksVendorTalk(publicPinScanMessage("DataForSEO returned HTTP 402.")), false)
  })
})

describe("publicTrafficMessage", () => {
  it("does not name the traffic vendor", () => {
    assert.equal(publicTrafficMessage("Traffic runner is not configured."), "Traffic runner is not configured.")
    const next = publicTrafficMessage("Scrappey timed out.")
    assert.equal(leaksVendorTalk(next), false)
    assert.match(next, /Traffic runner/)
  })

  it("hides stack traces and query keys from live-log copy", () => {
    const stacked = publicTrafficMessage("Request failed\n    at runMapsTrafficSession (server/scrappey-runner.ts:12:3)")
    assert.equal(stacked.includes("at runMapsTrafficSession"), false)
    assert.equal(stacked.includes("scrappey-runner"), false)
    const keyed = publicTrafficMessage("POST https://example.test/api?key=scp_secret_value failed")
    assert.equal(keyed.includes("scp_secret_value"), false)
    assert.equal(keyed.includes("key="), false)
  })
})

describe("usingCityGpsBackupNote", () => {
  it("does not name vendors", () => {
    assert.equal(usingCityGpsBackupNote(), "Using city GPS backup")
    assert.equal(leaksVendorTalk(usingCityGpsBackupNote()), false)
  })
})

describe("publicCheckoutWarning", () => {
  it("never forwards Keygen errors to the customer", () => {
    const warning = publicCheckoutWarning("Keygen is not connected.")
    assert.ok(warning)
    assert.equal(leaksVendorTalk(warning), false)
    assert.match(warning, /listing|account/i)
    assert.equal(/license key|download|windows/i.test(warning), false)
  })
})
