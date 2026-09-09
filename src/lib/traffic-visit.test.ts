import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  campaignTrafficProfileId,
  defaultTrafficVisitOptions,
  normalizeDwellSeconds,
  parseDwellDraft,
  orderTrafficActions,
  parseTrafficVisitOptions,
  resolveTrafficDevice,
  trafficVisitLogCopy,
  visitActionsForDevice,
} from "./traffic-visit.ts"

describe("normalizeDwellSeconds", () => {
  it("defaults to 20 and clamps between 5 and 120", () => {
    assert.equal(normalizeDwellSeconds(undefined), 20)
    assert.equal(normalizeDwellSeconds(1), 5)
    assert.equal(normalizeDwellSeconds(5), 5)
    assert.equal(normalizeDwellSeconds(45), 45)
    assert.equal(normalizeDwellSeconds(120), 120)
    assert.equal(normalizeDwellSeconds(400), 120)
    assert.equal(normalizeDwellSeconds(12.5), 20)
  })

  it("does not clamp a 2 while the user is still typing 25", () => {
    assert.equal(normalizeDwellSeconds(2), 5)
    assert.equal(parseDwellDraft("2"), "2")
    assert.equal(parseDwellDraft("25"), "25")
    assert.equal(normalizeDwellSeconds(parseDwellDraft("25")), 25)
  })
})

describe("parseTrafficVisitOptions", () => {
  it("keeps listed actions and drops unknown ones", () => {
    const visit = parseTrafficVisitOptions({
      dwellSeconds: 30,
      actionOrder: "random",
      actions: ["reviews", "phone", "not-real", "reviews", "website"],
      device: "mobile",
    })
    assert.deepEqual(visit, {
      dwellSeconds: 30,
      actionOrder: "random",
      actions: ["reviews", "phone", "website"],
      device: "mobile",
    })
  })

  it("defaults to sequential dwell plus every action", () => {
    assert.deepEqual(parseTrafficVisitOptions(null), defaultTrafficVisitOptions())
  })
})

describe("resolveTrafficDevice", () => {
  it("uses a mobile profile in auto mode only when call is selected", () => {
    assert.equal(resolveTrafficDevice({ device: "auto", actions: ["reviews", "phone"] }), "mobile")
    assert.equal(resolveTrafficDevice({ device: "auto", actions: ["reviews", "website"] }), "desktop")
    assert.equal(resolveTrafficDevice({ device: "desktop", actions: ["phone"] }), "desktop")
  })

  it("drops call on desktop profiles", () => {
    assert.deepEqual(visitActionsForDevice({ actions: ["reviews", "phone", "website"] }, "desktop"), [
      "reviews",
      "website",
    ])
    assert.deepEqual(visitActionsForDevice({ actions: ["reviews", "phone"] }, "mobile"), ["reviews", "phone"])
  })
})

describe("orderTrafficActions", () => {
  it("keeps listed order, or shuffles with the supplied random", () => {
    const actions = ["reviews", "directions", "website"] as const
    assert.deepEqual(orderTrafficActions([...actions], "sequential"), ["reviews", "directions", "website"])
    let calls = 0
    const random = () => {
      calls += 1
      return 0
    }
    assert.deepEqual(orderTrafficActions([...actions], "random", random), ["directions", "website", "reviews"])
    assert.ok(calls >= 1)
  })
})

describe("campaignTrafficProfileId", () => {
  it("reuses one desktop and one mobile profile per campaign", () => {
    assert.equal(campaignTrafficProfileId("camp-123", "desktop"), "pf-camp-123")
    assert.equal(campaignTrafficProfileId("camp-123", "mobile"), "pf-camp-123-m")
    assert.equal(campaignTrafficProfileId("camp-123", "desktop"), campaignTrafficProfileId("camp-123", "desktop"))
  })
})

describe("trafficVisitLogCopy", () => {
  it("describes dwell and the selected listing actions", () => {
    assert.equal(
      trafficVisitLogCopy({ dwellSeconds: 25, actionOrder: "sequential", actions: ["reviews", "website"], device: "auto" }, "desktop"),
      "stayed 25s on the listing, then read reviews → website.",
    )
    assert.equal(
      trafficVisitLogCopy({ dwellSeconds: 15, actionOrder: "random", actions: [], device: "desktop" }, "desktop"),
      "stayed 15s on the listing.",
    )
  })
})
