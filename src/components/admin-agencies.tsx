"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Agency } from "@/lib/types"

type Row = Agency & { userCount: number }

export function AdminAgencies({ agencies }: { agencies: Row[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(agencies)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function create(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = (await response.json()) as { error?: string; agency?: Row }
      if (!response.ok) throw new Error(data.error || "Could not create agency")
      if (data.agency && !rows.some((row) => row.id === data.agency!.id)) {
        setRows((current) => [...current, data.agency!])
      }
      setName("")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create agency")
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-heading text-2xl">Agencies</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Group accounts by agency. Creating a user with a new agency name adds it here.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No agencies yet.</p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {rows.map((agency) => (
            <div key={agency.id} className="rounded-xl border px-3 py-2">
              <p className="font-medium">{agency.name}</p>
              <p className="text-xs text-muted-foreground">
                {agency.userCount} account{agency.userCount === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      )}
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={create}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New agency name"
          required
        />
        <Button type="submit" disabled={pending || name.trim().length < 2}>
          {pending ? "Adding…" : "Add agency"}
        </Button>
      </form>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </section>
  )
}
