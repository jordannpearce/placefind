import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { initStore, readCollection, reloadStoreFromDisk, resetStoreForTests, storeDriver, uniqueRowsByKey, writeCollection } from "./store.ts"

describe("uniqueRowsByKey", () => {
  it("keeps the first campaign id when the persist list has duplicates", () => {
    const rows = uniqueRowsByKey(
      [
        { id: "46ca81d3eb3b38d5", name: "first" },
        { id: "20a4f084e7757f15", name: "other" },
        { id: "46ca81d3eb3b38d5", name: "duplicate" },
      ],
      "id",
    )
    assert.equal(rows.length, 2)
    assert.equal(rows[0]?.name, "first")
    assert.equal(rows[1]?.id, "20a4f084e7757f15")
  })
})

describe("store", () => {
  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("uses JSON files when DATABASE_URL is not Postgres", async () => {
    const previous = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-store-")))
    const driver = await initStore()
    assert.equal(driver, "json")
    assert.equal(storeDriver(), "json")
    writeCollection("users", [
      {
        id: "u1",
        name: "Pat",
        email: "pat@example.com",
        passwordHash: "x",
        role: "customer",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ])
    const users = readCollection<{ email: string }>("users")
    assert.equal(users[0]?.email, "pat@example.com")
    writeCollection("password_resets", [
      {
        tokenHash: "abc",
        userId: "u1",
        expiresAt: "2026-01-01T01:00:00.000Z",
        usedAt: null,
      },
    ])
    const resets = readCollection<{ tokenHash: string }>("password_resets")
    assert.equal(resets[0]?.tokenHash, "abc")
    if (previous == null) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previous
  })
})
