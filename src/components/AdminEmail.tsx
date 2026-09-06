import { LoaderCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { sendAdminMail } from "../lib/api.ts"
import type { AuthUser, MailCampaignType, MailPreset, MailStatus, OutboxRow } from "../lib/types.ts"

const FALLBACK_PRESETS: MailPreset[] = [
  {
    type: "welcome",
    label: "Welcome",
    subject: "Welcome to PlaceFind",
    text: "Hi {{first}},\n\nYour PlaceFind account is ready. Sign in to add your business to the directory for $150 per month.\n",
  },
  {
    type: "activation",
    label: "Confirm your listing",
    subject: "Confirm your PlaceFind listing",
    text: "Hi {{first}},\n\nYour PlaceFind account is ready.\n\n1. Sign in and open your account.\n2. Create a listing with your business name, city, and state.\n3. Open Crawl Website to write a public profile article.\n",
  },
  {
    type: "marketing",
    label: "Marketing",
    subject: "Find local businesses in the PlaceFind directory",
    text: "Hi {{first}},\n\nPlaceFind is a web directory for local businesses. Browse listings, or add your own for $150 per month.\n\nSign in when you are ready to publish a profile.\n",
  },
  {
    type: "info",
    label: "Info",
    subject: "A note from PlaceFind",
    text: "Hi {{first}},\n\nA quick note from the PlaceFind team. Sign in to manage your listings and scans.\n\nReply to this email if you need help with your account.\n",
  },
  {
    type: "updates",
    label: "Updates",
    subject: "What's new in PlaceFind",
    text: "Hi {{first}},\n\nPlaceFind is a web directory. Sign in to manage listings, request a website crawl, and read reviews.\n",
  },
]

function formatSentAt(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

type Props = {
  users: AuthUser[]
  outbox: OutboxRow[]
  mail: MailStatus | null
  presets?: MailPreset[]
  onOutbox: (rows: OutboxRow[]) => void
  onError: (message: string | null) => void
  onMessage: (message: string | null) => void
}

export function AdminEmail({ users, outbox, mail, presets, onOutbox, onError, onMessage }: Props) {
  const catalog = useMemo(() => (presets && presets.length > 0 ? presets : FALLBACK_PRESETS), [presets])
  const [type, setType] = useState<MailCampaignType>("welcome")
  const [subject, setSubject] = useState(catalog[0]?.subject ?? "")
  const [body, setBody] = useState(catalog[0]?.text ?? "")
  const [selected, setSelected] = useState<string[]>([])
  const [includeSuspended, setIncludeSuspended] = useState(false)
  const [busy, setBusy] = useState<"selected" | "all" | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)

  useEffect(() => {
    const preset = catalog.find((row) => row.type === type) ?? catalog[0]
    if (!preset) return
    setSubject(preset.subject)
    setBody(preset.text)
  }, [type, catalog])

  const rows = useMemo(
    () => [...users].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [users],
  )
  const eligible = rows.filter((row) => includeSuspended || row.status !== "suspended")
  const eligibleIds = eligible.map((row) => row.id)
  const skippedCount = rows.length - eligible.length
  const selectedEligible = selected.filter((id) => eligibleIds.includes(id))

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  async function send(all: boolean) {
    setBusy(all ? "all" : "selected")
    onError(null)
    onMessage(null)
    try {
      const result = await sendAdminMail({
        type,
        subject,
        text: body,
        userIds: all ? undefined : selectedEligible,
        all,
        includeSuspended,
      })
      onOutbox(result.outbox)
      const skipped = result.skipped > 0 ? ` Skipped ${result.skipped} suspended.` : ""
      onMessage(
        result.delivered > 0
          ? `Sent ${result.delivered} of ${result.sent} emails.${result.held ? ` ${result.held} held.` : ""}${skipped}`
          : `Queued ${result.sent} emails in the outbox.${skipped} Add a sending key to deliver them.`,
      )
      setConfirmAll(false)
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not send email.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Email</p>
      <h2 className="mt-1 font-display text-3xl text-paper">Write and send</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        Choose a type, edit the subject and body, then send to checked users or everyone. Suspended accounts are skipped
        unless you include them. Use {"{{first}}"}, {"{{name}}"}, and {"{{email}}"} to personalize.
      </p>
      {mail && (
        <p className={`mt-3 text-sm ${mail.configured ? "text-moss" : "text-muted"}`}>
          {mail.configured
            ? `Ready to send · ${mail.fromName} <${mail.fromEmail}> · ${mail.keyHint}`
            : `Messages will stay in the outbox until a sending key is saved. From: ${mail.fromName} <${mail.fromEmail}>`}
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[16rem_1fr]">
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Type</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as MailCampaignType)}
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          >
            {catalog.map((preset) => (
              <option key={preset.type} value={preset.type}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Subject</span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          />
        </label>
      </div>
      <label className="mt-3 grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Body</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={8}
          className="rounded-lg border border-line bg-ink px-3 py-3 text-sm leading-6 text-paper outline-none focus:border-brass"
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setSelected(eligibleIds)}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-paper/80 hover:border-brass"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => setSelected([])}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-paper/80 hover:border-brass"
        >
          Select none
        </button>
        <label className="inline-flex items-center gap-2 text-sm text-paper/80">
          <input
            type="checkbox"
            checked={includeSuspended}
            onChange={(event) => setIncludeSuspended(event.target.checked)}
          />
          Include suspended
        </label>
        <span className="text-xs text-muted">
          {selectedEligible.length} selected · {eligible.length} can receive
          {skippedCount > 0 ? ` · ${skippedCount} suspended skipped` : ""}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No users to email yet.</p>
        ) : (
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                <th className="pb-2 pr-3">
                  <input
                    type="checkbox"
                    checked={eligibleIds.length > 0 && eligibleIds.every((id) => selected.includes(id))}
                    onChange={(event) => setSelected(event.target.checked ? eligibleIds : [])}
                    aria-label="Select all users"
                  />
                </th>
                <th className="pb-2 pr-3">Name</th>
                <th className="pb-2 pr-3">Email</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const blocked = row.status === "suspended" && !includeSuspended
                return (
                  <tr key={row.id} className="border-t border-line">
                    <td className="py-3 pr-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        disabled={blocked}
                        onChange={() => toggle(row.id)}
                        aria-label={`Select ${row.email}`}
                      />
                    </td>
                    <td className="py-3 pr-3 text-paper">{row.name}</td>
                    <td className="py-3 pr-3 text-paper">{row.email}</td>
                    <td className={`py-3 ${row.status === "suspended" ? "text-clay" : "text-moss"}`}>
                      {row.status === "suspended" ? "Suspended" : "Active"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy != null || selectedEligible.length === 0 || !subject.trim() || !body.trim()}
          onClick={() => void send(false)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass px-5 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
        >
          {busy === "selected" && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {busy === "selected" ? "Sending…" : `Send to selected (${selectedEligible.length})`}
        </button>
        {confirmAll ? (
          <span className="inline-flex flex-wrap items-center gap-2 text-sm">
            <span className="text-clay">
              Send to all {eligible.length} users{includeSuspended ? ", including suspended" : ""}?
            </span>
            <button
              type="button"
              disabled={busy != null || eligible.length === 0}
              onClick={() => void send(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-clay px-4 font-semibold text-ink disabled:opacity-60"
            >
              {busy === "all" && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {busy === "all" ? "Sending…" : "Confirm send all"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmAll(false)}
              className="h-11 rounded-lg border border-line px-4 text-paper/80"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            disabled={busy != null || eligible.length === 0 || !subject.trim() || !body.trim()}
            onClick={() => setConfirmAll(true)}
            className="h-11 rounded-lg border border-brass px-5 text-sm font-semibold text-brass hover:bg-brass/10 disabled:opacity-60"
          >
            Send to all
          </button>
        )}
      </div>

      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Last outbox</p>
        {outbox.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No messages yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {outbox.slice(0, 20).map((row) => (
              <li key={row.id} className="rounded-xl border border-line bg-ink px-4 py-3">
                <p className="text-sm text-paper">{row.subject}</p>
                <p className="text-xs text-muted">
                  {row.to} · {row.delivered ? "Delivered" : "Held"}
                  {row.createdAt ? ` · ${formatSentAt(row.createdAt)}` : ""}
                  {row.detail ? ` · ${row.detail}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
