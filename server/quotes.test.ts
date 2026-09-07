import assert from "node:assert/strict"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import express from "express"
import { createSession, signup, userFromCookie } from "./auth.ts"
import { createListing } from "./listings.ts"
import { registerListingLeadRoutes } from "./listing-leads.ts"
import { ListingError } from "./listings.ts"
import { quoteRequestEmail, readOutbox } from "./mail.ts"
import { submitQuoteLead } from "./quotes.ts"
import { reloadStoreFromDisk, resetStoreForTests } from "./store.ts"
import { MISSING_QUOTE_EMAIL_MESSAGE } from "../src/lib/quotes.ts"

const completeLead = {
  firstName: "Maya",
  lastName: "Chen",
  email: "maya@example.com",
  phone: "(207) 555-0100",
  street: "18 Harbor Lane",
  city: "Portland",
  state: "ME",
  zip: "04101",
  service: "Two dozen sandwich loaves for a Friday office lunch.",
}

async function withLeadServer(run: (port: number) => Promise<void>) {
  const app = express()
  app.use(express.json())
  registerListingLeadRoutes(app, (req, res) => {
    const user = userFromCookie(req.headers.cookie)
    if (user) return user
    res.status(401).json({ error: "Sign in to continue." })
    return null
  })
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

describe("quote request leads", () => {
  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("validates the lead and queues mail to the listing email", async () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-quotes-")))
    const listing = createListing(
      {
        name: "Harbor & Oak Bakery",
        city: "Portland",
        state: "ME",
        email: "hello@harborandoak.example",
      },
      "owner-1",
    )

    await assert.rejects(
      () => submitQuoteLead(listing.id, { name: "Maya", email: "maya@example.com", need: "Help" }),
      (error: unknown) => {
        assert.ok(error instanceof ListingError)
        assert.equal(error.status, 400)
        assert.match(error.message, /first name|last name|phone|street|city|state|ZIP|service/i)
        return true
      },
    )

    const result = await submitQuoteLead(listing.id, completeLead)
    assert.equal(result.mail.to, "hello@harborandoak.example")
    assert.equal(result.mail.delivered, false)
    assert.match(result.mail.subject, /Harbor & Oak Bakery/)
    assert.match(result.mail.text, /Maya Chen/)
    assert.match(result.mail.text, /18 Harbor Lane/)
    assert.match(result.mail.text, /Two dozen sandwich loaves/)
    assert.equal(/resend/i.test(result.mail.text + result.mail.html), false)
    assert.equal(readOutbox()[0]?.to, "hello@harborandoak.example")
  })

  it("refuses a quote when the listing has no contact email", async () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-quotes-missing-")))
    const listing = createListing({ name: "Copper Bell Books", city: "Asheville", state: "NC" }, "owner-1")
    await assert.rejects(
      () => submitQuoteLead(listing.id, completeLead),
      (error: unknown) => {
        assert.ok(error instanceof ListingError)
        assert.equal(error.status, 400)
        assert.equal(error.message, MISSING_QUOTE_EMAIL_MESSAGE)
        return true
      },
    )
  })

  it("POST /api/listings/:id/quotes accepts an anonymous visitor", async () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-quotes-http-")))
    signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const created = signup({
      name: "Maya Chen",
      email: "maya@example.com",
      password: "password12",
      kind: "member",
    })
    const token = createSession(created.user!.id)
    const listing = createListing(
      {
        name: "Lamppost Hardware",
        city: "Boise",
        state: "ID",
        email: "shop@lampposthardware.example",
      },
      "owner-1",
    )

    await withLeadServer(async (port) => {
      const anonymous = await fetch(`http://127.0.0.1:${port}/api/listings/${listing.id}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completeLead),
      })
      assert.equal(anonymous.status, 201)
      assert.equal(((await anonymous.json()) as { ok?: boolean }).ok, true)

      const bad = await fetch(`http://127.0.0.1:${port}/api/listings/${listing.id}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `pf_session=${token}` },
        body: JSON.stringify({ name: "Maya", email: "not-valid", need: "Need a spare house key cut today." }),
      })
      assert.equal(bad.status, 400)

      const signedIn = await fetch(`http://127.0.0.1:${port}/api/listings/${listing.id}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `pf_session=${token}` },
        body: JSON.stringify({
          firstName: "Maya",
          lastName: "Chen",
          email: "maya@example.com",
          phone: "2085550100",
          street: "400 Main St",
          city: "Boise",
          state: "ID",
          zip: "83702",
          service: "Need a spare house key cut this afternoon.",
        }),
      })
      assert.equal(signedIn.status, 201)
      assert.equal(((await signedIn.json()) as { ok?: boolean }).ok, true)
      assert.equal(readOutbox()[0]?.to, "shop@lampposthardware.example")
    })
  })
})

describe("quoteRequestEmail", () => {
  it("names the shop and the visitor without vendor talk", () => {
    const message = quoteRequestEmail({
      businessName: "Harbor & Oak",
      firstName: "Maya",
      lastName: "Chen",
      name: "Maya Chen",
      email: "maya@example.com",
      phone: "(207) 555-0100",
      street: "18 Harbor Lane",
      city: "Portland",
      state: "ME",
      zip: "04101",
      service: "Two dozen sandwich loaves for Friday.",
    })
    assert.equal(message.subject, "Quote request for Harbor & Oak")
    assert.match(message.text, /maya@example.com/)
    assert.match(message.text, /First name: Maya/)
    assert.match(message.text, /Last name: Chen/)
    assert.match(message.text, /18 Harbor Lane/)
    assert.match(message.text, /Portland/)
    assert.match(message.text, /Service needed/)
    assert.match(message.text, /Two dozen sandwich loaves/)
    assert.equal(/resend|lorem|ipsum/i.test(message.subject + message.text + message.html), false)
  })
})
