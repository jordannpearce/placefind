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
  it("sends leftover desktop visitors to sign in and never to Join", () => {
    const guest = { desktop: true, store: false, admin: false, user: null } satisfies NavAccess
    assert.equal(allowedPath("/", guest), "/login")
    assert.equal(allowedPath("/track", guest), "/login")
    assert.equal(allowedPath("/join", guest), "/join")
    assert.equal(allowedPath("/download", guest), "/login")
    assert.equal(allowedPath("/buy", guest), "/login")
    assert.equal(allowedPath("/reset", guest), "/reset")
  })

  it("keeps the marketing home and directory public and sends Join to signup", () => {
    const guest = { desktop: false, store: true, admin: false, user: null } satisfies NavAccess
    assert.equal(allowedPath("/", guest), "/")
    assert.equal(allowedPath("/directory", guest), "/directory")
    assert.equal(allowedPath("/listings", guest), "/listings")
    assert.equal(allowedPath("/track", guest), "/track")
    assert.equal(allowedPath("/try", guest), "/try")
    assert.equal(allowedPath("/demo", guest), "/demo")
    assert.equal(allowedPath("/join", guest), "/join")
    assert.equal(allowedPath("/download", guest), "/")
    assert.equal(allowedPath("/buy", guest), "/")
    assert.equal(allowedPath("/reset", guest), "/reset")
    assert.equal(allowedPath("/terms", guest), "/terms")
    assert.equal(allowedPath("/policy", guest), "/policy")
    assert.equal(allowedPath("/privacy", guest), "/privacy")
    assert.equal(allowedPath("/email-policy", guest), "/email-policy")
    assert.equal(allowedPath("/data-policy", guest), "/data-policy")
    assert.equal(allowedPath("/refund", guest), "/refund")
  })

  it("lets a signed-in leftover desktop customer use Lookup, Track, and Account", () => {
    const access = { desktop: true, store: false, admin: false, user } satisfies NavAccess
    assert.equal(allowedPath("/", access), "/")
    assert.equal(allowedPath("/track", access), "/track")
    assert.equal(allowedPath("/account", access), "/account")
    assert.equal(allowedPath("/download", access), "/")
    assert.equal(allowedPath("/buy", access), "/")
  })
})

describe("navLinks", () => {
  it("hides Download, Join, and Buy on leftover desktop nav", () => {
    const labels = navLinks({ desktop: true, store: false, admin: false, user }).map((link) => link.label)
    assert.deepEqual(labels, ["Lookup", "Track", "Account"])
    assert.equal(labels.includes("Download"), false)
    assert.equal(labels.includes("Join"), false)
    assert.equal(labels.includes("Buy"), false)
  })

  it("uses a directory nav on the public website and hides Test scan for visitors", () => {
    const guest = navLinks({ desktop: false, store: true, admin: false, user: null }).map((link) => link.label)
    assert.deepEqual(guest, ["Home", "Directory", "How it works", "Join", "Sign in"])
    assert.equal(guest.includes("Test scan"), false)
    assert.equal(guest.includes("Download"), false)
    assert.equal(guest.includes("Buy"), false)
    const labels = navLinks({ desktop: false, store: true, admin: false, user }).map((link) => link.label)
    assert.deepEqual(labels, ["Home", "Directory", "Create listing", "Test scan", "Track", "Account"])
    assert.equal(labels.includes("Download"), false)
    assert.equal(labels.includes("Buy"), false)
  })

  it("shows Admin only for admin users", () => {
    const customer = navLinks({ desktop: true, store: false, admin: false, user }).map((link) => link.label)
    assert.equal(customer.includes("Admin"), false)
    const staff = navLinks({ desktop: true, store: false, admin: true, user: admin }).map((link) => link.label)
    assert.ok(staff.includes("Admin"))
    assert.equal(staff.includes("Sell"), false)
  })

  it("hides Admin chrome while viewing as a customer", () => {
    const viewing = {
      desktop: false,
      store: true,
      admin: false,
      user,
      impersonating: { name: user.name, email: user.email },
    } satisfies NavAccess
    const labels = navLinks(viewing).map((link) => link.label)
    assert.equal(labels.includes("Admin"), false)
    assert.equal(labels.includes("Sell"), false)
    assert.equal(allowedPath("/admin", viewing), "/account")
    assert.equal(allowedPath("/sell", viewing), "/account")
  })
})
