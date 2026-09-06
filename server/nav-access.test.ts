import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { allowedPath, navLinks, type NavAccess } from "../src/lib/nav.ts"
import type { AuthUser } from "../src/lib/types.ts"

const user: AuthUser = {
  id: "u1",
  name: "Pat",
  email: "pat@example.com",
  role: "customer",
  status: "active",
  createdAt: "2026-09-06T00:00:00.000Z",
}

const admin: AuthUser = { ...user, id: "a1", role: "admin", email: "ada@example.com" }

describe("allowedPath", () => {
  it("sends desktop visitors to sign in and never to Join or Download", () => {
    const guest = { desktop: true, store: false, admin: false, user: null } satisfies NavAccess
    assert.equal(allowedPath("/", guest), "/login")
    assert.equal(allowedPath("/track", guest), "/login")
    assert.equal(allowedPath("/join", guest), "/login")
    assert.equal(allowedPath("/download", guest), "/login")
    assert.equal(allowedPath("/buy", guest), "/login")
    assert.equal(allowedPath("/reset", guest), "/reset")
  })

  it("keeps website test scan public and sends Join to Buy", () => {
    const guest = { desktop: false, store: true, admin: false, user: null } satisfies NavAccess
    assert.equal(allowedPath("/", guest), "/")
    assert.equal(allowedPath("/track", guest), "/track")
    assert.equal(allowedPath("/join", guest), "/buy")
    assert.equal(allowedPath("/download", guest), "/download")
    assert.equal(allowedPath("/reset", guest), "/reset")
  })

  it("lets a signed-in desktop customer use Lookup, Track, and Account", () => {
    const access = { desktop: true, store: false, admin: false, user } satisfies NavAccess
    assert.equal(allowedPath("/", access), "/")
    assert.equal(allowedPath("/track", access), "/track")
    assert.equal(allowedPath("/account", access), "/account")
    assert.equal(allowedPath("/download", access), "/")
    assert.equal(allowedPath("/buy", access), "/")
  })
})

describe("navLinks", () => {
  it("hides Download, Join, and Buy on desktop", () => {
    const labels = navLinks({ desktop: true, store: false, admin: false, user }).map((link) => link.label)
    assert.deepEqual(labels, ["Lookup", "Track", "Account"])
    assert.equal(labels.includes("Download"), false)
    assert.equal(labels.includes("Join"), false)
    assert.equal(labels.includes("Buy"), false)
  })

  it("hides Join on the public website and keeps Download there", () => {
    const guest = navLinks({ desktop: false, store: true, admin: false, user: null }).map((link) => link.label)
    assert.deepEqual(guest, ["Test scan", "Track", "Buy", "Download", "Sign in"])
    assert.equal(guest.includes("Join"), false)
    const labels = navLinks({ desktop: false, store: true, admin: false, user }).map((link) => link.label)
    assert.deepEqual(labels, ["Test scan", "Track", "Buy", "Download", "Account"])
  })

  it("shows Admin only for admin users", () => {
    const customer = navLinks({ desktop: true, store: false, admin: false, user }).map((link) => link.label)
    assert.equal(customer.includes("Admin"), false)
    const staff = navLinks({ desktop: true, store: false, admin: true, user: admin }).map((link) => link.label)
    assert.ok(staff.includes("Admin"))
  })
})
