export function rankTone(rank: number | null | undefined): "green" | "yellow" | "red" {
  if (rank == null || rank >= 11) return "red"
  if (rank <= 3) return "green"
  return "yellow"
}

export function rankColor(rank: number | null | undefined): string {
  const tone = rankTone(rank)
  if (tone === "green") return "#7dae86"
  if (tone === "yellow") return "#e0b15b"
  return "#d07252"
}

export function rankLabel(rank: number | null | undefined, error?: string): string {
  if (error && rank == null) return "Error"
  if (rank == null) return "Not found"
  return `#${rank}`
}
