import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { initStore, readCollection, reloadStoreFromDisk, resetStoreForTests, storeDriver, writeCollection } from "./store.ts"

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
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ])
    const users = readCollection<{ email: string }>("users")
    assert.equal(users[0]?.email, "pat@example.com")
    if (previous == null) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previous
  })
})
