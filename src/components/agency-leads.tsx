"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import type { AgencyLead } from "@/lib/leads"

type Payload = {
  leads: AgencyLead[]
  agencyName: string
}

const STATUS_LABEL: Record<AgencyLead["status"], string> = {
  new: "New",
  assigned: "Assigned",
  invoiced: "Invoiced",
  paid: "Paid",
}

function formatWhen(value: string | null) {
  if (!value) return "—"
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  return new Date(parsed).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function money(value: number | null) {
  if (value == null) return "—"
  return `$${value.toFixed(2)}`
}

export function AgencyLeads({ initial }: { initial: Payload }) {
  const [payload] = useState(initial)
  const [selectedId, setSelectedId] = useState(initial.leads[0]?.id || "")
  const selected = useMemo(
    () => payload.leads.find((lead) => lead.id === selectedId) ?? payload.leads[0] ?? null,
    [payload.leads, selectedId]
  )

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div>
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          {payload.agencyName}
        </p>
        <h1 className="font-heading text-4xl tracking-tight">Leads</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Get Found leads assigned to this agency — the same ones emailed when GridPins sends the
          invoice. Open a row for contact details, listing notes, and the invoice link.
        </p>
      </div>

      {payload.leads.length === 0 ? (
        <div className="rounded-2xl border bg-card px-4 py-10 text-sm text-muted-foreground">
          No leads have been assigned to this agency yet. When a Get Found lead is emailed to you,
          it appears here.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-3">
            <ul className="space-y-3">
              {payload.leads.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(lead.id)}
                    className={`w-full rounded-2xl border p-4 text-left ${
                      selected?.id === lead.id ? "border-foreground bg-card" : "bg-background"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{lead.businessName || "Untitled business"}</p>
                      <Badge variant="secondary">{STATUS_LABEL[lead.status]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {lead.name} · {lead.city}, {lead.state}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {lead.emailedToViewer ? "Emailed to you" : `Emailed to ${lead.assignedToName || "the agency"}`}{" "}
                      · {formatWhen(lead.assignedAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selected ? (
            <article className="space-y-4 rounded-2xl border bg-card p-5">
              <div>
                <h2 className="font-heading text-3xl">{selected.businessName || "Untitled business"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {STATUS_LABEL[selected.status]}
                  {selected.leadPrice != null ? ` · ${money(selected.leadPrice)}` : ""}
                </p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Fact label="Contact" value={selected.name} />
                <Fact label="Email" value={selected.email} href={selected.email ? `mailto:${selected.email}` : undefined} />
                <Fact label="Phone" value={selected.phone} href={selected.phone ? `tel:${selected.phone}` : undefined} />
                <Fact
                  label="Website"
                  value={selected.website || "Not provided"}
                  href={selected.website || undefined}
                />
                <Fact label="GBP listing" value={selected.gbpListing || "Not provided"} />
                <Fact label="Category" value={selected.primaryCategory || "Not provided"} />
                <Fact label="Keyword" value={selected.keyword || "Not provided"} />
                <Fact label="Locations" value={selected.locationCount || "Not provided"} />
                <Fact label="City" value={selected.city} />
                <Fact label="State" value={selected.state} />
                <Fact
                  label="Assigned to"
                  value={
                    selected.assignedToCompany || selected.assignedToName
                      ? `${selected.assignedToCompany || selected.assignedToName}${
                          selected.assignedToEmail ? ` · ${selected.assignedToEmail}` : ""
                        }`
                      : "This agency"
                  }
                />
                <Fact label="Emailed" value={formatWhen(selected.assignedAt)} />
              </dl>
              {selected.comments ? (
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Notes</p>
                  <p className="mt-1 text-sm leading-6">{selected.comments}</p>
                </div>
              ) : null}
              {selected.paddleInvoiceUrl ? (
                <a
                  href={selected.paddleInvoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ size: "lg" })}
                >
                  Open invoice
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {selected.invoiceDryRun
                    ? "This assignment was recorded without a live invoice."
                    : "No invoice link on this lead yet."}
                </p>
              )}
            </article>
          ) : null}
        </div>
      )}
    </div>
  )
}

function Fact({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 break-words">
        {href ? (
          <a className="text-primary hover:underline" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}
