import { useEffect, useState } from "react"
import { loadAdmin, saveMail, testMail } from "../lib/api.ts"
import type { AuthUser, DirectoryListing, GeoPointsStatus, HostedKeyStatus, MailPreset, MailStatus, OutboxRow } from "../lib/types.ts"
import { AdminEmail } from "./AdminEmail.tsx"
import { AdminGeoPoints } from "./AdminGeoPoints.tsx"
import { AdminListings } from "./AdminListings.tsx"
import { AdminUsers } from "./AdminUsers.tsx"
import { MapsSearchPanel } from "./MapsSearchPanel.tsx"

export function AdminPage({
  currentUserId,
  onViewAs,
  onGo,
}: {
  currentUserId?: string
  onViewAs: (user: AuthUser) => void
  onGo: (path: string) => void
}) {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [listings, setListings] = useState<DirectoryListing[]>([])
  const [outbox, setOutbox] = useState<OutboxRow[]>([])
  const [mailPresets, setMailPresets] = useState<MailPreset[]>([])
  const [mail, setMail] = useState<MailStatus | null>(null)
  const [hosted, setHosted] = useState<HostedKeyStatus | null>(null)
  const [geoPoints, setGeoPoints] = useState<GeoPointsStatus | null>(null)
  const [fromEmail, setFromEmail] = useState("")
  const [fromName, setFromName] = useState("")
  const [mailKey, setMailKey] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function refresh() {
    const admin = await loadAdmin()
    setUsers(admin.users)
    setListings(admin.listings ?? [])
    setOutbox(admin.outbox)
    setMailPresets(
      (admin.mailPresets ?? []).flatMap((row) => {
        const type = row.type as MailPreset["type"]
        if (!["welcome", "activation", "marketing", "info", "updates"].includes(type)) return []
        return [{ type, label: row.label, subject: row.subject, text: row.text }]
      }),
    )
    setMail(admin.mail)
    setHosted(admin.hosted ?? null)
    setGeoPoints(admin.geoPoints ?? null)
    setFromEmail(admin.mail.fromEmail)
    setFromName(admin.mail.fromName)
  }

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : "Could not load admin."))
  }, [])

  return (
    <div className="grid gap-6">
      {error && <p className="rounded-xl border border-clay/40 bg-clay/10 px-4 py-3 text-sm text-clay">{error}</p>}
      {message && <p className="rounded-xl border border-moss/40 bg-moss/10 px-4 py-3 text-sm text-moss">{message}</p>}
      <AdminUsers
        users={users}
        listings={listings}
        currentUserId={currentUserId}
        onUsers={setUsers}
        onListings={setListings}
        onError={setError}
        onMessage={setMessage}
        onViewAs={onViewAs}
      />

      <AdminListings listings={listings} onListings={setListings} onError={setError} onMessage={setMessage} onGo={onGo} />

      <AdminEmail
        users={users}
        outbox={outbox}
        mail={mail}
        presets={mailPresets}
        onOutbox={setOutbox}
        onError={setError}
        onMessage={setMessage}
      />

      <MapsSearchPanel hosted={hosted} onHosted={setHosted} onError={setError} onMessage={setMessage} />

      <AdminGeoPoints initial={geoPoints} onError={setError} onMessage={setMessage} />

      <section className="rounded-2xl border border-line bg-panel p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Transactional email</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Save mail settings so welcome and password-reset messages can leave this server. Until then, messages stay
          in the outbox on this computer.
        </p>
        {mail?.configured && (
          <p className="mt-2 text-sm text-moss">
            Connected · {mail.keyHint} · {mail.fromEmail}
          </p>
        )}
        <label className="mt-4 grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Mail key</span>
          <input
            type="password"
            value={mailKey}
            onChange={(event) => setMailKey(event.target.value)}
            placeholder={mail?.keyHint || "Paste the outbound mail key"}
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          />
        </label>
        <label className="mt-3 grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">From name</span>
          <input
            value={fromName}
            onChange={(event) => setFromName(event.target.value)}
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          />
        </label>
        <label className="mt-3 grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">From email</span>
          <input
            value={fromEmail}
            onChange={(event) => setFromEmail(event.target.value)}
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={async () => {
              setError(null)
              try {
                const result = await testMail({ resendApiKey: mailKey, fromEmail, fromName })
                setMessage(result.message)
                if (!result.ok) setError(result.message)
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not test mail.")
              }
            }}
            className="h-11 rounded-lg border border-brass text-sm font-semibold text-brass hover:bg-brass/10"
          >
            Test mail
          </button>
          <button
            type="button"
            onClick={async () => {
              setError(null)
              try {
                setMail(await saveMail({ resendApiKey: mailKey, fromEmail, fromName }))
                setMailKey("")
                setMessage("Mail settings saved.")
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not save mail settings.")
              }
            }}
            className="h-11 rounded-lg bg-brass text-sm font-semibold text-ink hover:bg-[#ecc77a]"
          >
            Save mail
          </button>
        </div>
      </section>
    </div>
  )
}
