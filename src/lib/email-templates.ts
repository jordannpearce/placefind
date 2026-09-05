import { campaignLimit, monthlyTotal, PLANS } from "./plans"
import type { PlanId } from "./types"

const LOCAL_APP_URL = "http://127.0.0.1:43127"
const PUBLIC_APP_URL = "https://gridpins.com"

function hostnameOf(value: string) {
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return ""
  }
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname.startsWith("127.") || hostname === "[::1]"
}

function isEphemeralEmailHost(hostname: string) {
  const host = hostname.toLowerCase()
  const isPublicIp = Boolean(host.match(/^(\d{1,3}\.){3}\d{1,3}$/)) && !isLoopbackHost(host)
  return (
    host.includes("cursor.com") ||
    host.includes("cursor.sh") ||
    host.endsWith(".vercel.app") ||
    isPublicIp
  )
}

function looksDeployed() {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PUBLIC_DOMAIN ||
      process.env.VERCEL ||
      process.env.RENDER ||
      process.env.FLY_APP_NAME
  )
}

export function appUrl() {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "") || ""
  const deployed = process.env.NODE_ENV === "production" || looksDeployed()
  if (configured) {
    const host = hostnameOf(configured)
    if (host && !isEphemeralEmailHost(host) && !(deployed && isLoopbackHost(host))) {
      return configured
    }
  }

  if (deployed) {
    return PUBLIC_APP_URL
  }

  const host = (process.env.HOSTNAME || process.env.HOST || "").toLowerCase()
  const isLocal =
    process.env.NODE_ENV === "development" ||
    host === "localhost" ||
    host.startsWith("127.") ||
    host.endsWith(".local")

  return isLocal ? LOCAL_APP_URL : PUBLIC_APP_URL
}

export function loginUrl() {
  return `${appUrl()}/login`
}

function loginCta() {
  const href = loginUrl()
  return `<p>Log in at <a href="${href}" style="color:#2f6b5a;">${href}</a>.</p>`
}

function wrap(title: string, body: string) {
  return `<!doctype html>
<html>
  <head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0;background:#f4f1ea;font-family:Georgia,serif;color:#1f3d34;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fffdf8;border:1px solid #e4ddd0;border-radius:16px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 16px;font-family:'Poppins',Arial,sans-serif;font-weight:800;font-size:22px;letter-spacing:-0.03em;line-height:1;">
                  <span style="color:#001A17;">Grid</span><span style="color:#00D85A;">Pins</span>
                </p>
                <h1 style="margin:0 0 16px;font-size:28px;font-weight:400;">${title}</h1>
                ${body}
                <p style="margin:28px 0 0;font-size:12px;color:#6b7c74;">Google Maps grid rank tracking for local brands and agencies.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function activationEmail(name: string, verifyUrl: string) {
  return {
    subject: "Activate your GridPins account",
    html: wrap(
      "Confirm your email",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>Click below to activate your GridPins workspace and start tracking Maps rankings on a grid.</p>
       <p><a href="${verifyUrl}" style="display:inline-block;background:#2f6b5a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;">Activate account</a></p>
       <p style="font-size:13px;color:#6b7c74;">If the button does not work, paste this link:<br>${verifyUrl}</p>
       ${loginCta()}`
    ),
  }
}

export function passwordResetEmail(name: string, resetUrl: string) {
  return {
    subject: "Reset your GridPins password",
    html: wrap(
      "Reset your password",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>We received a request to reset the password for your GridPins account. This link expires in one hour and can be used once.</p>
       <p><a href="${resetUrl}" style="display:inline-block;background:#2f6b5a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;">Set a new password</a></p>
       <p style="font-size:13px;color:#6b7c74;">If the button does not work, paste this link:<br>${resetUrl}</p>
       ${loginCta()}
       <p style="font-size:13px;color:#6b7c74;">If you did not ask for this, you can ignore this email.</p>`
    ),
  }
}

export function billingEmail(name: string, planId: PlanId, extraCampaigns = 0) {
  const plan = PLANS[planId]
  const extras = planId === "agency" ? extraCampaigns : 0
  const limit = campaignLimit(planId, extras)
  const total = monthlyTotal(planId, extras)
  const extrasLine =
    planId === "agency"
      ? extras > 0
        ? `<p>That includes ${plan.campaigns} campaigns plus <strong>${extras} extra slot${extras === 1 ? "" : "s"}</strong> at $${plan.extraSlotPrice} each (effective limit ${limit}, hard cap ${plan.maxCampaigns}).</p>`
        : `<p>That includes ${plan.campaigns} campaigns. Extra slots are $${plan.extraSlotPrice} each, up to ${plan.maxCampaigns} campaigns.</p>`
      : `<p>This covers ${limit} campaigns, ${plan.keywords} keywords each, and grids up to ${plan.grid}×${plan.grid}.</p>`
  return {
    subject: `Your GridPins ${plan.name} plan`,
    html: wrap(
      "Billing update",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>Your workspace is now on the <strong>${plan.name}</strong> plan at <strong>$${total}/month</strong>${extras > 0 ? ` ($${plan.price} plus $${extras * plan.extraSlotPrice} in extra slots)` : ""}.</p>
       ${extrasLine}
       <p>We will invoice this amount monthly. Reply to this email if your billing contact changes.</p>`
    ),
  }
}

export function infoEmail(name: string, headline: string, body: string) {
  return {
    subject: headline,
    html: wrap(
      headline,
      `<p>Hi ${escapeHtml(name)},</p>
       <p>${escapeHtml(body)}</p>
       <p><a href="${appUrl()}/dashboard" style="color:#2f6b5a;">Open your dashboard</a></p>`
    ),
  }
}

export function accountCreatedEmail(name: string, email: string, trialEndsAt?: string | null) {
  const href = loginUrl()
  const trialLine = trialEndsAt
    ? `<p>You can use the tracker until <strong>${escapeHtml(new Date(trialEndsAt).toUTCString())}</strong>. After that, an active subscription is required.</p>`
    : `<p>An active subscription is required to run grids. Open pricing after you sign in if you have not subscribed yet.</p>`
  return {
    subject: "Your GridPins account is ready",
    html: wrap(
      "Account created",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>An administrator created a GridPins workspace for <strong>${escapeHtml(email)}</strong>.</p>
       <p>Sign in with the email and password they gave you.</p>
       ${trialLine}
       <p><a href="${href}" style="display:inline-block;background:#2f6b5a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;">Sign in</a></p>
       ${loginCta()}`
    ),
  }
}

export function accountInviteEmail(name: string, email: string, setPasswordUrl: string, trialEndsAt?: string | null) {
  const trialLine = trialEndsAt
    ? `<p>After you set a password, you can use the tracker until <strong>${escapeHtml(new Date(trialEndsAt).toUTCString())}</strong>.</p>`
    : `<p>After you set a password, subscribe to unlock the tracker. There is no automatic trial on self-serve accounts.</p>`
  return {
    subject: "Set your GridPins password",
    html: wrap(
      "You're invited",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>An administrator created a GridPins workspace for <strong>${escapeHtml(email)}</strong>. Set a password to sign in.</p>
       ${trialLine}
       <p><a href="${setPasswordUrl}" style="display:inline-block;background:#2f6b5a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;">Set a password</a></p>
       <p style="font-size:13px;color:#6b7c74;">If the button does not work, paste this link:<br>${setPasswordUrl}</p>
       ${loginCta()}`
    ),
  }
}

export function notificationEmail(name: string, headline: string, body: string) {
  return {
    subject: headline,
    html: wrap(
      headline,
      `<p>Hi ${escapeHtml(name)},</p>
       <p>${escapeHtml(body)}</p>
       <p><a href="${appUrl()}/dashboard" style="color:#2f6b5a;">Open your dashboard</a></p>`
    ),
  }
}

export function marketingEmail(name: string, headline: string, body: string) {
  return {
    subject: headline,
    html: wrap(
      headline,
      `<p>Hi ${escapeHtml(name)},</p>
       <p>${escapeHtml(body)}</p>
       <p>Track denser grids, more keywords, and every location from one workspace.</p>
       <p><a href="${appUrl()}/pricing" style="display:inline-block;background:#2f6b5a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;">See plans</a></p>
       <p style="font-size:12px;color:#6b7c74;">You are receiving this because you opted in to GridPins product mail. Unsubscribe from Account → Email.</p>`
    ),
  }
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function definitionList(rows: Array<[string, string]>) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:15px;line-height:1.5;">
    ${rows
      .map(
        ([label, value]) =>
          `<tr>
            <td style="padding:6px 12px 6px 0;color:#6b7c74;vertical-align:top;width:140px;">${escapeHtml(label)}</td>
            <td style="padding:6px 0;color:#1f3d34;">${escapeHtml(value) || "—"}</td>
          </tr>`
      )
      .join("")}
  </table>`
}

export function contactInboxEmail(input: {
  name: string
  email: string
  phone: string
  businessName: string
  city: string
  state: string
  comments: string
}) {
  return {
    subject: `Contact form: ${input.businessName} — ${input.name}`,
    html: wrap(
      "New contact message",
      `<p>A visitor sent this from the GridPins contact form. Reply to the visitor at ${escapeHtml(input.email)}.</p>
       ${definitionList([
         ["Name", input.name],
         ["Email", input.email],
         ["Phone", input.phone],
         ["Business", input.businessName],
         ["City", input.city],
         ["State", input.state],
         ["Comments", input.comments],
       ])}`
    ),
  }
}

export function leadInboxEmail(input: {
  name: string
  email: string
  phone: string
  businessName: string
  city: string
  state: string
  comments: string
  website?: string
  gbpListing?: string
  primaryCategory?: string
  keyword?: string
  locationCount?: string
}) {
  return {
    subject: `GBP help opt-in: ${input.businessName} — ${input.name}`,
    html: wrap(
      "New Get Found lead",
      `<p>A business owner opted in for Google Business Profile ranking help. They agreed to marketing and info emails from GridPins. Reply at ${escapeHtml(input.email)}.</p>
       ${definitionList([
         ["Name", input.name],
         ["Email", input.email],
         ["Phone", input.phone],
         ["Business", input.businessName],
         ["Website", input.website || "Not provided"],
         ["GBP listing", input.gbpListing || "Not provided"],
         ["Category", input.primaryCategory || "Not provided"],
         ["Keyword", input.keyword || "Not provided"],
         ["Locations", input.locationCount || "Not provided"],
         ["City", input.city],
         ["State", input.state],
         ["What they need", input.comments || "Not specified"],
       ])}`
    ),
  }
}

export function leadAssignedAgencyEmail(input: {
  agencyName: string
  amountUsd: number
  invoiceUrl?: string
  dryRun?: boolean
  lead: {
    name: string
    email: string
    phone: string
    businessName: string
    website?: string
    gbpListing?: string
    primaryCategory?: string
    keyword?: string
    locationCount?: string
    city: string
    state: string
    comments?: string
  }
}) {
  const amount = `$${input.amountUsd.toFixed(2)}`
  const payLine = input.invoiceUrl
    ? `<p>Pay the ${escapeHtml(amount)} invoice here: <a href="${escapeHtml(input.invoiceUrl)}" style="color:#2f6b5a;">${escapeHtml(input.invoiceUrl)}</a></p>`
    : `<p>You owe ${escapeHtml(amount)} for this lead. If a Paddle invoice link is not here yet, check your Paddle inbox or write ${escapeHtml("hello@info.gridpins.com")}.</p>`
  const dryLine = input.dryRun
    ? `<p style="font-size:13px;color:#6b7c74;">This notice was recorded without creating a live Paddle charge.</p>`
    : ""
  return {
    subject: `New Get Found lead assigned — ${input.lead.businessName} (${amount})`,
    html: wrap(
      "A lead was assigned to you",
      `<p>Hi ${escapeHtml(input.agencyName)},</p>
       <p>GridPins assigned you a Get Found lead. The lead price is <strong>${escapeHtml(amount)}</strong>.</p>
       ${payLine}
       ${dryLine}
       ${definitionList([
         ["Business", input.lead.businessName],
         ["Contact", input.lead.name],
         ["Email", input.lead.email],
         ["Phone", input.lead.phone],
         ["Website", input.lead.website || "Not provided"],
         ["GBP listing", input.lead.gbpListing || "Not provided"],
         ["Category", input.lead.primaryCategory || "Not provided"],
         ["Keyword", input.lead.keyword || "Not provided"],
         ["Locations", input.lead.locationCount || "Not provided"],
         ["City", input.lead.city],
         ["State", input.lead.state],
         ["Notes", input.lead.comments || "None"],
       ])}`
    ),
  }
}
