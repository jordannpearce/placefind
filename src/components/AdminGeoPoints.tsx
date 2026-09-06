import { LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { loadAdminGeoPoints, loadSampleGeoPoints, uploadGeoPointsCsv } from "../lib/api.ts"
import type { GeoPointsStatus } from "../lib/types.ts"

function formatWhen(value: string | null) {
  if (!value) return "never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function AdminGeoPoints({
  initial,
  onError,
  onMessage,
}: {
  initial?: GeoPointsStatus | null
  onError: (message: string | null) => void
  onMessage: (message: string | null) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<GeoPointsStatus | null>(initial ?? null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (initial) setStatus(initial)
  }, [initial])

  useEffect(() => {
    if (initial) return
    void loadAdminGeoPoints()
      .then(setStatus)
      .catch((err) => onError(err instanceof Error ? err.message : "Could not load city GPS points."))
  }, [initial, onError])

  async function importCsv(file: File) {
    setBusy(true)
    onError(null)
    try {
      const csv = await file.text()
      const next = await uploadGeoPointsCsv(csv, file.name)
      setStatus(next)
      const skipped = next.skipped ? ` Skipped ${next.skipped} incomplete row${next.skipped === 1 ? "" : "s"}.` : ""
      onMessage(`Imported ${next.pointCount.toLocaleString()} GPS points across ${next.cityCount.toLocaleString()} cities.${skipped}`)
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not import that CSV.")
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">City GPS backup</p>
      <h3 className="mt-1 font-display text-2xl text-paper">US city GPS file</h3>
      <p className="mt-2 text-sm leading-6 text-muted">
        Upload a CSV of GPS points for US cities. Track can use those coordinates as a backup when building a rank
        scan. Required columns: city, state, latitude, and longitude. Aliases such as lat, lng, gps, and coord also
        work. Optional zip and name columns are kept. Rankings still come from Maps — this file only supplies points.
      </p>
      <p className="mt-3 text-sm text-paper/80">
        {status && status.pointCount > 0
          ? `${status.pointCount.toLocaleString()} points · ${status.cityCount.toLocaleString()} cities · last import ${formatWhen(status.importedAt)}${status.fileName ? ` · ${status.fileName}` : ""}`
          : "No city GPS file loaded yet. Upload the full US file, or load the small sample to try the backup."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void importCsv(file)
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {busy ? "Importing…" : "Upload CSV"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            onError(null)
            try {
              const next = await loadSampleGeoPoints()
              setStatus(next)
              onMessage(`Loaded the sample city GPS file: ${next.pointCount.toLocaleString()} points.`)
            } catch (err) {
              onError(err instanceof Error ? err.message : "Could not load the sample file.")
            } finally {
              setBusy(false)
            }
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-paper hover:border-brass disabled:opacity-60"
        >
          Load sample file
        </button>
      </div>
    </section>
  )
}
