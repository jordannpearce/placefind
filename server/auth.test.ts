import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import {
  canLocalBootstrap,
  canManage,
  createSession,
  hashPassword,
  parseCookies,
  signup,
  verifyPassword,
} from "./auth.ts"
import { reloadStoreFromDisk, resetStoreForTests, writeCollection } from "./store.ts"
import type { User } from "./auth.ts"

describe("password hashing", () => {
  it("verifies a matching password and rejects a wrong one", () => {
    const stored = hashPassword("correct-horse")
    assert.equal(verifyPassword("correct-horse", stored), true)
    assert.equal(verifyPassword("wrong-horse", stored), false)
    assert.equal(stored.includes("correct-horse"), false)
  })
})

describe("parseCookies", () => {
  it("reads the PlaceFind session cookie", () => {
    const cookies = parseCookies("pf_session=abc123; other=1")
    assert.equal(cookies.pf_session, "abc123")
  })
})

describe("canManage", () => {
  function isolate() {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-auth-")))
  }

  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("does not treat seller or local-dev mode as admin for everyone", () => {
    isolate()
    const customer: User = {
      id: "cust1",
      name: "Casey",
      email: "casey@example.com",
      passwordHash: hashPassword("password12"),
      role: "customer",
      createdAt: new Date().toISOString(),
    }
    writeCollection("users", [customer])
    writeCollection("sessions", [])
    assert.equal(canManage(undefined), false)
    assert.equal(canManage("pf_session=missing"), false)
    const token = createSession(customer.id)
    assert.equal(canManage(`pf_session=${token}`), false)
  })

  it("grants admin only for an admin session", () => {
    isolate()
    const admin: User = {
      id: "adm1",
      name: "Ada",
      email: "ada@example.com",
      passwordHash: hashPassword("password12"),
      role: "admin",
      createdAt: new Date().toISOString(),
    }
    writeCollection("users", [admin])
    writeCollection("sessions", [])
    assert.equal(canManage(undefined), false)
    const token = createSession(admin.id)
    assert.equal(canManage(`pf_session=${token}`), true)
  })

  it("bootstraps the first local account as admin without opening admin to visitors", () => {
    isolate()
    assert.equal(canLocalBootstrap(), process.env.NODE_ENV !== "production")
    assert.equal(canManage(undefined), false)
    const created = signup({ name: "First Admin", email: "first@example.com", password: "password12" })
    assert.equal(created.user?.role, "admin")
    assert.equal(canManage(undefined), false)
    const token = createSession(created.user!.id)
    assert.equal(canManage(`pf_session=${token}`), true)
    assert.equal(canLocalBootstrap(), false)
  })
})
