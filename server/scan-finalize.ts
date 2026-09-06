export type PinScanStatus = "rank" | "not_found" | "error"

export type FinalizePin = {
  rank: number | null
  scannedAt: string
  error?: string
  status?: PinScanStatus | "pending" | "unset"
}

export function pinScanStatus(rank: number | null | undefined, error?: string | null): PinScanStatus {
  if (error && /no search results/i.test(error)) return "not_found"
  if (error && (rank == null || !Number.isFinite(rank))) return "error"
  if (rank != null && Number.isFinite(rank) && rank >= 1) return "rank"
  return "not_found"
}

/** After a scan finishes, every pin is rank, not_found, or error — never pending/unset. */
export function finalizeGridPointResults<T extends FinalizePin>(
  points: T[],
  scannedAt = new Date().toISOString(),
): Array<T & { status: PinScanStatus }> {
  return points.map((point) => {
    const status = pinScanStatus(point.rank, point.error)
    return {
      ...point,
      status,
      rank: status === "rank" ? point.rank : null,
      scannedAt: point.scannedAt || scannedAt,
      error: status === "error" ? point.error || "Maps search could not finish this point." : undefined,
    }
  })
}
