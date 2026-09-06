import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPublicVendorLeak } from "./public-copy.ts"
import {
  ADMIN_MONTHLY_QUOTA,
  MONTHLY_AI_PROMPTS,
  MONTHLY_RANK_SCANS,
  MONTHLY_TRAFFIC_CAMPAIGNS,
  formatUsageRemaining,
  quotaExceededMessage,
  quotaLimit,
  usageMeter,
  usageMonthUtc,
} from "./quotas.ts"

describe("monthly quotas", () => {
  it("shares 4 / 10 / 30 and uses UTC calendar months", () => {
    assert.equal(MONTHLY_RANK_SCANS, 4)
    assert.equal(MONTHLY_AI_PROMPTS, 10)
    assert.equal(MONTHLY_TRAFFIC_CAMPAIGNS, 30)
    assert.equal(usageMonthUtc(new Date("2026-09-30T23:59:59.000Z")), "2026-09")
    assert.equal(usageMonthUtc(new Date("2026-10-01T00:00:00.000Z")), "2026-10")
  })

  it("formats remaining counts and 429 copy without vendor names", () => {
    assert.equal(formatUsageRemaining(usageMeter(1, 4)), "3/4")
    assert.equal(formatUsageRemaining(usageMeter(0, 10)), "10/10")
    assert.equal(formatUsageRemaining(usageMeter(18, 30)), "12/30")
    const scans = quotaExceededMessage("rankScans")
    const prompts = quotaExceededMessage("aiPrompts")
    const traffic = quotaExceededMessage("trafficCampaigns")
    assert.equal(scans, "This account has used its 4 rank scans for this month.")
    assert.equal(prompts, "This account has used its 10 AI prompts for this month.")
    assert.equal(traffic, "This account has used its 30 traffic campaigns for this month.")
    for (const text of [scans, prompts, traffic]) {
      assert.equal(isPublicVendorLeak(text), false)
      assert.equal(/cloro/i.test(text), false)
    }
  })

  it("gives admin a high internal cap", () => {
    assert.equal(quotaLimit("rankScans", "admin"), ADMIN_MONTHLY_QUOTA)
    assert.ok(ADMIN_MONTHLY_QUOTA > MONTHLY_RANK_SCANS)
  })
})
