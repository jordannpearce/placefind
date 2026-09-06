export type LegalPath = "/terms" | "/privacy" | "/policy" | "/email-policy" | "/data-policy" | "/refund"

export type LegalPage = {
  path: LegalPath
  aliases?: LegalPath[]
  nav: string
  title: string
  updated: string
  intro: string
  sections: { heading: string; body: string[] }[]
}

export const LEGAL_UPDATED = "September 6, 2026"

const SHARED_CONTACT =
  "If you have a question about this page, sign in and write us from the email on your account, or use the contact address printed on your license receipt."

export const LEGAL_PAGES: LegalPage[] = [
  {
    path: "/terms",
    nav: "Terms",
    title: "Terms of use",
    updated: LEGAL_UPDATED,
    intro:
      "These terms cover the PlaceFind website, your account, and the Windows desktop app. By buying a license or creating an account, you agree to them.",
    sections: [
      {
        heading: "What PlaceFind is",
        body: [
          "PlaceFind is research software for local businesses. It looks up Google Maps listings from a business name, city, state, and optional keyword, and it lets signed-in customers track how those listings appear across an area.",
          "We license a Windows desktop app and a matching web account. The website also explains the product, sells licenses, and lets signed-in customers run tools they have paid for.",
        ],
      },
      {
        heading: "Your license",
        body: [
          "A paid license is for one Windows computer unless we say otherwise at checkout. You may not share, rent, or resell the key. You may move the app to a replacement computer if you stop using the old one.",
          "We may refuse or revoke a license if we reasonably believe it was obtained by fraud, shared publicly, or used to overload the service.",
        ],
      },
      {
        heading: "Acceptable use",
        body: [
          "Use PlaceFind to research businesses you have a legitimate interest in — your own listing, competitors, or an area you serve. Do not use it to harass people, scrape at industrial volume, or break the rules of Google Maps or any other site.",
          "We may slow or stop public tools when we see automated or abusive traffic. That is a service-protection step, not a promise that every visitor gets unlimited live lookups.",
        ],
      },
      {
        heading: "Accounts",
        body: [
          "You are responsible for the email and password on your account. Tell us if you lose access. We may suspend an account that looks compromised or that violates these terms.",
        ],
      },
      {
        heading: "No warranty",
        body: [
          "Maps results change. Rankings move. PlaceFind presents listings as we find them at search time. We do not guarantee a rank, a lead, or that a listing will stay the same.",
          "The software is provided as-is. To the extent the law allows, PlaceFind is not liable for lost profits, lost data, or indirect damages from using the site or the app.",
        ],
      },
      {
        heading: "Changes",
        body: [
          "We may update these terms. The date at the top of this page is the current version. Continued use after a change means you accept the new terms.",
          SHARED_CONTACT,
        ],
      },
    ],
  },
  {
    path: "/policy",
    aliases: ["/privacy"],
    nav: "Policy",
    title: "Privacy policy",
    updated: LEGAL_UPDATED,
    intro:
      "This policy explains what PlaceFind collects when you use the website or the Windows app, and how we use that information.",
    sections: [
      {
        heading: "Information you give us",
        body: [
          "When you create an account or buy a license we store your name, email, and a hashed password. We also store the license key issued to you and a record of the order.",
          "If you run Track or save a campaign, we store the business name, city, state, keywords, and scan results you asked us to keep so you can come back to them.",
        ],
      },
      {
        heading: "Information created by using the site",
        body: [
          "We use a session cookie to keep you signed in. The desktop app talks to the same account so your license and campaigns stay in one place.",
          "We keep ordinary server logs so we can run the service, find bugs, and stop abuse. Those logs are not used to build an advertising profile.",
        ],
      },
      {
        heading: "How we use it",
        body: [
          "We use account data to sign you in, deliver a license, send transactional email, and show you your scans. We use campaign data only to provide the product you asked for.",
          "We do not sell your account list. We do not rent emails to other companies.",
        ],
      },
      {
        heading: "How long we keep it",
        body: [
          "We keep your account and license records while the account is open and for a reasonable period afterward so we can handle refunds, chargebacks, or support.",
          "You can ask us to close an account. We may retain a minimal record when the law or a payment dispute requires it.",
        ],
      },
      {
        heading: "Your choices",
        body: [SHARED_CONTACT],
      },
    ],
  },
  {
    path: "/email-policy",
    nav: "Email policy",
    title: "Email policy",
    updated: LEGAL_UPDATED,
    intro:
      "PlaceFind sends a small number of emails. This page says which ones are required for the product and which ones you can turn off.",
    sections: [
      {
        heading: "Transactional email",
        body: [
          "We send mail that the product needs: account confirmation, license delivery, password reset links, and receipts. These are not marketing messages. You receive them because you bought PlaceFind, reset a password, or asked the site to do something.",
        ],
      },
      {
        heading: "Optional product mail",
        body: [
          "From time to time we may send product updates, tips, or an offer to existing customers. That mail always includes a way to unsubscribe. Unsubscribing from optional mail does not cancel your license or stop transactional messages.",
        ],
      },
      {
        heading: "What we will not do",
        body: [
          "We will not add you to a third-party list. We will not sell your address. We will not disguise a sales pitch as a license or password email.",
        ],
      },
      {
        heading: "Questions",
        body: [SHARED_CONTACT],
      },
    ],
  },
  {
    path: "/data-policy",
    nav: "Data policy",
    title: "Data policy",
    updated: LEGAL_UPDATED,
    intro:
      "This page is a plain-language look at the data PlaceFind stores for the product to work.",
    sections: [
      {
        heading: "Account data",
        body: [
          "Name, email, hashed password, role (customer or admin), and account status. This is what lets you sign in on the website and on Windows.",
        ],
      },
      {
        heading: "License and order data",
        body: [
          "Order records, license keys, and the email the key was sent to. We keep this so you can recover a key and so we can tell a valid license from a copied one.",
        ],
      },
      {
        heading: "Research data you create",
        body: [
          "Campaigns, keywords, map points, scan results, and traffic jobs you start. This data belongs to your account. Other customers cannot see it.",
        ],
      },
      {
        heading: "Sessions and cookies",
        body: [
          "A session cookie keeps you signed in while you move between pages. Clearing cookies signs you out. The public site does not use advertising cookies.",
        ],
      },
      {
        heading: "Service protection",
        body: [
          "Public lookup tools are limited so a script cannot run endless live searches. We do that to keep the product available for real customers. We do not publish visitor identifiers, and we do not use this for advertising.",
        ],
      },
      {
        heading: "Closing an account",
        body: [
          "Ask us from the email on your account if you want the account closed. Campaign data is removed with the account unless a legal hold applies.",
          SHARED_CONTACT,
        ],
      },
    ],
  },
  {
    path: "/refund",
    nav: "Refunds",
    title: "Refund policy",
    updated: LEGAL_UPDATED,
    intro:
      "PlaceFind is a paid Windows license plus a web account. This page explains when we refund a purchase.",
    sections: [
      {
        heading: "Unused license within 14 days",
        body: [
          "If you bought a license and have not activated it on a Windows computer, you may request a refund within 14 days of the purchase date. Write us from the email on the order.",
        ],
      },
      {
        heading: "After you activate",
        body: [
          "Once the key is activated on a computer, the license is in use. We generally do not refund an activated license. If the installer never ran or the key never unlocked the app because of a defect on our side, we will repair that or refund the unused key.",
        ],
      },
      {
        heading: "What we do not promise",
        body: [
          "Maps results, ranks, and traffic on Google Maps are outside our control. A refund is not available because a listing ranked lower than you hoped or because a competitor appeared in a scan.",
          "We do not offer partial refunds for unused campaign slots or for time you did not spend in the app.",
        ],
      },
      {
        heading: "How to ask",
        body: [
          "Sign in, open your account, and write us from that email with the order date. If we approve a refund, we reverse the charge through the same payment method when we can, and we disable the unused key.",
          SHARED_CONTACT,
        ],
      },
    ],
  },
]

export function legalPageFor(path: string): LegalPage | null {
  return (
    LEGAL_PAGES.find((page) => page.path === path || page.aliases?.includes(path as LegalPath)) ?? null
  )
}

export function isLegalPath(path: string): path is LegalPath {
  return legalPageFor(path) != null
}

export function legalNavLinks(): { href: LegalPath; label: string }[] {
  return LEGAL_PAGES.map((page) => ({ href: page.path, label: page.nav }))
}
