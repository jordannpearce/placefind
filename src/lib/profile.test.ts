import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import {
  applyListingDocumentHead,
  applyListingHtmlHead,
  CRAWL_ARTICLE_FOOTER,
  DEFAULT_SITE_DESCRIPTION,
  listingCanonicalHref,
  listingDocumentDescription,
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

const indexHtml = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../index.html"), "utf8")

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

  it("prefers owner meta description and falls back to name and city", () => {
    assert.equal(
      listingDocumentDescription(listing({ profileMetaDescription: "Wheel-thrown mugs and weekend classes on South Congress." })),
      "Wheel-thrown mugs and weekend classes on South Congress.",
    )
    assert.equal(listingDocumentDescription(listing()), "Harbor & Oak Bakery in Portland, ME.")
    assert.equal(listingDocumentDescription(listing({ city: "", state: "" })), "Harbor & Oak Bakery on PlaceFind.")
    assert.equal(listingDocumentDescription(listing()).includes("$150"), false)
    assert.match(indexHtml, new RegExp(DEFAULT_SITE_DESCRIPTION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  })

  it("rewrites the SPA shell so listing meta replaces the $150 marketing line", () => {
    const custom = listing({
      id: "listing-cedar",
      slug: "cedar-clay-studio-pottery-studio",
      name: "Cedar & Clay Studio",
      profilePageTitle: "Cedar & Clay Studio · Austin pottery",
      profileMetaDescription: "Wheel-thrown mugs and weekend classes on South Congress.",
    })
    const next = applyListingHtmlHead(indexHtml, custom, "https://placefind.example/listings/listing-cedar")
    assert.match(next, /<title>Cedar &amp; Clay Studio · Austin pottery<\/title>/)
    assert.match(next, /id="placefind-description"[^>]*content="Wheel-thrown mugs and weekend classes on South Congress\."/)
    assert.match(next, /property="og:description"[^>]*content="Wheel-thrown mugs and weekend classes on South Congress\."/)
    assert.equal((next.match(/name="description"/g) ?? []).length, 1)
    assert.match(next, /id="placefind-canonical"[^>]*href="https:\/\/placefind\.to\/listings\/cedar-clay-studio-pottery-studio"/)
    assert.match(next, /property="og:url"[^>]*content="https:\/\/placefind\.to\/listings\/cedar-clay-studio-pottery-studio"/)
    assert.equal(next.includes(DEFAULT_SITE_DESCRIPTION), false)
    assert.equal(/\$150/.test(next), false)

    const fallback = applyListingHtmlHead(indexHtml, listing({ profileMetaDescription: "" }))
    assert.match(fallback, /content="Harbor &amp; Oak Bakery in Portland, ME\."/)
    assert.equal(fallback.includes(DEFAULT_SITE_DESCRIPTION), false)

    const ownerCanonical = applyListingHtmlHead(
      indexHtml.replace(
        "</head>",
        '<link rel="canonical" href="https://shop.example"><meta name="robots" content="index,follow"></head>',
      ),
      listing({ slug: "harbor-oak-bakery" }),
    )
    assert.match(ownerCanonical, /id="placefind-canonical"[^>]*href="https:\/\/placefind\.to\/listings\/harbor-oak-bakery"/)
    assert.equal(ownerCanonical.includes("https://shop.example"), false)
    assert.match(ownerCanonical, /name="robots"/)
    assert.equal((ownerCanonical.match(/rel="canonical"/g) ?? []).length, 1)
  })

  it("keeps a placefind.to listing slug canonical even when opened by id", () => {
    const cedar = listing({
      id: "listing-cedar",
      slug: "cedar-clay-studio-pottery-studio",
      name: "Cedar & Clay Studio",
      category: "Pottery studio",
    })
    const expected = '<link id="placefind-canonical" rel="canonical" href="https://placefind.to/listings/cedar-clay-studio-pottery-studio">'
    const fromSlug = applyListingHtmlHead(indexHtml, cedar, "/listings/cedar-clay-studio-pottery-studio")
    const fromId = applyListingHtmlHead(indexHtml, cedar, "/listings/listing-cedar", "http://127.0.0.1:43141")
    assert.equal(fromSlug.includes(expected), true)
    assert.equal(fromId.includes(expected), true)
    assert.equal(listingCanonicalHref(cedar, "/listings/listing-cedar"), "https://placefind.to/listings/cedar-clay-studio-pottery-studio")
    assert.equal((fromId.match(/rel="canonical"/g) ?? []).length, 1)

    const shopHead = applyListingHtmlHead(
      indexHtml,
      listing({
        ...cedar,
        profileHeadHtml: '<link rel="canonical" href="https://shop.example"><meta name="robots" content="index,follow">',
      }),
    )
    assert.equal(shopHead.includes(expected), true)
    assert.equal(shopHead.includes("https://shop.example"), false)
    assert.equal((shopHead.match(/rel="canonical"/g) ?? []).length, 1)

    const ownerListing = applyListingHtmlHead(
      indexHtml,
      listing({
        ...cedar,
        profileHeadHtml: '<link rel="canonical" href="https://placefind.to/listings/cedar-clay-studio-pottery-studio">',
      }),
    )
    assert.equal(ownerListing.includes(expected), true)
    assert.equal(
      listingCanonicalHref(
        listing({
          id: "listing-cedar",
          slug: "cedar-clay-studio-pottery-studio",
          profileHeadHtml: '<link rel="canonical" href="https://www.placefind.to/listings/other-clay-studio">',
        }),
      ),
      "https://placefind.to/listings/other-clay-studio",
    )
  })

  it("replaces the live document description and restores the site default", () => {
    type FakeNode = {
      id: string
      attrs: Map<string, string>
      type?: string
      textContent?: string
      innerHTML?: string
      children: FakeNode[]
      setAttribute: (name: string, value: string) => void
      getAttribute: (name: string) => string | null
      removeAttribute: (name: string) => void
      remove: () => void
    }
    const headChildren: FakeNode[] = []
    function makeNode(): FakeNode {
      const node: FakeNode = {
        id: "",
        attrs: new Map(),
        children: [],
        setAttribute(name, value) {
          if (name === "id") node.id = value
          node.attrs.set(name, value)
        },
        getAttribute(name) {
          if (name === "id") return node.id || null
          return node.attrs.get(name) ?? null
        },
        removeAttribute(name) {
          if (name === "id") node.id = ""
          node.attrs.delete(name)
        },
        remove() {
          const index = headChildren.indexOf(node)
          if (index >= 0) headChildren.splice(index, 1)
        },
      }
      return node
    }
    function seedMeta(id: string, attr: "name" | "property", key: string, content: string) {
      const node = makeNode()
      node.setAttribute("id", id)
      node.setAttribute(attr, key)
      node.setAttribute("content", content)
      headChildren.push(node)
      return node
    }
    const descriptionMeta = seedMeta("placefind-description", "name", "description", DEFAULT_SITE_DESCRIPTION)
    seedMeta("placefind-og-description", "property", "og:description", DEFAULT_SITE_DESCRIPTION)
    const document = {
      title: "PlaceFind — Local business directory",
      head: {
        children: headChildren,
        appendChild(node: FakeNode) {
          headChildren.push(node)
          return node
        },
        querySelector(selector: string) {
          const nameMatch = selector.match(/^meta\[name="([^"]+)"\]$/)
          if (nameMatch) return headChildren.find((node) => node.getAttribute("name") === nameMatch[1]) ?? null
          const propMatch = selector.match(/^meta\[property="([^"]+)"\]$/)
          if (propMatch) return headChildren.find((node) => node.getAttribute("property") === propMatch[1]) ?? null
          return null
        },
      },
      getElementById(id: string) {
        return headChildren.find((node) => node.id === id) ?? null
      },
      createElement() {
        return makeNode()
      },
    }
    Object.assign(globalThis, { document })

    const restore = applyListingDocumentHead(
      listing({ profileMetaDescription: "Wheel-thrown mugs and weekend classes on South Congress." }),
      "https://placefind.example/listings/cedar-clay-studio-pottery-studio",
    )
    assert.equal(descriptionMeta.getAttribute("content"), "Wheel-thrown mugs and weekend classes on South Congress.")
    assert.equal(
      document.head.querySelector('meta[property="og:description"]')?.getAttribute("content"),
      "Wheel-thrown mugs and weekend classes on South Congress.",
    )
    assert.equal(headChildren.filter((node) => node.getAttribute("name") === "description").length, 1)
    assert.equal(document.title, "Harbor & Oak Bakery · 18 Exchange St, Portland, ME 04101")

    restore()
    assert.equal(descriptionMeta.getAttribute("content"), DEFAULT_SITE_DESCRIPTION)
    assert.equal(document.head.querySelector('meta[property="og:description"]')?.getAttribute("content"), DEFAULT_SITE_DESCRIPTION)
    assert.equal(document.title, "PlaceFind — Local business directory")

    applyListingDocumentHead(listing({ profileMetaDescription: "" }))
    assert.equal(descriptionMeta.getAttribute("content"), "Harbor & Oak Bakery in Portland, ME.")
    assert.equal(descriptionMeta.getAttribute("content")?.includes("$150"), false)

    delete (globalThis as { document?: unknown }).document
  })

  it("updates the same document canonical tag for listing navigation and owner head", () => {
    type FakeNode = {
      tagName: string
      id: string
      attrs: Map<string, string>
      children: FakeNode[]
      innerHTML: string
      setAttribute: (name: string, value: string) => void
      getAttribute: (name: string) => string | null
      removeAttribute: (name: string) => void
      remove: () => void
    }
    const headChildren: FakeNode[] = []
    function makeNode(tagName = "DIV"): FakeNode {
      const node: FakeNode = {
        tagName,
        id: "",
        attrs: new Map(),
        children: [],
        get innerHTML() {
          return ""
        },
        set innerHTML(value: string) {
          node.children = []
          for (const match of value.matchAll(/<(link|meta)\b([^>]*)\/?>/gi)) {
            const child = makeNode(match[1]!.toUpperCase())
            const attrs = match[2] ?? ""
            for (const attr of attrs.matchAll(/\b([a-z:]+)\s*=\s*["']([^"']+)["']/gi)) {
              child.setAttribute(attr[1]!, attr[2]!)
            }
            node.children.push(child)
          }
        },
        setAttribute(name, value) {
          if (name === "id") node.id = value
          node.attrs.set(name, value)
        },
        getAttribute(name) {
          if (name === "id") return node.id || null
          return node.attrs.get(name) ?? null
        },
        removeAttribute(name) {
          if (name === "id") node.id = ""
          node.attrs.delete(name)
        },
        remove() {
          const index = headChildren.indexOf(node)
          if (index >= 0) headChildren.splice(index, 1)
        },
      }
      return node
    }
    const canonical = makeNode("LINK")
    canonical.setAttribute("id", "placefind-canonical")
    canonical.setAttribute("rel", "canonical")
    canonical.setAttribute("href", "https://placefind.to/")
    headChildren.push(canonical)
    const document = {
      title: "PlaceFind — Local business directory",
      head: {
        children: headChildren,
        appendChild(node: FakeNode) {
          headChildren.push(node)
          return node
        },
        querySelector(selector: string) {
          if (selector === 'link[rel="canonical"]') {
            return headChildren.find((node) => node.tagName === "LINK" && node.getAttribute("rel") === "canonical") ?? null
          }
          return null
        },
      },
      getElementById(id: string) {
        return headChildren.find((node) => node.id === id) ?? null
      },
      createElement(tag: string) {
        return makeNode(tag.toUpperCase())
      },
    }
    Object.assign(globalThis, { document })

    const cedar = listing({
      id: "listing-cedar",
      slug: "cedar-clay-studio-pottery-studio",
      name: "Cedar & Clay Studio",
      profileHeadHtml: '<link rel="canonical" href="https://shop.example">',
    })
    const restoreCedar = applyListingDocumentHead(cedar, "https://127.0.0.1/listings/listing-cedar")
    assert.equal(canonical.getAttribute("href"), "https://placefind.to/listings/cedar-clay-studio-pottery-studio")
    assert.equal(document.head.querySelector('link[rel="canonical"]'), canonical)
    assert.equal(headChildren.filter((node) => node.getAttribute("rel") === "canonical").length, 1)
    assert.equal(headChildren.some((node) => node.getAttribute("href") === "https://shop.example"), false)

    restoreCedar()
    assert.equal(canonical.getAttribute("href"), "https://placefind.to/")

    const nextListing = listing({
      id: "listing-harbor",
      slug: "harbor-oak-bakery",
      profileHeadHtml: '<link rel="canonical" href="https://placefind.to/listings/harbor-oak-bakery">',
    })
    applyListingDocumentHead(nextListing, "/listings/listing-harbor")
    assert.equal(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href"), "https://placefind.to/listings/harbor-oak-bakery")
    assert.equal(document.head.querySelector('link[rel="canonical"]'), canonical)
    assert.equal(headChildren.filter((node) => node.getAttribute("rel") === "canonical").length, 1)

    delete (globalThis as { document?: unknown }).document
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
