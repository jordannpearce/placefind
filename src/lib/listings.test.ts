import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { listingLocation, mapsStatusDetail, mapsStatusLabel } from "./listings.ts"

describe("listing copy", () => {
  it("explains Maps verification without vendor or desktop talk", () => {
    assert.equal(mapsStatusLabel("found"), "Found on Google Maps")
    assert.equal(mapsStatusLabel("not_found"), "Not found on Google Maps")
    assert.equal(mapsStatusLabel("pending"), "Maps check pending")
    assert.match(mapsStatusDetail({ mapsStatus: "pending", mapsTitle: "", mapsAddress: "" }), /not been cross-checked/)
    assert.equal(listingLocation({ city: "Tampa", state: "FL" }), "Tampa, FL")
    const text = [mapsStatusLabel("found"), mapsStatusDetail({ mapsStatus: "found", mapsTitle: "Harbor & Oak", mapsAddress: "18 Exchange St" })].join(" ")
    assert.equal(/download|windows|desktop|license key|setup\.exe/i.test(text), false)
  })
})
