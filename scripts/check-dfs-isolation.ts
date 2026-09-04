import assert from "node:assert/strict"

import {
  envDataForSeoAuth,
  getScanMode,
  hasDataForSeoCredentials,
  resolveDataForSeoAuth,
} from "../src/lib/dataforseo.ts"
import { usableCampaignLimit } from "../src/lib/plans.ts"

const prevLogin = process.env.DATAFORSEO_LOGIN
const prevPassword = process.env.DATAFORSEO_PASSWORD
process.env.DATAFORSEO_LOGIN = "admin-env-login"
process.env.DATAFORSEO_PASSWORD = "admin-env-password"

try {
  const env = envDataForSeoAuth()
  assert.equal(env?.login, "admin-env-login")

  assert.equal(resolveDataForSeoAuth(null), null)
  assert.equal(resolveDataForSeoAuth({ login: "", password: "" }), null)
  assert.equal(resolveDataForSeoAuth({ login: "user@example.com", password: "" }), null)
  assert.equal(hasDataForSeoCredentials({ login: "", password: "" }), false)

  const own = resolveDataForSeoAuth({ login: "user@example.com", password: "user-secret" })
  assert.deepEqual(own, { login: "user@example.com", password: "user-secret" })
  assert.equal(hasDataForSeoCredentials(own), true)
  assert.equal(getScanMode(true, own), "live")
  assert.equal(getScanMode(false, own), "live")
  assert.equal(getScanMode(true, null), "mock")
  assert.equal(getScanMode(false, { login: "", password: "" }), "mock")

  assert.equal(usableCampaignLimit("starter", 0, false), 0)
  assert.equal(usableCampaignLimit("starter", 0, true), 1)
  assert.equal(usableCampaignLimit("agency", 0, true), 5)
  assert.equal(usableCampaignLimit("enterprise", 0, true), 50)

  console.log("dfs isolation checks passed")
} finally {
  if (prevLogin === undefined) delete process.env.DATAFORSEO_LOGIN
  else process.env.DATAFORSEO_LOGIN = prevLogin
  if (prevPassword === undefined) delete process.env.DATAFORSEO_PASSWORD
  else process.env.DATAFORSEO_PASSWORD = prevPassword
}
