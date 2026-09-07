import assert from "node:assert/strict"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import { signup } from "./auth.ts"
import {
  licenseEmail,
  mailPresets,
  mailStatus,
  normalizeMailInput,
  openSealedMail,
  passwordResetEmail,
  personalizeMail,
  readMailConfig,
  readOutbox,
  resetMailConfigForTests,
  sealMailConfig,
  selectMailRecipients,
  sendBroadcast,
  sendSignupWelcome,
  welcomeEmail,
  writeMailConfig,
} from "./mail.ts"
import { reloadStoreFromDisk, resetStoreForTests } from "./store.ts"

describe("licenseEmail", () => {
  it("points new customers at the directory instead of a boxed product", () => {
    const message = licenseEmail({
      name: "Jordan Pearce",
      product: "PlaceFind",
      key: "AAAA-BBBB-CCCC",
      downloadUrl: "http://127.0.0.1:43141/join",
    })
    assert.equal(message.subject.includes("account"), true)
    assert.equal(/download|windows|license key|setup\.exe/i.test(message.text + message.html), false)
    assert.equal(/directory|listing/i.test(message.text), true)
  })
})

describe("welcomeEmail", () => {
  it("names the product and price", () => {
    const message = welcomeEmail({ name: "Jordan", product: "PlaceFind", price: "49" })
    assert.equal(message.subject, "Welcome to PlaceFind")
    assert.equal(/directory|listing/i.test(message.text), true)
    assert.equal(/download|windows|license key|setup\.exe/i.test(message.text + message.html), false)
    assert.equal(/keygen|resend|dataforseo|scrappey/i.test(message.text), false)
    assert.equal(/keygen|resend|dataforseo|scrappey/i.test(message.html), false)
    assert.match(message.text, /\$150 per month/)
  })

  it("tells a neighbor account the $150 fee is not theirs", () => {
    const message = welcomeEmail({ name: "Maya", product: "PlaceFind", price: "150", kind: "member" })
    assert.match(message.text, /account is free/)
    assert.match(message.text, /does not charge this account \$150/)
    assert.equal(/download|windows|license key/i.test(message.text), false)
  })
})

describe("passwordResetEmail", () => {
  it("includes the reset subject and one-time website link", () => {
    const resetUrl = "https://placefind-production.up.railway.app/reset?token=abc123"
    const message = passwordResetEmail({ name: "Jordan Pearce", resetUrl })
    assert.equal(message.subject, "Reset your PlaceFind password")
    assert.equal(message.text.includes(resetUrl), true)
    assert.equal(message.html.includes(resetUrl), true)
    assert.equal(message.text.includes("one hour"), true)
    assert.equal(/keygen|resend|dataforseo|scrappey/i.test(message.text + message.html), false)
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

describe("admin mail config for signup", () => {
  const previous = {
    dataDir: process.env.PLACEFIND_DATA_DIR,
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL,
    fromName: process.env.RESEND_FROM_NAME,
  }

  after(() => {
    resetMailConfigForTests()
    if (previous.dataDir == null) delete process.env.PLACEFIND_DATA_DIR
    else process.env.PLACEFIND_DATA_DIR = previous.dataDir
    if (previous.apiKey == null) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = previous.apiKey
    if (previous.fromEmail == null) delete process.env.RESEND_FROM_EMAIL
    else process.env.RESEND_FROM_EMAIL = previous.fromEmail
    if (previous.fromName == null) delete process.env.RESEND_FROM_NAME
    else process.env.RESEND_FROM_NAME = previous.fromName
    reloadStoreFromDisk()
  })

  function isolate() {
    resetMailConfigForTests()
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-mail-admin-")))
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM_EMAIL
    delete process.env.RESEND_FROM_NAME
  }

  it("prefers the admin-stored sending key and from-address over env", async () => {
    isolate()
    await writeMailConfig({
      resendApiKey: "re_admin_stored_key",
      fromEmail: "hello@placefind.to",
      fromName: "PlaceFind Admin",
    })
    process.env.RESEND_API_KEY = "re_env_should_not_win"
    process.env.RESEND_FROM_EMAIL = "env@example.com"
    process.env.RESEND_FROM_NAME = "Env Sender"
    const config = readMailConfig()
    assert.equal(config.resendApiKey, "re_admin_stored_key")
    assert.equal(config.fromEmail, "hello@placefind.to")
    assert.equal(config.fromName, "PlaceFind Admin")

    const calls: { url: string; auth: string; from: string }[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { from?: string }
      calls.push({
        url: String(input),
        auth: String((init?.headers as Record<string, string> | undefined)?.Authorization ?? ""),
        from: body.from ?? "",
      })
      return new Response(JSON.stringify({ id: "msg_admin_1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as typeof fetch
    try {
      signup({ name: "Ada Admin", email: "ada-admin@example.com", password: "password12" })
      const created = signup({
        name: "Casey Neighbor",
        email: "casey-neighbor@example.com",
        password: "password12",
        kind: "member",
      })
      assert.equal(created.user?.email, "casey-neighbor@example.com")
      assert.equal(created.user?.accountKind, "member")
      const sent = await sendSignupWelcome(created.user!)
      assert.equal(sent.delivered, true)
      assert.equal(sent.detail, "msg_admin_1")
      assert.equal(calls.length, 1)
      assert.equal(calls[0]?.auth, "Bearer re_admin_stored_key")
      assert.equal(calls[0]?.from, "PlaceFind Admin <hello@placefind.to>")
      assert.match(sent.text, /account is free/)
      assert.equal(sent.detail.includes("re_admin_stored_key"), false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("sends a business welcome with the same admin-stored config", async () => {
    isolate()
    await writeMailConfig({
      resendApiKey: "re_admin_stored_key",
      fromEmail: "hello@placefind.to",
      fromName: "PlaceFind",
    })
    process.env.RESEND_API_KEY = "re_env_should_not_win"
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined
      assert.equal(headers?.Authorization, "Bearer re_admin_stored_key")
      return new Response(JSON.stringify({ id: "msg_biz_1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as typeof fetch
    try {
      signup({ name: "Ada Admin", email: "ada-admin@example.com", password: "password12" })
      const created = signup({
        name: "Pat Owner",
        email: "pat-owner@example.com",
        password: "password12",
        kind: "business",
      })
      assert.equal(created.user?.accountKind, "business")
      const sent = await sendSignupWelcome(created.user!)
      assert.equal(sent.delivered, true)
      assert.match(sent.text, /\$150 per month/)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("holds signup mail with a clear error when no sending key is saved", async () => {
    isolate()
    const created = signup({
      name: "Jordan",
      email: "jordan-hold@example.com",
      password: "password12",
    })
    const sent = await sendSignupWelcome(created.user!)
    assert.equal(sent.delivered, false)
    assert.match(sent.detail, /sending API key in admin/i)
    assert.equal(readOutbox()[0]?.detail, sent.detail)
    assert.equal(mailStatus().configured, false)
    assert.match(mailStatus().lastError ?? "", /sending API key in admin/i)
  })

  it("holds signup mail when the from address is missing", async () => {
    isolate()
    await writeMailConfig({ resendApiKey: "re_admin_stored_key" })
    const created = signup({
      name: "Riley",
      email: "riley-from@example.com",
      password: "password12",
    })
    const sent = await sendSignupWelcome(created.user!)
    assert.equal(sent.delivered, false)
    assert.match(sent.detail, /verified from email/i)
    assert.equal(sent.detail.includes("re_admin_stored_key"), false)
  })

  it("persists the provider error without leaking the API key", async () => {
    isolate()
    await writeMailConfig({
      resendApiKey: "re_admin_stored_key",
      fromEmail: "hello@placefind.to",
      fromName: "PlaceFind",
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "The placefind.to domain is not verified. Key re_admin_stored_key" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch
    try {
      const created = signup({
        name: "Sam",
        email: "sam-error@example.com",
        password: "password12",
      })
      const sent = await sendSignupWelcome(created.user!)
      assert.equal(sent.delivered, false)
      assert.match(sent.detail, /domain is not verified/i)
      assert.equal(sent.detail.includes("re_admin_stored_key"), false)
      assert.match(mailStatus().lastError ?? "", /domain is not verified/i)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("writes admin mail settings into the data-dir file, not only env", async () => {
    isolate()
    const dir = process.env.PLACEFIND_DATA_DIR
    assert.ok(dir)
    await writeMailConfig({
      resendApiKey: "re_admin_stored_key",
      fromEmail: "hello@placefind.to",
      fromName: "PlaceFind",
    })
    const raw = JSON.parse(readFileSync(path.join(dir, "mail.json"), "utf8")) as {
      resendApiKey: string
      fromEmail: string
    }
    assert.equal(raw.resendApiKey, "re_admin_stored_key")
    assert.equal(raw.fromEmail, "hello@placefind.to")
    const sealed = sealMailConfig(raw as { resendApiKey: string; fromEmail: string; fromName: string })
    assert.equal(sealed.includes("re_admin_stored_key"), false)
    assert.equal(openSealedMail(sealed)?.resendApiKey, "re_admin_stored_key")
  })

  it("reloads the saved sending key and from-address after a process restart", async () => {
    isolate()
    await writeMailConfig({
      resendApiKey: "re_test_fake_key_1234",
      fromEmail: "hello@placefind.test",
      fromName: "PlaceFind HQ",
    })
    const saved = mailStatus()
    assert.equal(saved.configured, true)
    assert.equal(saved.fromEmail, "hello@placefind.test")
    assert.equal(saved.fromName, "PlaceFind HQ")
    assert.match(saved.keyHint, /1234$/)
    assert.equal(saved.keyHint.includes("re_test_fake_key_1234"), false)

    resetMailConfigForTests()
    const reloaded = mailStatus()
    assert.equal(reloaded.configured, true)
    assert.equal(reloaded.fromEmail, "hello@placefind.test")
    assert.equal(reloaded.fromName, "PlaceFind HQ")
    assert.match(reloaded.keyHint, /1234$/)
    assert.equal(readMailConfig().resendApiKey, "re_test_fake_key_1234")
  })

  it("accepts alternate field names and keeps the key when only from-address is updated", async () => {
    isolate()
    const parsed = normalizeMailInput({
      apiKey: "re_alias_5555",
      from_email: "alias@placefind.test",
      from_name: "Alias Sender",
    })
    await writeMailConfig(parsed)
    resetMailConfigForTests()
    assert.equal(readMailConfig().resendApiKey, "re_alias_5555")
    assert.equal(mailStatus().fromEmail, "alias@placefind.test")

    await writeMailConfig({ fromEmail: "new@placefind.test", fromName: "New Sender" })
    resetMailConfigForTests()
    const kept = readMailConfig()
    assert.equal(kept.resendApiKey, "re_alias_5555")
    assert.equal(kept.fromEmail, "new@placefind.test")
    assert.equal(kept.fromName, "New Sender")
    assert.equal(mailStatus().configured, true)
  })
})
