"use client"

import { Field, InquiryFields, emptyInquiry } from "@/components/public-inquiry-fields"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LEAD_STATUSES } from "@/lib/leads"
import { LOCATION_COUNTS, type LocationCount } from "@/lib/public-forms"
import type { LeadStatus, MarketingLead } from "@/lib/types"
import type { PublicInquiry } from "@/lib/public-forms"

export type AdminLeadFormValue = PublicInquiry & {
  website: string
  gbpListing: string
  primaryCategory: string
  keyword: string
  locationCount: LocationCount | ""
  status: LeadStatus
}

const LOCATION_LABELS: Record<LocationCount, string> = {
  "1": "1 location",
  "2-5": "2–5 locations",
  "6+": "6 or more",
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  assigned: "Assigned",
  invoiced: "Invoiced",
  paid: "Paid",
}

export function emptyAdminLeadForm(): AdminLeadFormValue {
  return {
    ...emptyInquiry(),
    website: "",
    gbpListing: "",
    primaryCategory: "",
    keyword: "",
    locationCount: "",
    status: "new",
  }
}

export function adminLeadFormFromLead(lead: MarketingLead): AdminLeadFormValue {
  return {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    businessName: lead.businessName,
    city: lead.city,
    state: lead.state,
    comments: lead.comments,
    website: lead.website,
    gbpListing: lead.gbpListing,
    primaryCategory: lead.primaryCategory,
    keyword: lead.keyword,
    locationCount: lead.locationCount,
    status: lead.status,
  }
}

export function adminLeadPayload(form: AdminLeadFormValue, includeStatus: boolean) {
  const body: Record<string, unknown> = {
    name: form.name,
    email: form.email,
    phone: form.phone,
    businessName: form.businessName,
    city: form.city,
    state: form.state,
    comments: form.comments,
    website: form.website,
    gbpListing: form.gbpListing,
    primaryCategory: form.primaryCategory,
    keyword: form.keyword,
    locationCount: form.locationCount,
  }
  if (includeStatus) body.status = form.status
  return body
}

export function AdminLeadFormFields({
  value,
  onChange,
  disabled,
  showStatus,
}: {
  value: AdminLeadFormValue
  onChange: (next: AdminLeadFormValue) => void
  disabled?: boolean
  showStatus?: boolean
}) {
  const inquiry: PublicInquiry = {
    name: value.name,
    email: value.email,
    phone: value.phone,
    businessName: value.businessName,
    city: value.city,
    state: value.state,
    comments: value.comments,
  }

  return (
    <div className="space-y-4">
      <InquiryFields
        value={inquiry}
        onChange={(next) => onChange({ ...value, ...next })}
        commentsLabel="Comments (optional)"
        commentsPlaceholder="Notes for the agency, listing issues, competitors…"
        disabled={disabled}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website (optional)" htmlFor="admin-lead-website">
          <Input
            id="admin-lead-website"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://yourshop.com"
            value={value.website}
            onChange={(event) => onChange({ ...value, website: event.target.value })}
            disabled={disabled}
          />
        </Field>
        <Field label="Google Business Profile URL or listing name (optional)" htmlFor="admin-lead-gbp">
          <Input
            id="admin-lead-gbp"
            placeholder="maps.google.com/… or Joe’s Plumbing"
            value={value.gbpListing}
            onChange={(event) => onChange({ ...value, gbpListing: event.target.value })}
            disabled={disabled}
          />
        </Field>
        <Field label="Primary category / type of business" htmlFor="admin-lead-category">
          <Input
            id="admin-lead-category"
            placeholder="Plumber, dental clinic, HVAC…"
            value={value.primaryCategory}
            onChange={(event) => onChange({ ...value, primaryCategory: event.target.value })}
            required
            disabled={disabled}
          />
        </Field>
        <Field label="Main keyword you want to rank for" htmlFor="admin-lead-keyword">
          <Input
            id="admin-lead-keyword"
            placeholder="emergency plumber Austin"
            value={value.keyword}
            onChange={(event) => onChange({ ...value, keyword: event.target.value })}
            required
            disabled={disabled}
          />
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Number of locations</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {LOCATION_COUNTS.map((count) => (
            <label
              key={count}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm ${
                value.locationCount === count ? "border-primary bg-primary/5" : "bg-background"
              }`}
            >
              <input
                type="radio"
                name="adminLocationCount"
                className="sr-only"
                value={count}
                checked={value.locationCount === count}
                onChange={() => onChange({ ...value, locationCount: count })}
                required
                disabled={disabled}
              />
              {LOCATION_LABELS[count]}
            </label>
          ))}
        </div>
      </fieldset>
      {showStatus ? (
        <div className="space-y-1.5">
          <Label htmlFor="admin-lead-status">Status</Label>
          <select
            id="admin-lead-status"
            className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm"
            value={value.status}
            onChange={(event) => onChange({ ...value, status: event.target.value as LeadStatus })}
            disabled={disabled}
          >
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  )
}
