"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { US_STATES } from "@/lib/storage"

export function UsStateSelect({
  id,
  value,
  onChange,
  required,
  disabled,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
}) {
  return (
    <Select
      value={value || null}
      onValueChange={(next) => onChange(next ?? "")}
      required={required}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="State" />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="max-h-72">
        {US_STATES.map((state) => (
          <SelectItem key={state.abbr} value={state.abbr}>
            {state.abbr} — {state.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
