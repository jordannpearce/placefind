import assert from "node:assert/strict"

import {
  applyBrandProfileUpdate,
  consumePromptScan,
  missingBrandLocation,
  normalizeAiBrand,
  parseBrandForm,
  promptSlotsForBrand,
  refundPromptScan,
  scanLocationForBrand,
  updateAssignedBrandProfile,
  upsertBrandPrompt,
} from "../src/lib/ai-visibility.ts"
import {
  canonicalAiLocation,
  composeBrandAddress,
  parseLegacyAddress,
  usableBrandCoords,
} from "../src/lib/maps-location.ts"
import { AI_SCANS_PER_PROMPT } from "../src/lib/plans.ts"
import {
  analyzeAnswer,
  mockCloroScan,
  scanBrandShowing,
  scanCompetitorsShowing,
  signalLabels,
} from "../src/lib/cloro.ts"

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
assert.deepEqual(usableBrandCoords(0, 0), { lat: null, lng: null })
assert.deepEqual(usableBrandCoords("", ""), { lat: null, lng: null })
assert.deepEqual(usableBrandCoords(30.2672, -97.7431), { lat: 30.2672, lng: -97.7431 })
assert.equal(normalizeAiBrand({ ...brand, lat: 0, lng: 0 })?.lat, null)
assert.equal(scanLocationForBrand(parsed), "Austin,Texas,United States")
assert.equal(missingBrandLocation({ city: "Austin", state: "" }), "Choose a state.")
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

const emptySlots = promptSlotsForBrand({ prompts: [] })
assert.equal(emptySlots.empty, true)
assert.equal(emptySlots.emptyMessage, "No prompts saved yet")
assert.equal(emptySlots.slots.length, 10)
assert.equal(emptySlots.slots.every((slot) => !slot.saved), true)

const review = promptSlotsForBrand(brand)
assert.equal(review.empty, false)
assert.equal(review.savedCount, 10)
assert.equal(review.slots[0]?.saved, true)
assert.equal(review.slots[0]?.scansRemaining, 0)

const relocated = parseBrandForm({
  name: "Acme Plumbing West",
  street: "200 West 6th St",
  city: "Dallas",
  state: "TX",
  zip: "75201",
  phone: "(214) 555-0100",
  website: "https://acmewest.example",
  competitors: "Dallas Drain",
})
const updated = applyBrandProfileUpdate(brand, {
  ...relocated,
  lat: 32.78,
  lng: -96.8,
  location: "Dallas,Texas,United States",
})
assert(updated)
assert.equal(updated.id, brand.id)
assert.equal(updated.subscriptionId, "complimentary")
assert.equal(updated.prompts.length, 10)
assert.equal(updated.name, "Acme Plumbing West")
assert.equal(updated.city, "Dallas")
assert.equal(updated.street, "200 West 6th St")
assert.equal(updated.location, "Dallas,Texas,United States")
assert.equal(updated.lat, 32.78)
assert.equal(updated.lng, -96.8)
assert.equal(updated.status, "active")

const owner = {
  id: "user_owner",
  aiBrands: [brand],
} as unknown as import("../src/lib/types.ts").User
const stolen = updateAssignedBrandProfile(owner, "ai_brand_someone_else", relocated)
assert.equal(stolen, null)
const owned = updateAssignedBrandProfile(owner, brand.id, {
  ...relocated,
  lat: 32.78,
  lng: -96.8,
  location: "Dallas,Texas,United States",
})
assert(owned)
assert.equal(owned.subscriptionId, "complimentary")
assert.equal(owner.aiBrands[0]?.city, "Dallas")
assert.equal(owner.aiBrands[0]?.prompts.length, 10)

console.log("ai brand signals ok")
