import { ChevronDown } from "lucide-react"
import { US_STATES } from "../lib/states.ts"

type Props = {
  city: string
  state: string
  onCity: (city: string) => void
  onState: (state: string) => void
  fieldClassName: string
  disabled?: boolean
}

export function CityStateFields({ city, state, onCity, onState, fieldClassName, disabled }: Props) {
  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,7.5rem)]">
      <label className="grid min-w-0 gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">City</span>
        <input
          value={city}
          onChange={(event) => onCity(event.target.value)}
          placeholder="Austin"
          autoComplete="off"
          disabled={disabled}
          className={`box-border w-full min-w-0 ${fieldClassName}${disabled ? " opacity-70" : ""}`}
        />
      </label>
      <label className="grid min-w-0 gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">State</span>
        <span className="relative block min-w-0">
          <select
            value={state}
            onChange={(event) => onState(event.target.value)}
            disabled={disabled}
            className={`box-border w-full min-w-0 appearance-none pr-9 ${fieldClassName}${disabled ? " opacity-70" : ""}`}
          >
            <option value="">Select</option>
            {US_STATES.map((row) => (
              <option key={row.abbr} value={row.abbr}>
                {row.abbr}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper"
          />
        </span>
      </label>
    </div>
  )
}
