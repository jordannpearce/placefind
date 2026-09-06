import { Check, Copy, LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { adminIssueLicense, loadAdmin, saveMail, testMail } from "../lib/api.ts"
import type { AuthUser, HostedKeyStatus, IssuedLicense, MailStatus, OrderInfo } from "../lib/types.ts"
import { AdminUsers } from "./AdminUsers.tsx"
import { MapsSearchPanel } from "./MapsSearchPanel.tsx"

export function AdminPage({ currentUserId }: { currentUserId?: string }) {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [orders, setOrders] = useState<OrderInfo[]>([])
  const [issued, setIssued] = useState<IssuedLicense[]>([])
  const [outbox, setOutbox] = useState<Array<{ id: string; to: string; subject: string; delivered: boolean; detail: string }>>([])
  const [mail, setMail] = useState<MailStatus | null>(null)
  const [hosted, setHosted] = useState<HostedKeyStatus | null>(null)
  const [shop, setShop] = useState({ orderCount: 0, paidCount: 0, pendingCount: 0 })
  const [keygenReady, setKeygenReady] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [sendEmail, setSendEmail] = useState(true)
  const [resendKey, setResendKey] = useState("")
  const [fromEmail, setFromEmail] = useState("")
  const [fromName, setFromName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState("")
  const [latest, setLatest] = useState<IssuedLicense | null>(null)

  async function refresh() {
    const admin = await loadAdmin()
    setUsers(admin.users)
    setOrders(admin.orders)
    setIssued(admin.issued)
    setOutbox(admin.outbox)
    setMail(admin.mail)
    setHosted(admin.hosted ?? null)
    setShop(admin.shop)
    setKeygenReady(admin.keygen.canIssue)
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
        currentUserId={currentUserId}
        onUsers={setUsers}
        onError={setError}
        onMessage={setMessage}
      />

      <MapsSearchPanel
        hosted={hosted}
        onHosted={setHosted}
        onError={setError}
        onMessage={setMessage}
      />

      <section className="rounded-2xl border border-line bg-panel p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Admin</p>
        <h2 className="mt-1 font-display text-3xl text-paper">Licenses and email</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Issue a Keygen license for a buyer and email the key with Resend. {shop.orderCount} orders · {shop.paidCount}{" "}
          keyed · {shop.pendingCount} waiting.
        </p>
        {!keygenReady && (
          <p className="mt-3 text-sm text-clay">Connect Keygen on the Sell page before issuing keys.</p>
        )}
        {error && <p className="mt-3 text-sm text-clay">{error}</p>}
        {message && <p className="mt-3 text-sm text-moss">{message}</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Issue a license</p>
          <label className="mt-4 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Buyer name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <label className="mt-3 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Buyer email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-paper/80">
            <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} />
            Email the key with Resend
          </label>
          <button
            type="button"
            disabled={busy || !email}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                const result = await adminIssueLicense({ name, email, sendEmail })
                setLatest(result.license)
                setName("")
                setEmail("")
                setMessage(sendEmail ? "License created and queued for email." : "License created.")
                await refresh()
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not issue a license.")
              } finally {
                setBusy(false)
              }
            }}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brass font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {busy ? "Issuing…" : "Issue Keygen license"}
          </button>
          {latest && (
            <p className="mt-3 break-all font-mono text-sm text-brass">{latest.key}</p>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Resend email</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Paste a Resend API key to send welcome and license emails. Until then, messages stay in the outbox on this
            computer.
          </p>
          {mail?.configured && <p className="mt-2 text-sm text-moss">Connected · {mail.keyHint} · {mail.fromEmail}</p>}
          <label className="mt-4 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Resend API key</span>
            <input
              type="password"
              value={resendKey}
              onChange={(event) => setResendKey(event.target.value)}
              placeholder={mail?.keyHint || "re_…"}
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
              placeholder="onboarding@resend.dev"
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={async () => {
                setError(null)
                try {
                  const result = await testMail({ resendApiKey: resendKey, fromEmail, fromName })
                  setMessage(result.message)
                  if (!result.ok) setError(result.message)
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not reach Resend.")
                }
              }}
              className="h-11 rounded-lg border border-brass text-sm font-semibold text-brass hover:bg-brass/10"
            >
              Test Resend
            </button>
            <button
              type="button"
              onClick={async () => {
                setError(null)
                try {
                  setMail(await saveMail({ resendApiKey: resendKey, fromEmail, fromName }))
                  setResendKey("")
                  setMessage("Resend settings saved.")
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not save Resend.")
                }
              }}
              className="h-11 rounded-lg bg-brass text-sm font-semibold text-ink hover:bg-[#ecc77a]"
            >
              Save Resend
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-panel p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Orders and keys</p>
        {orders.length === 0 && issued.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No purchases or issued keys yet.</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink px-4 py-3">
                <div>
                  <p className="text-sm text-paper">
                    {order.name} · ${order.amount} · {order.status === "paid" ? "keyed" : "waiting"}
                  </p>
                  <p className="text-xs text-muted">{order.email}</p>
                  {order.licenseKey && <p className="mt-1 break-all font-mono text-xs text-paper/80">{order.licenseKey}</p>}
                </div>
                {order.licenseKey && (
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(order.licenseKey ?? "")
                      setCopied(order.id)
                    }}
                    className="inline-flex items-center gap-1 text-sm text-brass hover:underline"
                  >
                    {copied === order.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === order.id ? "Copied" : "Copy"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {outbox.length > 0 && (
        <section className="rounded-2xl border border-line bg-panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Email outbox</p>
          <ul className="mt-4 grid gap-2">
            {outbox.map((row) => (
              <li key={row.id} className="rounded-xl border border-line bg-ink px-4 py-3">
                <p className="text-sm text-paper">{row.subject}</p>
                <p className="text-xs text-muted">
                  {row.to} · {row.delivered ? "Sent" : "Held"} · {row.detail}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
