import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  cityTokenAllowed,
  flagGeoInName,
  hasGeoInName,
  titleHasCityName,
  titleHasStateAbbr,
  titleHasStateName,
} from "./geo-names.ts"

const austin = { cities: ["Austin", "Ava", "La", "Round Rock"], campaignCity: "Austin", state: "TX" }

describe("flagGeoInName", () => {
  it("flags Austin in Austin Barbecue", () => {
    const flags = flagGeoInName("Austin Barbecue", austin)
    assert.deepEqual(flags.geoCities, ["Austin"])
    assert.equal(flags.usesStateName, false)
    assert.equal(flags.usesStateAbbr, false)
    assert.equal(hasGeoInName(flags), true)
  })

  it("flags a standalone state abbreviation in Joe's TX Grill", () => {
    const flags = flagGeoInName("Joe's TX Grill", austin)
    assert.deepEqual(flags.geoCities, [])
    assert.equal(flags.usesStateAbbr, true)
    assert.equal(flags.usesStateName, false)
    assert.equal(titleHasStateAbbr("Joe's TX Grill", "TX"), true)
  })

  it("flags a 3-letter city name", () => {
    assert.equal(cityTokenAllowed("Ava", "Austin"), true)
    assert.equal(titleHasCityName("Ava BBQ", "Ava", "Austin"), true)
    const flags = flagGeoInName("Ava Smokehouse", austin)
    assert.deepEqual(flags.geoCities, ["Ava"])
  })

  it("skips tiny tokens like La unless it is the campaign city", () => {
    assert.equal(cityTokenAllowed("La", "Austin"), false)
    assert.equal(titleHasCityName("La Barbecue", "La", "Austin"), false)
    assert.equal(titleHasCityName("La Barbecue", "La", "La"), true)
    const flags = flagGeoInName("La Barbecue", austin)
    assert.deepEqual(flags.geoCities, [])
  })

  it("flags the state full name", () => {
    assert.equal(titleHasStateName("Texas Brisket Co", "TX"), true)
    const flags = flagGeoInName("Texas Brisket Co", austin)
    assert.equal(flags.usesStateName, true)
  })

  it("does not treat TX inside a longer word as the state abbreviation", () => {
    assert.equal(titleHasStateAbbr("Texture BBQ", "TX"), false)
  })
})
