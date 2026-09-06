import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import {
  emptyApiKeys,
  hostedKeyStatus,
  mapsScanConfigured,
  maskSecret,
  openSealed,
  readHostedKeys,
  resetHostedKeysCacheForTests,
  sealKeys,
} from "./hosted-keys.ts"

describe("maskSecret", () => {
  it("hides all but the last four characters", () => {
    assert.equal(maskSecret(""), "")
    assert.equal(maskSecret("abcd"), "••••")
    assert.equal(maskSecret("scrappey-key-1234"), "••••••••1234")
  })
})

describe("sealKeys", () => {
  it("encrypts keys so the file is not readable as plaintext", () => {
    const keys = {
      scrappeyKey: "scp_secret_value",
      dataforseoLogin: "owner@example.com",
      dataforseoPassword: "api-password-99",
    }
    const sealed = sealKeys(keys)
    assert.equal(sealed.includes("scp_secret_value"), false)
    assert.equal(sealed.includes("api-password-99"), false)
    assert.deepEqual(openSealed(sealed), keys)
  })

  it("still reads an old plaintext key file", () => {
    const opened = openSealed(JSON.stringify({ scrappeyKey: "plain-key", dataforseoLogin: "a@b.c", dataforseoPassword: "x" }))
    assert.equal(opened?.scrappeyKey, "plain-key")
  })
})

describe("hostedKeyStatus", () => {
  const previous = {
    keysFile: process.env.PLACEFIND_KEYS_FILE,
    login: process.env.DATAFORSEO_LOGIN,
    password: process.env.DATAFORSEO_PASSWORD,
    scrappey: process.env.SCRAPPEY_API_KEY,
  }

  after(() => {
    resetHostedKeysCacheForTests()
    if (previous.keysFile == null) delete process.env.PLACEFIND_KEYS_FILE
    else process.env.PLACEFIND_KEYS_FILE = previous.keysFile
    if (previous.login == null) delete process.env.DATAFORSEO_LOGIN
    else process.env.DATAFORSEO_LOGIN = previous.login
    if (previous.password == null) delete process.env.DATAFORSEO_PASSWORD
    else process.env.DATAFORSEO_PASSWORD = previous.password
    if (previous.scrappey == null) delete process.env.SCRAPPEY_API_KEY
    else process.env.SCRAPPEY_API_KEY = previous.scrappey
  })

  it("shows last-four hints only when revealHints is set", () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "placefind-keys-")), "hosted-keys.json")
    writeFileSync(
      file,
      sealKeys({
        scrappeyKey: "scp_secret_value",
        dataforseoLogin: "owner@example.com",
        dataforseoPassword: "api-password-99",
      }),
    )
    process.env.PLACEFIND_KEYS_FILE = file
    const hidden = hostedKeyStatus()
    assert.equal(hidden.scrappey, true)
    assert.equal(hidden.dataforseo, true)
    assert.equal(hidden.scrappeyHint, "")
    assert.equal(hidden.dataforseoHint, "")
    const shown = hostedKeyStatus({ revealHints: true })
    assert.equal(shown.scrappeyHint.includes("scp_secret_value"), false)
    assert.equal(shown.dataforseoHint.includes("owner@example.com"), false)
    assert.match(shown.scrappeyHint, /alue$/)
    assert.match(shown.dataforseoHint, /\.com$/)
  })

  it("falls back to env Maps keys when no key file is present", () => {
    resetHostedKeysCacheForTests()
    process.env.PLACEFIND_KEYS_FILE = path.join(tmpdir(), "placefind-absent-hosted-keys.json")
    delete process.env.SCRAPPEY_API_KEY
    process.env.DATAFORSEO_LOGIN = "env-login@example.test"
    process.env.DATAFORSEO_PASSWORD = "env-password-test"
    const keys = readHostedKeys()
    assert.equal(keys.dataforseoLogin, "env-login@example.test")
    assert.equal(mapsScanConfigured(emptyApiKeys()), true)
    delete process.env.DATAFORSEO_LOGIN
    delete process.env.DATAFORSEO_PASSWORD
    resetHostedKeysCacheForTests()
    assert.equal(mapsScanConfigured(emptyApiKeys()), false)
  })
})
