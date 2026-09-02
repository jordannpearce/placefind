export type RankTone = {
  fill: string
  text: string
  label: string
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "")
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`
}

function mix(from: string, to: string, amount: number): string {
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  const t = Math.min(1, Math.max(0, amount))
  return rgbToHex([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ])
}

function contrastText(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luma > 0.65 ? "#1a1a1a" : "#ffffff"
}

export function rankFill(rank: number): string {
  if (rank <= 3) {
    const greens = ["#166534", "#22c55e", "#86efac"]
    return greens[rank - 1]
  }
  if (rank <= 10) {
    return mix("#facc15", "#ea580c", (rank - 4) / 6)
  }
  if (rank <= 14) {
    return mix("#ea580c", "#f97316", (rank - 10) / 4)
  }
  if (rank <= 20) {
    return mix("#ea580c", "#b91c1c", (rank - 15) / 5)
  }
  return "#7f1d1d"
}

export function rankTone(rank: number | null | undefined, error?: string | null): RankTone {
  if (error) {
    return { fill: "#64748b", text: "#ffffff", label: "Error" }
  }
  if (rank == null) {
    return { fill: "#94a3b8", text: "#0f172a", label: "Not found" }
  }
  const fill = rankFill(rank)
  if (rank <= 3) {
    return { fill, text: contrastText(fill), label: "Local pack" }
  }
  if (rank <= 10) {
    return { fill, text: contrastText(fill), label: rank <= 6 ? "Strong" : "Page one" }
  }
  if (rank <= 14) {
    return { fill, text: contrastText(fill), label: "Mid pack" }
  }
  return { fill, text: contrastText(fill), label: rank <= 20 ? "Weak" : "Buried" }
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

export function formatReviews(count: number | null | undefined): string {
  if (count == null) return "No review count"
  if (count === 0) return "0 reviews"
  return `${count.toLocaleString("en-US")} review${count === 1 ? "" : "s"}`
}
