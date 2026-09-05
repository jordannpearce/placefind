import assert from "node:assert/strict"

import { normalizeAiBrand, parseBrandForm } from "../src/lib/ai-visibility.ts"
import { analyzeAnswer, mockCloroScan, signalLabels } from "../src/lib/cloro.ts"

const brand = normalizeAiBrand({
  id: "ai_brand_test",
  name: "Acme Plumbing",
  address: "1200 Congress Ave, Austin, TX 78701",
  phone: "(512) 555-0142",
  website: "https://acmeplumbing.com",
  competitors: [{ name: "Rival Drain", domain: "rivaldrain.com" }],
  subscriptionId: "complimentary",
  status: "active",
})
assert(brand, "normalize stores company name, address, phone, and website")
assert.equal(brand.domain, "acmeplumbing.com")
assert.equal(normalizeAiBrand({ id: "ai_brand_admin_sample", name: "Houndstooth Coffee" }), null)

const parsed = parseBrandForm({
  name: "Acme Plumbing",
  address: "1200 Congress Ave, Austin, TX 78701",
  phone: "512-555-0142",
  website: "acmeplumbing.com",
  competitors: "Rival Drain",
})
assert.equal(parsed.name, "Acme Plumbing")
assert.equal(parsed.website, "acmeplumbing.com")

const full = analyzeAnswer({
  engine: "chatgpt",
  label: "ChatGPT",
  text: "Call Acme Plumbing at 1200 Congress Ave, Austin, TX. Their number is (512) 555-0142 and the site is acmeplumbing.com.",
  sources: [{ position: 1, url: "https://acmeplumbing.com", label: "Acme Plumbing" }],
  brand,
})
assert.equal(full.mentioned, true, "brand is found when NAP and website appear")
assert.deepEqual(full.signals, { name: true, address: true, phone: true, website: true })
assert.deepEqual(signalLabels(full.signals), ["Company name", "Address", "Phone", "Website"])

const missing = analyzeAnswer({
  engine: "gemini",
  label: "Gemini",
  text: "Rival Drain is a frequent recommendation for clogged lines.",
  sources: [{ position: 1, url: "https://rivaldrain.com", label: "Rival Drain" }],
  brand,
})
assert.equal(missing.mentioned, false, "brand is missing when none of the facts appear")
assert.deepEqual(missing.signals, { name: false, address: false, phone: false, website: false })
assert.equal(missing.competitors[0]?.mentioned, true)

const mocks = mockCloroScan({ brand, engines: ["chatgpt"] })
assert.equal(mocks[0]?.mentioned, true)
assert.equal(mocks[0]?.signals.name, true)

console.log("ai brand signals ok")
