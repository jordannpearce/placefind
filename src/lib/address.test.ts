import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { formatStreetAddress, hasStreetAddress, parseStreetAddress } from "./address.ts"

describe("street address parsing", () => {
  it("splits a Maps line into street, city, state, and zip", () => {
    assert.deepEqual(parseStreetAddress("900 E 11th St, Austin, TX 78702"), {
      street: "900 E 11th St",
      city: "Austin",
      state: "TX",
      zip: "78702",
    })
    assert.deepEqual(parseStreetAddress("18 Exchange St, Portland, ME 04101"), {
      street: "18 Exchange St",
      city: "Portland",
      state: "ME",
      zip: "04101",
    })
  })

  it("accepts a full state name and a missing zip", () => {
    assert.deepEqual(parseStreetAddress("7 Carmine St, New York, New York"), {
      street: "7 Carmine St",
      city: "New York",
      state: "NY",
      zip: "",
    })
    assert.deepEqual(parseStreetAddress("Austin, TX 78702"), {
      street: "",
      city: "Austin",
      state: "TX",
      zip: "78702",
    })
  })

  it("uses the listing city when Maps only returns a street", () => {
    assert.deepEqual(parseStreetAddress("900 E 11th St", { city: "Austin", state: "Texas" }), {
      street: "900 E 11th St",
      city: "Austin",
      state: "TX",
      zip: "",
    })
  })

  it("formats a standard US line and detects a street", () => {
    assert.equal(
      formatStreetAddress({ street: "900 E 11th St", city: "Austin", state: "TX", zip: "78702" }),
      "900 E 11th St, Austin, TX 78702",
    )
    assert.equal(formatStreetAddress({ city: "Tampa", state: "FL" }), "Tampa, FL")
    assert.equal(hasStreetAddress({ street: "18 Exchange St" }), true)
    assert.equal(hasStreetAddress({ address: "18 Exchange St, Portland, ME" }), true)
    assert.equal(hasStreetAddress({ city: "Portland" }), false)
  })
})
