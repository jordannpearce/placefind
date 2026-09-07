import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { allowedPath, isListingPublicPath, listingIdFromPath, navLinks, type NavAccess } from "../src/lib/nav.ts"
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
    assert.equal(allowedPath("/create-profile", guest), "/create-profile")
    assert.equal(allowedPath("/download", guest), "/login")
    assert.equal(allowedPath("/buy", guest), "/login")
    assert.equal(allowedPath("/reset", guest), "/reset")
  })

  it("keeps the marketing home and directory public and sends Join to signup", () => {
    const guest = { desktop: false, store: true, admin: false, user: null } satisfies NavAccess
    assert.equal(allowedPath("/", guest), "/")
    assert.equal(allowedPath("/directory", guest), "/directory")
    assert.equal(allowedPath("/pricing", guest), "/pricing")
    assert.equal(allowedPath("/listings", guest), "/listings")
    assert.equal(allowedPath("/track", guest), "/track")
    assert.equal(allowedPath("/try", guest), "/try")
    assert.equal(allowedPath("/demo", guest), "/demo")
    assert.equal(allowedPath("/join", guest), "/join")
    assert.equal(allowedPath("/create-profile", guest), "/create-profile")
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

  it("sends signed-in visitors from Create a Profile to the listing form", () => {
    const access = { desktop: false, store: true, admin: false, user } satisfies NavAccess
    assert.equal(allowedPath("/create-profile", access), "/listings")
    assert.equal(allowedPath("/join", access), "/account")
  })

  it("sends a pending account to Account instead of owner tools", () => {
    const pending: AuthUser = { ...user, status: "pending" }
    const access = { desktop: false, store: true, admin: false, user: pending } satisfies NavAccess
    assert.equal(allowedPath("/create-profile", access), "/account")
    assert.equal(allowedPath("/dashboard", access), "/account")
    assert.equal(allowedPath("/track", access), "/track")
    const labels = navLinks(access).map((link) => link.label)
    assert.equal(labels.includes("Create listing"), false)
    assert.equal(labels.includes("Dashboard"), false)
    assert.equal(labels.includes("Rank tracker"), false)
    assert.equal(labels.includes("Traffic"), false)
  })

  it("lets a signed-in leftover desktop customer use Lookup, Track, and Account", () => {
    const access = { desktop: true, store: false, admin: false, user } satisfies NavAccess
    assert.equal(allowedPath("/", access), "/")
    assert.equal(allowedPath("/track", access), "/track")
    assert.equal(allowedPath("/account", access), "/account")
    assert.equal(allowedPath("/download", access), "/")
    assert.equal(allowedPath("/buy", access), "/")
  })

  it("keeps Track and Traffic off pending businesses and neighbors, including leftover desktop", () => {
    const pendingBiz: AuthUser = { ...user, accountKind: "business", status: "pending" }
    const neighbor: AuthUser = { ...user, accountKind: "member", status: "active" }
    const pendingAccess = { desktop: false, store: true, admin: false, user: pendingBiz } satisfies NavAccess
    const neighborAccess = { desktop: false, store: true, admin: false, user: neighbor } satisfies NavAccess
    const desktopNeighbor = { desktop: true, store: false, admin: false, user: neighbor } satisfies NavAccess
    assert.equal(allowedPath("/track", pendingAccess), "/track")
    assert.equal(allowedPath("/dashboard", pendingAccess), "/account")
    assert.equal(allowedPath("/track", neighborAccess), "/track")
    assert.equal(allowedPath("/track", desktopNeighbor), "/track")
    assert.equal(navLinks(pendingAccess).some((link) => link.href.startsWith("/track")), false)
    assert.equal(navLinks(neighborAccess).some((link) => link.href.startsWith("/track")), false)
    assert.equal(navLinks(desktopNeighbor).map((link) => link.label).includes("Track"), false)
  })

  it("gives approved businesses and admins Rank tracker and Traffic", () => {
    const owner: AuthUser = { ...user, accountKind: "business", status: "active" }
    const access = { desktop: false, store: true, admin: false, user: owner } satisfies NavAccess
    const staff = { desktop: false, store: true, admin: true, user: admin } satisfies NavAccess
    assert.equal(allowedPath("/track", access), "/track")
    assert.equal(allowedPath("/dashboard", access), "/dashboard")
    const labels = navLinks(access).map((link) => link.label)
    assert.equal(labels.includes("Rank tracker"), true)
    assert.equal(labels.includes("Traffic"), true)
    assert.equal(labels.includes("Create listing"), true)
    assert.equal(navLinks(staff).map((link) => link.label).includes("Rank tracker"), true)
  })
})

describe("listing path parsing", () => {
  it("reads brand-and-category slugs and still recognizes the old id path", () => {
    assert.equal(listingIdFromPath("/listings/harbor-oak-bakery"), "harbor-oak-bakery")
    assert.equal(listingIdFromPath("/listings/seed-1/edit"), "seed-1")
    assert.equal(listingIdFromPath("/listings/new"), null)
    assert.equal(listingIdFromPath("/directory"), null)
    assert.equal(isListingPublicPath("/listings/harbor-oak-bakery"), true)
    assert.equal(isListingPublicPath("/listings/harbor-oak-bakery/edit"), false)
    assert.equal(isListingPublicPath("/listings/new"), false)
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
    assert.deepEqual(guest, ["Home", "Directory", "Pricing", "How it works", "Join", "Create a Profile", "Sign in"])
    assert.equal(guest.includes("Test scan"), false)
    assert.equal(guest.includes("Download"), false)
    assert.equal(guest.includes("Buy"), false)
    assert.equal(guest.includes("Track"), false)
    assert.equal(guest.includes("Traffic"), false)
    assert.equal(guest.includes("Rank tracker"), false)
    assert.equal(guest.includes("Maps"), false)
    const guestHrefs = navLinks({ desktop: false, store: true, admin: false, user: null }).map((link) => link.href)
    assert.equal(guestHrefs.includes("/join"), true)
    assert.equal(guestHrefs.includes("/create-profile"), true)
    assert.equal(guestHrefs.some((href) => href.startsWith("/track")), false)
    const signedIn = navLinks({ desktop: false, store: true, admin: false, user })
    const labels = signedIn.map((link) => link.label)
    assert.deepEqual(labels, [
      "Home",
      "Directory",
      "Pricing",
      "Create listing",
      "Dashboard",
      "Rank tracker",
      "Traffic",
      "Account",
    ])
    assert.equal(signedIn.find((link) => link.label === "Rank tracker")?.href, "/track")
    assert.equal(signedIn.find((link) => link.label === "Traffic")?.href, "/track#traffic")
    assert.equal(labels.includes("Download"), false)
    assert.equal(labels.includes("Buy"), false)
    assert.equal(labels.includes("Maps"), false)
  })

  it("hides listing and owner tools from a free neighbor account", () => {
    const member: AuthUser = { ...user, accountKind: "member" }
    const access = { desktop: false, store: true, admin: false, user: member } satisfies NavAccess
    const labels = navLinks(access).map((link) => link.label)
    assert.deepEqual(labels, ["Home", "Directory", "Pricing", "Account"])
    assert.equal(labels.includes("Create listing"), false)
    assert.equal(labels.includes("Dashboard"), false)
    assert.equal(labels.includes("Rank tracker"), false)
    assert.equal(labels.includes("Traffic"), false)
    assert.equal(allowedPath("/dashboard", access), "/account")
    assert.equal(allowedPath("/track", access), "/track")
  })

  it("keeps Track and Traffic off until a business account is approved", () => {
    const pendingBusiness: AuthUser = { ...user, accountKind: "business", status: "pending" }
    const approvedBusiness: AuthUser = { ...user, accountKind: "business", status: "active" }
    const approvedNeighbor: AuthUser = { ...user, accountKind: "member", status: "active" }
    const pendingAccess = { desktop: false, store: true, admin: false, user: pendingBusiness } satisfies NavAccess
    const businessAccess = { desktop: false, store: true, admin: false, user: approvedBusiness } satisfies NavAccess
    const neighborAccess = { desktop: false, store: true, admin: false, user: approvedNeighbor } satisfies NavAccess
    const adminAccess = { desktop: false, store: true, admin: true, user: admin } satisfies NavAccess

    for (const access of [pendingAccess, neighborAccess]) {
      const labels = navLinks(access).map((link) => link.label)
      assert.equal(labels.includes("Create listing"), false)
      assert.equal(labels.includes("Rank tracker"), false)
      assert.equal(labels.includes("Traffic"), false)
      assert.equal(allowedPath("/track", access), "/track")
    }

    const businessLabels = navLinks(businessAccess).map((link) => link.label)
    assert.equal(businessLabels.includes("Create listing"), true)
    assert.equal(businessLabels.includes("Rank tracker"), true)
    assert.equal(businessLabels.includes("Traffic"), true)
    assert.equal(allowedPath("/track", businessAccess), "/track")

    const adminLabels = navLinks(adminAccess).map((link) => link.label)
    assert.equal(adminLabels.includes("Create listing"), true)
    assert.equal(adminLabels.includes("Rank tracker"), true)
    assert.equal(adminLabels.includes("Traffic"), true)
    assert.equal(adminLabels.includes("Admin"), true)

    const pendingDesktop = { desktop: true, store: false, admin: false, user: pendingBusiness } satisfies NavAccess
    assert.deepEqual(navLinks(pendingDesktop).map((link) => link.label), ["Lookup", "Account"])
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
