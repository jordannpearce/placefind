import { campaignLimit, monthlyTotal, PLANS } from "./plans"
import type { PlanId } from "./types"

const LOCAL_APP_URL = "http://127.0.0.1:43127"
const PUBLIC_APP_URL = "https://gridpins.com"

export function appUrl() {
  const configured = process.env.APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, "")

  const env = process.env.NODE_ENV
  const host = (process.env.HOSTNAME || process.env.HOST || "").toLowerCase()
  const isLocal =
    env === "development" ||
    host === "localhost" ||
    host.startsWith("127.") ||
    host.endsWith(".local")

  return isLocal ? LOCAL_APP_URL : PUBLIC_APP_URL
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
       <p style="font-size:13px;color:#6b7c74;">If the button does not work, paste this link:<br>${verifyUrl}</p>`
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

export function accountCreatedEmail(name: string, email: string) {
  const loginUrl = `${appUrl()}/login`
  return {
    subject: "Your GridPins account is ready",
    html: wrap(
      "Account created",
      `<p>Hi ${escapeHtml(name)},</p>
       <p>An administrator created a GridPins workspace for <strong>${escapeHtml(email)}</strong>.</p>
       <p>Sign in with the email and password they gave you to open your dashboard, campaigns, and grid tracker.</p>
       <p><a href="${loginUrl}" style="display:inline-block;background:#2f6b5a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;">Sign in</a></p>`
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
