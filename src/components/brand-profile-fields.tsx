"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { UsStateSelect } from "@/components/us-state-select"

export type BrandProfileDraft = {
  name: string
  street: string
  city: string
  state: string
  zip: string
  phone: string
  website: string
  competitors: string
}

export const emptyBrandProfileDraft: BrandProfileDraft = {
  name: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  website: "",
  competitors: "",
}

export function BrandProfileFields({
  idPrefix,
  values,
  onChange,
  disabled,
}: {
  idPrefix: string
  values: BrandProfileDraft
  onChange: (next: BrandProfileDraft) => void
  disabled?: boolean
}) {
  function setField<K extends keyof BrandProfileDraft>(key: K, value: BrandProfileDraft[K]) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Company name</Label>
        <Input
          id={`${idPrefix}-name`}
          name={`${idPrefix}-name`}
          value={values.name}
          disabled={disabled}
          onChange={(event) => setField("name", event.target.value)}
          placeholder="Acme Plumbing"
          autoComplete="organization"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-website`}>Website</Label>
        <Input
          id={`${idPrefix}-website`}
          name={`${idPrefix}-website`}
          value={values.website}
          disabled={disabled}
          onChange={(event) => setField("website", event.target.value)}
          placeholder="https://acmeplumbing.com"
          autoComplete="url"
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={`${idPrefix}-street`}>Street address</Label>
        <Input
          id={`${idPrefix}-street`}
          name={`${idPrefix}-street`}
          value={values.street}
          disabled={disabled}
          onChange={(event) => setField("street", event.target.value)}
          placeholder="1200 Congress Ave"
          autoComplete="address-line1"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-city`}>City</Label>
        <Input
          id={`${idPrefix}-city`}
          name={`${idPrefix}-city`}
          value={values.city}
          disabled={disabled}
          onChange={(event) => setField("city", event.target.value)}
          placeholder="Austin"
          autoComplete="address-level2"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-state`}>State</Label>
        <UsStateSelect
          id={`${idPrefix}-state`}
          value={values.state}
          disabled={disabled}
          onChange={(state) => setField("state", state)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-zip`}>ZIP</Label>
        <Input
          id={`${idPrefix}-zip`}
          name={`${idPrefix}-zip`}
          value={values.zip}
          disabled={disabled}
          onChange={(event) => setField("zip", event.target.value)}
          placeholder="78701"
          autoComplete="postal-code"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>Phone number</Label>
        <Input
          id={`${idPrefix}-phone`}
          name={`${idPrefix}-phone`}
          type="tel"
          value={values.phone}
          disabled={disabled}
          onChange={(event) => setField("phone", event.target.value)}
          placeholder="(512) 555-0142"
          autoComplete="tel"
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={`${idPrefix}-competitors`}>Competitors to watch</Label>
        <Textarea
          id={`${idPrefix}-competitors`}
          name={`${idPrefix}-competitors`}
          value={values.competitors}
          disabled={disabled}
          onChange={(event) => setField("competitors", event.target.value)}
          placeholder="Rival Plumbing, City Drain Co"
          rows={2}
        />
      </div>
    </div>
  )
}
