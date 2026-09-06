import { useEffect, useState } from "react"
import { loadAccount, logout } from "../lib/api.ts"
import type { AuthUser, OrderInfo, ProductInfo } from "../lib/types.ts"

type Props = {
  user: AuthUser
  desktop?: boolean
  onLogout: () => void
  onBuy?: () => void
}

export function AccountPage({ user, desktop, onLogout, onBuy }: Props) {
  const [orders, setOrders] = useState<OrderInfo[]>([])
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadAccount()
      .then((account) => {
        setOrders(account.orders)
        setProduct(account.product)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your account."))
  }, [])

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <section className="rounded-2xl border border-line bg-panel p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Your account</p>
        <h2 className="mt-2 font-display text-3xl text-paper">{user.name}</h2>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {!desktop && onBuy && (
            <button type="button" onClick={onBuy} className="h-11 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a]">
              Buy a license
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              await logout()
              onLogout()
            }}
            className="h-11 rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
          >
            Sign out
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">License keys</p>
        {error && <p className="mt-3 text-sm text-clay">{error}</p>}
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {desktop
              ? "No license is attached to this account yet. Buy PlaceFind on the website, then sign in here again."
              : `No licenses yet. Buy ${product?.name ?? "PlaceFind"} to get a license key.`}
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {orders.map((order) => (
              <li key={order.id} className="rounded-xl border border-line bg-ink px-4 py-3">
                <p className="text-sm text-paper">
                  ${order.amount} · {order.status === "paid" ? "License ready" : "Waiting for a key"}
                </p>
                {order.licenseKey ? (
                  <p className="mt-1 break-all font-mono text-sm text-brass">{order.licenseKey}</p>
                ) : (
                  <p className="mt-1 text-sm text-muted">Your license key will appear here once it is issued.</p>
                )}
                <p className="mt-1 text-xs text-muted">{new Date(order.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
