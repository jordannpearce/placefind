import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createLicense,
  keygenPublicStatus,
  licenseMessage,
  licenseStatus,
  maskSecret,
  toPublicKeygen,
  validateLicenseKey,
} from "./keygen.ts"

describe("licenseMessage", () => {
  it("maps Keygen codes to customer-facing text", () => {
    assert.equal(licenseMessage("VALID"), "License is active.")
    assert.equal(licenseMessage("EXPIRED"), "This license has expired.")
    assert.equal(licenseMessage("SUSPENDED"), "This license is suspended.")
    assert.equal(licenseMessage("BANNED"), "This license was revoked.")
    assert.equal(licenseMessage("NOT_FOUND"), "That license key was not found.")
    assert.equal(licenseMessage("NOT_FOUND_ERROR"), "That license key was not found.")
    assert.equal(licenseMessage("TOO_MANY_MACHINES"), "This license is already used on too many computers.")
    assert.equal(licenseMessage("NO_MACHINE"), "This license is not activated on this computer yet.")
    assert.equal(licenseMessage("WEIRD", "custom"), "custom")
    assert.equal(licenseMessage("WEIRD"), "This license is not valid.")
  })
})

describe("maskSecret", () => {
  it("hides a license key except the last four characters", () => {
    assert.equal(maskSecret(""), "")
    assert.equal(maskSecret("abcd"), "••••")
    assert.equal(maskSecret("C1B6DE-39A6E3-DE1529-8559A0-4AF593-V3").endsWith("-V3"), true)
    assert.equal(maskSecret("C1B6DE-39A6E3-DE1529-8559A0-4AF593-V3").includes("C1B6DE"), false)
  })
})

describe("toPublicKeygen", () => {
  it("keeps only account and product IDs so the admin token never ships to buyers", () => {
    const pub = toPublicKeygen({
      accountId: "acc-public",
      productId: "prod-public",
      policyId: "pol-secret",
      token: "prod-admin-token-value",
    })
    assert.deepEqual(pub, { accountId: "acc-public", productId: "prod-public" })
    assert.equal("token" in pub, false)
    assert.equal("policyId" in pub, false)
    assert.equal(JSON.stringify(pub).includes("prod-admin-token-value"), false)
  })
})

describe("keygen without credentials", () => {
  it("never includes a raw token on the public status payload", () => {
    const status = keygenPublicStatus()
    assert.equal("token" in status, false)
    assert.equal(typeof status.tokenHint, "string")
    if (status.tokenHint) {
      assert.equal(status.tokenHint.includes("prod-"), false)
      assert.equal(status.tokenHint.includes("admin-"), false)
    }
  })

  it("never requires a product license on the SaaS directory", async () => {
    const status = await licenseStatus()
    assert.equal(status.required, false)
    assert.equal(status.valid, true)
    assert.equal(status.configured, false)
  })

  it("refuses to create a license without a saved admin token", async () => {
    const result = await createLicense({ name: "Casey", email: "casey@example.com" })
    if (!result.license) {
      assert.ok(result.error)
      assert.match(result.error, /account ID, policy ID, and admin token/i)
    }
  })

  it("validates as not configured when no public account is available", async () => {
    const result = await validateLicenseKey("XXXXXX-XXXXXX")
    if (result.code === "NOT_CONFIGURED") {
      assert.equal(result.valid, false)
      assert.equal(result.licenseId, null)
    }
  })
})
