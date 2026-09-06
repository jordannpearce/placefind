import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { licenseKeysFromOrders, type Order } from "./shop.ts"

function order(licenseKey: string | null): Order {
  return {
    id: "o1",
    userId: "u1",
    name: "Pat",
    email: "pat@example.com",
    amount: "49",
    status: licenseKey ? "paid" : "pending",
    licenseId: licenseKey ? "lic1" : null,
    licenseKey,
    createdAt: "2026-09-06T00:00:00.000Z",
    emailedAt: null,
  }
}

describe("licenseKeysFromOrders", () => {
  it("returns unique license keys from paid orders", () => {
    assert.deepEqual(licenseKeysFromOrders([order("KEY-1"), order(null), order("KEY-1"), order("KEY-2")]), [
      "KEY-1",
      "KEY-2",
    ])
  })
})
