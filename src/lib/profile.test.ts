import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CRAWL_ARTICLE_FOOTER,
  listingDocumentTitle,
  listingHasEnhancedProfile,
  listingBusinessName,
  listingProfileFromInput,
  listingProfileHeadings,
  renderProfileArticle,
  parseOwnerSchema,
  profileFieldsChanged,
  profileHasOwnerCopy,
  profileSchemaError,
  sanitizeOwnerHeadHtml,
  sanitizeOwnerHtml,
  stripCrawlArticleFooter,
} from "./profile.ts"
import type { DirectoryListing } from "./types.ts"

const listing = (overrides: Partial<DirectoryListing> = {}): DirectoryListing => ({
  id: "listing-1",
  name: "Harbor & Oak Bakery",
  street: "18 Exchange St",
  city: "Portland",
  state: "ME",
  zip: "04101",
  category: "Bakery",
  keywords: ["pastry"],
  phone: "(207) 555-0142",
  website: "https://harborandoak.example",
  hours: "Tue–Sun 7:00 AM–3:00 PM",
  placeId: "sample",
  cid: null,
  mapsStatus: "found",
  mapsTitle: "Harbor & Oak Bakery",
  mapsAddress: "18 Exchange St, Portland, ME 04101",
  mapsUrl: null,
  createdAt: "2026-08-12T14:00:00.000Z",
  updatedAt: "2026-08-12T14:00:00.000Z",
  ...overrides,
})

describe("listing profile helpers", () => {
  it("strips the auto-published crawl footer from stored articles", () => {
    const article = `Harbor & Oak is a bakery in Portland, ME.\n\n${CRAWL_ARTICLE_FOOTER}`
    assert.equal(stripCrawlArticleFooter(article), "Harbor & Oak is a bakery in Portland, ME.")
    assert.equal(
      stripCrawlArticleFooter(
        "Harbor & Oak bakes bread.\n\nThis profile was written from the business website and the listing the owner published on PlaceFind. Reviews from visitors appear below the facts.",
      ),
      "Harbor & Oak bakes bread.",
    )
  })

  it("sanitizes owner HTML and keeps only safe head tags", () => {
    assert.equal(
      sanitizeOwnerHtml('<p>Open daily</p><script>alert(1)</script><img src=x onerror="alert(1)">'),
      '<p>Open daily</p><img src=x>',
    )
    assert.equal(
      sanitizeOwnerHeadHtml(
        '<meta name="robots" content="index,follow"><script>alert(1)</script><link rel="canonical" href="https://shop.example">',
      ),
      '<meta name="robots" content="index,follow">\n<link rel="canonical" href="https://shop.example">',
    )
  })

  it("accepts a JSON object schema and rejects invalid schema", () => {
    assert.equal(parseOwnerSchema('{"@type":"Bakery","name":"Harbor & Oak"}'), '{"@type":"Bakery","name":"Harbor & Oak"}')
    assert.equal(parseOwnerSchema("not json"), "")
    assert.equal(profileSchemaError(""), undefined)
    assert.equal(profileSchemaError('{"@type":"Bakery"}'), undefined)
    assert.equal(profileSchemaError("[]"), "Schema must be a JSON object.")
    assert.equal(profileSchemaError("{"), "Schema must be valid JSON.")
  })

  it("uses a custom page title when the owner set one", () => {
    assert.equal(listingDocumentTitle(listing({ profilePageTitle: "Morning bread in Portland" })), "Morning bread in Portland")
    assert.equal(listingDocumentTitle(listing({ street: "", zip: "", mapsAddress: "" })), "Harbor & Oak Bakery · Portland, ME")
    assert.equal(listingHasEnhancedProfile({ profileContent: "Hello", profileHtml: "" }), true)
    assert.equal(listingHasEnhancedProfile({ profileContent: "", profileHtml: "<p>Hi</p>" }), true)
    assert.equal(listingHasEnhancedProfile({ profileContent: "  ", profileHtml: "" }), false)
    assert.equal(listingBusinessName(listing({ profileH1: "Morning bread in Portland" })), "Harbor & Oak Bakery")
    assert.equal(listingBusinessName(listing()), "Harbor & Oak Bakery")
    assert.equal(listingHasEnhancedProfile({ profileContent: "", profileHtml: "", profileH1: "Morning bread" }), true)
    assert.deepEqual(listingProfileHeadings({ profileH2: "Pastry counter", profileH4: "Hours" }), [
      { level: 2, text: "Pastry counter" },
      { level: 4, text: "Hours" },
    ])
    assert.equal(listingHasEnhancedProfile({ profileContent: "", profileHtml: "", profileH3: "Classes" }), true)
  })

  it("turns article markdown headings into H1–H6 tags", () => {
    const html = renderProfileArticle("# Wheel throwing\n\n## Weekend classes\n\nOpen Saturday.\n\n###### Tiny note")
    assert.match(html, /<h1>Wheel throwing<\/h1>/)
    assert.match(html, /<h2>Weekend classes<\/h2>/)
    assert.match(html, /<p>Open Saturday\.<\/p>/)
    assert.match(html, /<h6>Tiny note<\/h6>/)
    assert.equal(renderProfileArticle("<h3>Custom</h3><script>alert(1)</script>"), "<h3>Custom</h3>")
  })

  it("marks a profile as owner copy only when fields are filled or changed", () => {
    const empty = listingProfileFromInput({})
    assert.equal(profileHasOwnerCopy(empty), false)
    const filled = listingProfileFromInput({
      profilePageTitle: "Custom title",
      profileContent: `We bake every morning.\n\n${CRAWL_ARTICLE_FOOTER}`,
    })
    assert.equal(filled.profileContent, "We bake every morning.")
    assert.equal(profileHasOwnerCopy(filled), true)
    assert.equal(profileFieldsChanged({ profileContent: "We bake every morning." }, filled), true)
    assert.equal(
      profileFieldsChanged(
        { ...filled, profilePageTitle: "Custom title" },
        listingProfileFromInput({ profilePageTitle: "Custom title", profileContent: "We bake every morning." }),
      ),
      false,
    )
  })
})
