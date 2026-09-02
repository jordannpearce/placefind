import {
  COMPANY_CITY_LINE,
  COMPANY_HOURS,
  COMPANY_LEGAL_NAME,
  COMPANY_STREET,
  SUPPORT_INBOX,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_TEL,
} from "@/lib/company"

export function CompanyDetails() {
  return (
    <address className="not-italic">
      <p className="font-heading text-2xl">{COMPANY_LEGAL_NAME}</p>
      <p className="mt-3 text-sm leading-6">
        <a className="text-primary hover:underline" href={SUPPORT_PHONE_TEL}>
          {SUPPORT_PHONE_DISPLAY}
        </a>
      </p>
      <p className="text-sm leading-6">
        <a className="text-primary hover:underline" href={`mailto:${SUPPORT_INBOX}`}>
          {SUPPORT_INBOX}
        </a>
      </p>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {COMPANY_STREET}
        <br />
        {COMPANY_CITY_LINE}
      </p>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">Hours: {COMPANY_HOURS}</p>
    </address>
  )
}
