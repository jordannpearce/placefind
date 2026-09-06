import { useEffect, useState } from "react"
import { checkoutOrder, loadStore, login, signup } from "../lib/api.ts"
import type { AuthUser, IssuedLicense, OrderInfo, ProductInfo } from "../lib/types.ts"

type Props = {
  user: AuthUser | null
  onAuthed: (user: AuthUser) => void
  onTryScan?: () => void
}

export function BuyPage({ user, onAuthed, onTryScan }: Props) {
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [license, setLicense] = useState<IssuedLicense | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    void loadStore()
      .then((store) => setProduct(store.product))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the product."))
  }, [])

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
    }
  }, [user])

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <section className="rounded-2xl border border-line bg-panel p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Buy a license</p>
        <h2 className="mt-2 font-display text-4xl text-paper">{product?.name ?? "PlaceFind"}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">{product?.pitch}</p>
        <p className="mt-4 font-display text-3xl text-brass">${product?.price ?? "49"}</p>
        <p className="mt-1 text-xs text-muted">
          One Windows license. Paying creates your account, emails the key, and unlocks the desktop app. There is no
          separate Join step.
        </p>
        {onTryScan && (
          <button
            type="button"
            onClick={onTryScan}
            className="mt-5 inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
          >
            Run a test scan
          </button>
        )}

        {order ? (
          <div className="mt-6 rounded-xl border border-line bg-ink px-4 py-4">
            <p className="text-sm text-moss">Order {order.id} is recorded.</p>
            {license ? (
              <>
                <p className="mt-2 text-sm text-paper">Your license key</p>
                <p className="mt-1 break-all font-mono text-sm text-brass">{license.key}</p>
                <p className="mt-3 text-sm text-muted">Install PlaceFind, then paste this key when the app asks you to unlock.</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {warning || "Your payment is in. Your license key will appear here and on your account page once it is issued."}
              </p>
            )}
          </div>
        ) : (
          <form
            className="mt-6 grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault()
              setBusy(true)
              setError(null)
              try {
                let current = user
                if (!current) {
                  try {
                    current = await signup({ name, email, password })
                  } catch {
                    current = await login({ email, password })
                  }
                  onAuthed(current)
                }
                const result = await checkoutOrder()
                setOrder(result.order)
                setLicense(result.license)
                setWarning(result.warning ?? null)
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not complete the purchase.")
              } finally {
                setBusy(false)
              }
            }}
          >
            {!user && (
              <>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
                  />
                </label>
              </>
            )}
            {user && <p className="text-sm text-muted">Buying as {user.email}</p>}
            {error && <p className="text-sm text-clay">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="h-12 rounded-lg bg-brass font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
            >
              {busy ? "Placing order…" : user ? `Pay $${product?.price ?? "49"} and get a key` : `Pay $${product?.price ?? "49"} and create my account`}
            </button>
            <p className="text-xs text-muted">
              Checkout creates your PlaceFind account if you do not have one yet. After you pay, the license key
              appears here and on your account page.
            </p>
          </form>
        )}
      </section>
    </div>
  )
}
