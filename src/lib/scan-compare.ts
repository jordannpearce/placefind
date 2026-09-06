import type { GridPointResult, GridScanRun, RankChange, ScanCompare, ScanComparePin } from "./types.ts"

export function pinKey(point: Pick<GridPointResult, "row" | "col"> & { keyword?: string }): string {
  const keyword = (point.keyword || "").trim().toLowerCase()
  return keyword ? `${point.row}:${point.col}:${keyword}` : `${point.row}:${point.col}`
}

export function rankChange(previous: number | null | undefined, current: number | null | undefined): RankChange {
  const before = previous == null ? null : previous
  const after = current == null ? null : current
  if (before == null && after == null) return "same"
  if (before == null && after != null) return "new"
  if (before != null && after == null) return "lost"
  if (after! < before!) return "up"
  if (after! > before!) return "down"
  return "same"
}

export function rankChangeLabel(change: RankChange): string {
  if (change === "up") return "Improved"
  if (change === "down") return "Worse"
  if (change === "new") return "New"
  if (change === "lost") return "Lost"
  return "Same"
}

export function rankChangeColor(change: RankChange): string {
  if (change === "up" || change === "new") return "#2f6b3d"
  if (change === "down" || change === "lost") return "#c5362b"
  return "#b4a793"
}

export function compareScanRuns(previous: GridScanRun, current: GridScanRun): ScanCompare {
  const before = new Map(previous.points.map((point) => [pinKey(point), point]))
  const after = new Map(current.points.map((point) => [pinKey(point), point]))
  const keys = new Set([...before.keys(), ...after.keys()])
  const pins: ScanComparePin[] = []
  for (const key of [...keys].sort()) {
    const left = before.get(key)
    const right = after.get(key)
    const row = right?.row ?? left?.row ?? 0
    const col = right?.col ?? left?.col ?? 0
    pins.push({
      row,
      col,
      keyword: right?.keyword || left?.keyword || "",
      lat: right?.lat ?? left?.lat ?? 0,
      lng: right?.lng ?? left?.lng ?? 0,
      previousRank: left?.rank ?? null,
      currentRank: right?.rank ?? null,
      change: rankChange(left?.rank, right?.rank),
    })
  }
  return {
    previous,
    current,
    pins,
    improved: pins.filter((pin) => pin.change === "up").length,
    worse: pins.filter((pin) => pin.change === "down").length,
    same: pins.filter((pin) => pin.change === "same").length,
    added: pins.filter((pin) => pin.change === "new").length,
    lost: pins.filter((pin) => pin.change === "lost").length,
  }
}

export function pointsWithCompare(current: GridScanRun, compare: ScanCompare | null): GridPointResult[] {
  if (!compare) return current.points
  const byKey = new Map(compare.pins.map((pin) => [pinKey(pin), pin]))
  return current.points.map((point) => {
    const pin = byKey.get(pinKey(point))
    if (!pin) return point
    return { ...point, change: pin.change, previousRank: pin.previousRank }
  })
}
