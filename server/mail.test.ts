import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import {
  licenseEmail,
  mailPresets,
  personalizeMail,
  selectMailRecipients,
  sendBroadcast,
  welcomeEmail,
} from "./mail.ts"
import { reloadStoreFromDisk, resetStoreForTests } from "./store.ts"

describe("licenseEmail", () => {
  it("includes the license key and download steps", () => {
    const message = licenseEmail({
      name: "Jordan Pearce",
      product: "PlaceFind",
      key: "AAAA-BBBB-CCCC",
      downloadUrl: "http://127.0.0.1:43141/download",
    })
    assert.equal(message.subject.includes("license key"), true)
    assert.equal(message.text.includes("AAAA-BBBB-CCCC"), true)
    assert.equal(message.html.includes("AAAA-BBBB-CCCC"), true)
    assert.equal(message.text.includes("http://127.0.0.1:43141/download"), true)
  })
})

describe("welcomeEmail", () => {
  it("names the product and price", () => {
    const message = welcomeEmail({ name: "Jordan", product: "PlaceFind", price: "49" })
    assert.equal(message.subject, "Welcome to PlaceFind")
    assert.equal(message.text.includes("$49"), true)
    assert.equal(/keygen|resend|dataforseo|scrappey/i.test(message.text), false)
    assert.equal(/keygen|resend|dataforseo|scrappey/i.test(message.html), false)
  })
})

const users = [
  { id: "u1", name: "Ada Admin", email: "ada@example.com", status: "active" },
  { id: "u2", name: "Casey Customer", email: "casey@example.com", status: "active" },
  { id: "u3", name: "Sam Suspended", email: "sam@example.com", status: "suspended" },
]

describe("selectMailRecipients", () => {
  it("sends to checked users and skips everyone else", () => {
    const result = selectMailRecipients({ users, userIds: ["u2"] })
    assert.deepEqual(
      result.recipients.map((row) => row.id),
      ["u2"],
    )
    assert.equal(result.skipped.length, 0)
    assert.equal(result.error, undefined)
  })

  it("sends to all active users when all is set", () => {
    const result = selectMailRecipients({ users, all: true })
    assert.deepEqual(
      result.recipients.map((row) => row.email),
      ["ada@example.com", "casey@example.com"],
    )
    assert.deepEqual(
      result.skipped.map((row) => row.id),
      ["u3"],
    )
  })

  it("skips suspended users unless the admin opts in", () => {
    const skipped = selectMailRecipients({ users, userIds: ["u2", "u3"] })
    assert.deepEqual(
      skipped.recipients.map((row) => row.id),
      ["u2"],
    )
    assert.deepEqual(
      skipped.skipped.map((row) => row.id),
      ["u3"],
    )

    const included = selectMailRecipients({ users, userIds: ["u3"], includeSuspended: true })
    assert.deepEqual(
      included.recipients.map((row) => row.id),
      ["u3"],
    )
    assert.equal(included.skipped.length, 0)
  })

  it("skips suspended users on send-all unless opted in", () => {
    const result = selectMailRecipients({ users, all: true, includeSuspended: true })
    assert.equal(result.recipients.length, 3)
    assert.equal(result.skipped.length, 0)
  })

  it("requires selected users or all", () => {
    const result = selectMailRecipients({ users })
    assert.equal(result.recipients.length, 0)
    assert.match(result.error ?? "", /select at least one user/i)
  })
})

describe("mail campaign presets", () => {
  it("covers welcome, activation, marketing, info, and updates without vendor talk", () => {
    const presets = mailPresets()
    assert.deepEqual(
      presets.map((row) => row.type),
      ["welcome", "activation", "marketing", "info", "updates"],
    )
    for (const preset of presets) {
      assert.equal(/keygen|resend|dataforseo|scrappey/i.test(preset.subject + preset.text), false)
      assert.equal(preset.text.includes("{{first}}"), true)
    }
    assert.equal(personalizeMail("Hi {{first}} at {{email}}", users[0]).includes("Ada"), true)
  })
})

describe("sendBroadcast", () => {
  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("queues one message per recipient", async () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-mail-")))
    const result = await sendBroadcast({
      subject: "Hello {{first}}",
      text: "Hi {{name}}",
      html: "<p>Hi {{name}}</p>",
      recipients: users.slice(0, 2),
      delayMs: 0,
    })
    assert.equal(result.sent.length, 2)
    assert.equal(result.held, 2)
    assert.equal(result.sent[0]?.to, "ada@example.com")
    assert.equal(result.sent[0]?.subject, "Hello Ada")
    assert.equal(result.sent[1]?.subject, "Hello Casey")
  })
})
