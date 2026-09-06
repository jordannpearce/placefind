import { LoaderCircle, Search } from "lucide-react"
import { US_STATES } from "../lib/states.ts"
import type { HistoryItem, SearchQuery } from "../lib/types.ts"

const SAMPLES: SearchQuery[] = [
  { name: "Franklin Barbecue", city: "Austin", state: "TX" },
  { name: "Joe's Pizza", city: "New York", state: "NY" },
  { name: "Pike Place Fish", city: "Seattle", state: "WA" },
]

type Props = {
  query: SearchQuery
  onChange: (query: SearchQuery) => void
  onSearch: () => void
  loading: boolean
  history: HistoryItem[]
  onHistory: (item: HistoryItem) => void
}

export function SearchForm({ query, onChange, onSearch, loading, history, onHistory }: Props) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSearch()
      }}
    >
      <label className="grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Business name</span>
        <input
          value={query.name}
          onChange={(event) => onChange({ ...query, name: event.target.value })}
          placeholder="Franklin Barbecue"
          autoComplete="off"
          className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none ring-brass/40 placeholder:text-muted/50 focus:border-brass focus:ring-2"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7.5rem]">
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">City</span>
          <input
            value={query.city}
            onChange={(event) => onChange({ ...query, city: event.target.value })}
            placeholder="Austin"
            autoComplete="off"
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none ring-brass/40 placeholder:text-muted/50 focus:border-brass focus:ring-2"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">State</span>
          <select
            value={query.state}
            onChange={(event) => onChange({ ...query, state: event.target.value })}
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none ring-brass/40 focus:border-brass focus:ring-2"
          >
            <option value="">Select</option>
            {US_STATES.map((state) => (
              <option key={state.abbr} value={state.abbr}>
                {state.abbr}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass font-semibold text-ink transition hover:bg-[#ecc77a] disabled:cursor-wait disabled:opacity-70"
      >
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {loading ? "Searching Maps…" : "Find listing"}
      </button>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Try a sample</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample.name}
              type="button"
              onClick={() => onChange(sample)}
              className="rounded-full border border-line px-3 py-1 text-xs text-paper/80 transition hover:border-brass hover:text-brass"
            >
              {sample.name}
            </button>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Recent</p>
          <ul className="grid gap-1">
            {history.slice(0, 6).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onHistory(item)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm text-paper/80 hover:bg-raised"
                >
                  <span className="block truncate">{item.title || item.name}</span>
                  <span className="text-xs text-muted">
                    {item.city}, {item.state}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  )
}
