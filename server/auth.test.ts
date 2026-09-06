import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import {
  canLocalBootstrap,
  canManage,
  createManagedUser,
  createSession,
  hashPassword,
  login,
  parseCookies,
  setUserStatus,
  signup,
  userFromCookie,
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
      status: "active",
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
      status: "active",
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

describe("account status", () => {
  function isolate() {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-auth-status-")))
  }

  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("blocks login for a suspended user", () => {
    isolate()
    const created = signup({ name: "Sam", email: "sam@example.com", password: "password12" })
    assert.equal(created.user?.status, "active")
    const suspended = setUserStatus(created.user!.id, "suspended")
    assert.equal(suspended.user?.status, "suspended")
    const result = login({ email: "sam@example.com", password: "password12" })
    assert.equal(result.user, undefined)
    assert.equal(result.error, "This account is suspended.")
    const again = signup({ name: "Sam", email: "sam@example.com", password: "password12" })
    assert.equal(again.error, "This account is suspended.")
  })

  it("lets an admin change status and restores login after unsuspend", () => {
    isolate()
    const admin = signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const customer = createManagedUser({
      name: "Casey",
      email: "casey@example.com",
      password: "password12",
      role: "customer",
    })
    assert.equal(customer.user?.status, "active")
    const token = createSession(admin.user!.id)
    assert.equal(canManage(`pf_session=${token}`), true)

    const suspended = setUserStatus(customer.user!.id, "suspended", admin.user!.id)
    assert.equal(suspended.user?.status, "suspended")
    assert.equal(login({ email: "casey@example.com", password: "password12" }).error, "This account is suspended.")
    assert.equal(userFromCookie(`pf_session=${createSession(customer.user!.id)}`), null)

    const active = setUserStatus(customer.user!.id, "active", admin.user!.id)
    assert.equal(active.user?.status, "active")
    const signedIn = login({ email: "casey@example.com", password: "password12" })
    assert.equal(signedIn.user?.email, "casey@example.com")
    assert.equal(signedIn.error, undefined)
  })
})
