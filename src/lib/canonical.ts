import { DEFAULT_PUBLIC_SITE_URL } from "../../server/runtime.ts"

export { DEFAULT_PUBLIC_SITE_URL }

export const CANONICAL_LINK_ID = "placefind-canonical"

export function publicCanonicalOrigin(origin?: string | null): string {
  const raw = origin?.trim()
  if (raw) return raw.replace(/\/+$/, "")
  return DEFAULT_PUBLIC_SITE_URL
}

export function canonicalPath(pathOrUrl: string): string {
  const raw = pathOrUrl.trim()
  if (!raw) return "/"
  let pathname = raw
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      pathname = new URL(raw).pathname
    } else {
      pathname = raw.split(/[?#]/, 1)[0] ?? raw
    }
  } catch {
    pathname = raw.split(/[?#]/, 1)[0] ?? raw
  }
  if (!pathname.startsWith("/")) pathname = `/${pathname}`
  pathname = pathname.replace(/\/{2,}/g, "/")
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "")
  return pathname || "/"
}

export function canonicalUrl(pathOrUrl: string, origin?: string | null): string {
  return `${publicCanonicalOrigin(origin)}${canonicalPath(pathOrUrl)}`
}

export function upsertHtmlCanonical(html: string, href: string): string {
  const tag = `<link id="${CANONICAL_LINK_ID}" rel="canonical" href="${escapeCanonicalAttr(href)}">`
  const byId = new RegExp(`<link\\b[^>]*\\bid=["']${CANONICAL_LINK_ID}["'][^>]*>`, "i")
  let next = html
  if (byId.test(next)) next = next.replace(byId, tag)
  else {
    const byRel = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i
    if (byRel.test(next)) next = next.replace(byRel, tag)
    else next = next.replace(/<\/head>/i, `    ${tag}\n  </head>`)
  }
  return next.replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi, (match) =>
    match.includes(`id="${CANONICAL_LINK_ID}"`) || match.includes(`id='${CANONICAL_LINK_ID}'`) ? match : "",
  )
}

export function applyDocumentHtmlCanonical(html: string, pathOrUrl: string, origin?: string | null): string {
  return upsertHtmlCanonical(html, canonicalUrl(pathOrUrl, origin))
}

export function isCanonicalLinkElement(node: { tagName?: string; getAttribute?: (name: string) => string | null }): boolean {
  if ((node.tagName ?? "").toLowerCase() !== "link") return false
  const rel = node.getAttribute?.("rel") ?? ""
  return rel.split(/\s+/).some((part) => part.toLowerCase() === "canonical")
}

export function applyDocumentCanonical(pathOrUrl: string, origin?: string | null): () => void {
  if (typeof document === "undefined") return () => undefined
  const href = canonicalUrl(pathOrUrl, origin)
  const existing =
    document.getElementById(CANONICAL_LINK_ID) ?? document.head.querySelector('link[rel="canonical"]')
  if (existing) {
    const previousHref = existing.getAttribute("href")
    const previousId = existing.getAttribute("id")
    existing.setAttribute("rel", "canonical")
    existing.setAttribute("href", href)
    if (!previousId) existing.setAttribute("id", CANONICAL_LINK_ID)
    return () => {
      if (previousHref == null) existing.removeAttribute("href")
      else existing.setAttribute("href", previousHref)
      if (!previousId) existing.removeAttribute("id")
    }
  }
  const link = document.createElement("link")
  link.setAttribute("id", CANONICAL_LINK_ID)
  link.setAttribute("rel", "canonical")
  link.setAttribute("href", href)
  document.head.appendChild(link)
  return () => link.remove()
}

function escapeCanonicalAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
}
