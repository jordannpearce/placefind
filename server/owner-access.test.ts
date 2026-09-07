import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { after, describe, it } from "node:test"
import express from "express"
import {
  ACCOUNT_PENDING_MESSAGE,
  listingCreateDenied,
  MEMBER_LISTING_MESSAGE,
  MEMBER_OWNER_TOOLS_MESSAGE,
  ownerToolDenied,
} from "../src/lib/account.ts"
import { approveUser, createSession, signup, userFromCookie } from "./auth.ts"
import { createCampaign, readCampaigns } from "./campaigns.ts"
import { createListing, publicListing } from "./listings.ts"
import { reloadStoreFromDisk, resetStoreForTests } from "./store.ts"

function attachOwnerRoutes(app: express.Express) {
  function requireUser(req: express.Request, res: express.Response) {
    const user = userFromCookie(req.headers.cookie)
    if (user) return user
    res.status(401).json({ error: "Sign in to continue." })
    return null
  }

  function requireApprovedOwner(
    req: express.Request,
    res: express.Response,
    denied: typeof listingCreateDenied = listingCreateDenied,
  ) {
    const user = requireUser(req, res)
    if (!user) return null
    const message = denied(user)
    if (message) {
      res.status(403).json({ error: message })
      return null
    }
    return user
  }

  function requireApprovedTracker(req: express.Request, res: express.Response) {
    return requireApprovedOwner(req, res, ownerToolDenied)
  }

  app.post("/api/listings", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const denied = listingCreateDenied(user)
    if (denied) {
      res.status(403).json({ error: denied })
      return
    }
    const listing = createListing(req.body ?? {}, user.id)
    res.status(201).json({ listing: publicListing(listing, true) })
  })

  app.get("/api/campaigns", (req, res) => {
    const user = requireApprovedTracker(req, res)
    if (!user) return
    res.json({ campaigns: readCampaigns(user.id) })
  })

  app.post("/api/campaigns", (req, res) => {
    const user = requireApprovedTracker(req, res)
    if (!user) return
    res.status(201).json({
      campaign: createCampaign(
        {
          name: "Harbor scan",
          businessName: "Harbor Street Cafe",
          city: "Portland",
          state: "OR",
          keywords: ["coffee"],
        },
        user.id,
      ),
    })
  })

  app.post("/api/campaigns/:id/traffic", (req, res) => {
    const user = requireApprovedTracker(req, res)
    if (!user) return
    res.status(403).json({ error: "Traffic still needs a confirmed Track scan." })
  })

  app.get("/api/campaigns/:id/traffic", (req, res) => {
    const user = requireApprovedTracker(req, res)
    if (!user) return
    res.json({ job: null })
  })
}

async function withOwnerServer(run: (port: number) => Promise<void>) {
  const app = express()
  app.use(express.json())
  attachOwnerRoutes(app)
  const server = createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const port = (server.address() as AddressInfo).port
  try {
    await run(port)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

function cookieHeader(userId: string) {
  return { Cookie: `pf_session=${createSession(userId)}` }
}

describe("owner tool API access", () => {
  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("gates every campaign and traffic route in the live server with requireApprovedTracker", () => {
    const src = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8")
    const routes = [...src.matchAll(/app\.(get|post|patch|delete)\("(\/api\/(?:campaigns[^"]*|geocode))"/g)]
    assert.ok(routes.length >= 15)
    for (const match of routes) {
      const start = match.index ?? 0
      const block = src.slice(start, start + 280)
      assert.match(block, /requireApprovedTracker/, `expected ${match[2]} to use requireApprovedTracker`)
    }
  })

  it("returns 403 for neighbors and pending businesses on listing create, Track, and Traffic", async () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-owner-access-")))
    signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const pending = signup({ name: "Pat Owner", email: "pat-pending@example.com", password: "password12" })
    const neighbor = signup({
      name: "Maya Chen",
      email: "maya-neighbor@example.com",
      password: "password12",
      kind: "member",
    })
    const approved = signup({ name: "Riley Shop", email: "riley-shop@example.com", password: "password12" })
    approveUser(approved.user!.id)

    await withOwnerServer(async (port) => {
      const listingBody = JSON.stringify({ name: "Harbor Street Cafe", city: "Portland", state: "OR" })

      const pendingListing = await fetch(`http://127.0.0.1:${port}/api/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieHeader(pending.user!.id) },
        body: listingBody,
      })
      assert.equal(pendingListing.status, 403)
      assert.equal(((await pendingListing.json()) as { error?: string }).error, ACCOUNT_PENDING_MESSAGE)

      const neighborListing = await fetch(`http://127.0.0.1:${port}/api/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieHeader(neighbor.user!.id) },
        body: listingBody,
      })
      assert.equal(neighborListing.status, 403)
      assert.equal(((await neighborListing.json()) as { error?: string }).error, MEMBER_LISTING_MESSAGE)

      for (const [label, userId, expected] of [
        ["pending campaigns", pending.user!.id, ACCOUNT_PENDING_MESSAGE],
        ["neighbor campaigns", neighbor.user!.id, MEMBER_OWNER_TOOLS_MESSAGE],
      ] as const) {
        const campaigns = await fetch(`http://127.0.0.1:${port}/api/campaigns`, {
          headers: cookieHeader(userId),
        })
        assert.equal(campaigns.status, 403, label)
        assert.equal(((await campaigns.json()) as { error?: string }).error, expected)

        const traffic = await fetch(`http://127.0.0.1:${port}/api/campaigns/camp-1/traffic`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...cookieHeader(userId) },
          body: "{}",
        })
        assert.equal(traffic.status, 403, `${label} traffic`)
        assert.equal(((await traffic.json()) as { error?: string }).error, expected)
      }

      const created = await fetch(`http://127.0.0.1:${port}/api/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieHeader(approved.user!.id) },
        body: listingBody,
      })
      assert.equal(created.status, 201)

      const campaign = await fetch(`http://127.0.0.1:${port}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieHeader(approved.user!.id) },
        body: "{}",
      })
      assert.equal(campaign.status, 201)

      const listed = await fetch(`http://127.0.0.1:${port}/api/campaigns`, {
        headers: cookieHeader(approved.user!.id),
      })
      assert.equal(listed.status, 200)
    })
  })
})
