"use client"

import type { ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { UsStateSelect } from "@/components/us-state-select"
import type { PublicInquiry } from "@/lib/public-forms"

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

export function HoneypotField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
      <label htmlFor="website">Website</label>
      <input
        id="website"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function InquiryFields({
  value,
  onChange,
  commentsLabel,
  commentsRequired,
  commentsPlaceholder,
  disabled,
}: {
  value: PublicInquiry
  onChange: (next: PublicInquiry) => void
  commentsLabel: string
  commentsRequired?: boolean
  commentsPlaceholder?: string
  disabled?: boolean
}) {
  function patch(partial: Partial<PublicInquiry>) {
    onChange({ ...value, ...partial })
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="inquiry-name">
          <Input
            id="inquiry-name"
            name="name"
            autoComplete="name"
            value={value.name}
            onChange={(event) => patch({ name: event.target.value })}
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Email" htmlFor="inquiry-email">
          <Input
            id="inquiry-email"
            name="email"
            type="email"
            autoComplete="email"
            value={value.email}
            onChange={(event) => patch({ email: event.target.value })}
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Phone" htmlFor="inquiry-phone">
          <Input
            id="inquiry-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={value.phone}
            onChange={(event) => patch({ phone: event.target.value })}
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Business name" htmlFor="inquiry-business">
          <Input
            id="inquiry-business"
            name="businessName"
            autoComplete="organization"
            value={value.businessName}
            onChange={(event) => patch({ businessName: event.target.value })}
            required
            disabled={disabled}
          />
        </Field>
        <Field label="City" htmlFor="inquiry-city">
          <Input
            id="inquiry-city"
            name="city"
            autoComplete="address-level2"
            value={value.city}
            onChange={(event) => patch({ city: event.target.value })}
            required
            disabled={disabled}
          />
        </Field>
        <Field label="State" htmlFor="inquiry-state">
          <UsStateSelect
            id="inquiry-state"
            value={value.state}
            onChange={(state) => patch({ state })}
            required
            disabled={disabled}
          />
        </Field>
      </div>
      <Field label={commentsLabel} htmlFor="inquiry-comments">
        <Textarea
          id="inquiry-comments"
          name="comments"
          value={value.comments}
          onChange={(event) => patch({ comments: event.target.value })}
          required={commentsRequired}
          placeholder={commentsPlaceholder}
          disabled={disabled}
        />
      </Field>
    </>
  )
}

export const emptyInquiry = (): PublicInquiry => ({
  name: "",
  email: "",
  phone: "",
  businessName: "",
  city: "",
  state: "",
  comments: "",
})
