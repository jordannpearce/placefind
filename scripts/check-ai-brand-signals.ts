import assert from "node:assert/strict"

import {
  consumePromptScan,
  missingBrandLocation,
  normalizeAiBrand,
  parseBrandForm,
  refundPromptScan,
  upsertBrandPrompt,
} from "../src/lib/ai-visibility.ts"
import { canonicalAiLocation, composeBrandAddress, parseLegacyAddress } from "../src/lib/maps-location.ts"
import { AI_SCANS_PER_PROMPT } from "../src/lib/plans.ts"
import { analyzeAnswer, mockCloroScan, signalLabels } from "../src/lib/cloro.ts"

const brand = normalizeAiBrand({
  id: "ai_brand_test",
  name: "Acme Plumbing",
  street: "1200 Congress Ave",
  city: "Austin",
  state: "TX",
  zip: "78701",
  phone: "(512) 555-0142",
  website: "https://acmeplumbing.com",
  competitors: [{ name: "Rival Drain", domain: "rivaldrain.com" }],
  subscriptionId: "complimentary",
  status: "active",
})
assert(brand, "normalize stores company name, street, city, state, zip, phone, and website")
assert.equal(brand.domain, "acmeplumbing.com")
assert.equal(brand.city, "Austin")
assert.equal(brand.state, "TX")
assert.equal(brand.address, "1200 Congress Ave, Austin, TX 78701")
assert.equal(brand.location, "Austin,Texas,United States")
assert.equal(normalizeAiBrand({ id: "ai_brand_admin_sample", name: "Houndstooth Coffee" }), null)

const parsed = parseBrandForm({
  name: "Acme Plumbing",
  street: "1200 Congress Ave",
  city: "Austin",
  state: "TX",
  zip: "78701",
  phone: "512-555-0142",
  website: "acmeplumbing.com",
  competitors: "Rival Drain",
})
assert.equal(parsed.name, "Acme Plumbing")
assert.equal(parsed.website, "acmeplumbing.com")
assert.equal(parsed.city, "Austin")
assert.equal(parsed.state, "TX")
assert.equal(missingBrandLocation({ city: "", state: "TX" }), "Enter the city.")
assert.equal(canonicalAiLocation("Austin", "TX"), "Austin,Texas,United States")
assert.equal(composeBrandAddress(parsed), "1200 Congress Ave, Austin, TX 78701")
assert.deepEqual(parseLegacyAddress("1200 Congress Ave, Austin, TX 78701"), {
  street: "1200 Congress Ave",
  city: "Austin",
  state: "TX",
  zip: "78701",
})

const full = analyzeAnswer({
  engine: "chatgpt",
  label: "ChatGPT",
  text: "Call Acme Plumbing at 1200 Congress Ave, Austin, TX. Their number is (512) 555-0142 and the site is acmeplumbing.com.",
  sources: [{ position: 1, url: "https://acmeplumbing.com", label: "Acme Plumbing" }],
  brand,
})
assert.equal(full.mentioned, true, "brand is found when NAP and website appear")
assert.match(full.answer, /Acme Plumbing/)
assert.deepEqual(full.signals, { name: true, address: true, phone: true, website: true })
assert.deepEqual(signalLabels(full.signals), ["Company name", "Address", "Phone", "Website"])
assert.equal(scanBrandShowing([full]), true)

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
assert.equal(scanBrandShowing([missing]), false)
assert.equal(scanCompetitorsShowing([missing])[0]?.name, "Rival Drain")

const discovered = analyzeAnswer({
  engine: "perplexity",
  label: "Perplexity",
  text: "City Drain Co is the usual recommendation downtown.",
  sources: [{ position: 1, url: "https://citydrain.co", label: "City Drain Co" }],
  brand,
})
assert.equal(
  discovered.competitors.some((item) => item.name === "City Drain Co" && item.cited),
  true,
  "unnamed rivals in sources still show as competitors"
)

const mocks = mockCloroScan({ brand, engines: ["chatgpt"] })
assert.equal(mocks[0]?.mentioned, true)
assert.equal(mocks[0]?.signals.name, true)
assert.match(mocks[0]?.answer || "", /Acme Plumbing/)

assert(brand)
const first = upsertBrandPrompt(brand, "Who is the best plumber downtown and how do I call them?")
assert.equal(first.ok, true)
if (first.ok) {
  assert.equal(brand.prompts.length, 1)
  for (let i = 0; i < AI_SCANS_PER_PROMPT; i += 1) {
    const used = consumePromptScan(brand, first.prompt.id)
    assert.equal(used.ok, true, `scan ${i + 1} should be allowed`)
  }
  const blocked = consumePromptScan(brand, first.prompt.id)
  assert.equal(blocked.ok, false)
  refundPromptScan(brand, first.prompt.id)
  assert.equal(consumePromptScan(brand, first.prompt.id).ok, true)
}
for (let i = 1; i < 10; i += 1) {
  const extra = upsertBrandPrompt(brand, `Prompt number ${i + 1} about local service`)
  assert.equal(extra.ok, true)
}
const overflow = upsertBrandPrompt(brand, "An eleventh prompt should not save on this brand")
assert.equal(overflow.ok, false)

console.log("ai brand signals ok")
