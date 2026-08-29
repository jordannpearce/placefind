export type RankTone = {
  fill: string
  text: string
  label: string
}

export function rankTone(rank: number | null | undefined, error?: string | null): RankTone {
  if (error) {
    return { fill: "#64748b", text: "#ffffff", label: "Error" }
  }
  if (rank == null) {
    return { fill: "#94a3b8", text: "#0f172a", label: "Not found" }
  }
  if (rank <= 3) {
    return { fill: "#16a34a", text: "#ffffff", label: "Local pack" }
  }
  if (rank <= 6) {
    return { fill: "#65a30d", text: "#ffffff", label: "Strong" }
  }
  if (rank <= 10) {
    return { fill: "#ca8a04", text: "#ffffff", label: "Page one" }
  }
  if (rank <= 15) {
    return { fill: "#ea580c", text: "#ffffff", label: "Buried" }
  }
  return { fill: "#dc2626", text: "#ffffff", label: "Weak" }
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function namesMatch(listingTitle: string, target: string): boolean {
  const listing = normalizeName(listingTitle)
  const query = normalizeName(target)
  if (!listing || !query) return false
  if (listing === query) return true
  if (listing.includes(query) || query.includes(listing)) return true

  const listingTokens = new Set(listing.split(" ").filter((t) => t.length > 2))
  const queryTokens = query.split(" ").filter((t) => t.length > 2)
  if (queryTokens.length === 0) return false
  const overlap = queryTokens.filter((token) => listingTokens.has(token)).length
  return overlap / queryTokens.length >= 0.7
}

export function rankLabel(rank: number | null, error?: string | null): string {
  if (error) return "!"
  if (rank == null) return "—"
  return String(rank)
}
