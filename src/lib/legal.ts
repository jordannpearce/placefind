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
  "If you have a question about this page, sign in and write us from the email on your account."

export const LEGAL_PAGES: LegalPage[] = [
  {
    path: "/terms",
    nav: "Terms",
    title: "Terms of use",
    updated: LEGAL_UPDATED,
    intro:
      "These terms cover the PlaceFind website and your account. By creating an account or using the directory, you agree to them.",
    sections: [
      {
        heading: "What PlaceFind is",
        body: [
          "PlaceFind is a web directory for local businesses. People use it to find businesses, and businesses use it to list themselves and see whether they appear on Google Maps.",
          "Signed-in businesses can create a listing, confirm the matching Google Maps place, and use optional rank-tracking tools on their account.",
        ],
      },
      {
        heading: "Your account",
        body: [
          "An account lets you add and manage PlaceFind listings and use signed-in tools. You may not share your password or use the service to impersonate another business.",
          "We may refuse or close an account if we reasonably believe it was obtained by fraud, used to overload the service, or used to post a listing that is not yours.",
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
          "The service is provided as-is. To the extent the law allows, PlaceFind is not liable for lost profits, lost data, or indirect damages from using the site.",
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
    intro: "This policy explains what PlaceFind collects when you use the website, and how we use that information.",
    sections: [
      {
        heading: "Information you give us",
        body: [
          "When you create an account we store your name, email, and a hashed password. When you add a listing we store the business name, city, state, category, keywords, and optional phone, website, and hours.",
          "If you run Track or save a campaign, we store the business name, city, state, keywords, and scan results you asked us to keep so you can come back to them.",
        ],
      },
      {
        heading: "Information created by using the site",
        body: [
          "We use a session cookie to keep you signed in so your listings and campaigns stay on your account.",
          "We keep ordinary server logs so we can run the service, find bugs, and stop abuse. Those logs are not used to build an advertising profile.",
        ],
      },
      {
        heading: "How we use it",
        body: [
          "We use account data to sign you in, send transactional email, show your listings, and show you your scans. We use listing and campaign data only to provide the product you asked for.",
          "We do not sell your account list. We do not rent emails to other companies.",
        ],
      },
      {
        heading: "How long we keep it",
        body: [
          "We keep your account and listing records while the account is open and for a reasonable period afterward so we can handle support requests.",
          "You can ask us to close an account. We may retain a minimal record when the law requires it.",
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
          "We send mail that the product needs: account confirmation, password reset links, and notices about your listings. These are not marketing messages. You receive them because you created an account, reset a password, or asked the site to do something.",
        ],
      },
      {
        heading: "Optional product mail",
        body: [
          "From time to time we may send product updates, tips, or an offer to existing customers. That mail always includes a way to unsubscribe. Unsubscribing from optional mail does not close your account or stop transactional messages.",
        ],
      },
      {
        heading: "What we will not do",
        body: [
          "We will not add you to a third-party list. We will not sell your address. We will not disguise a sales pitch as a password email.",
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
    intro: "This page is a plain-language look at the data PlaceFind stores for the product to work.",
    sections: [
      {
        heading: "Account data",
        body: [
          "Name, email, hashed password, role (customer or admin), and account status. This is what lets you sign in on the website.",
        ],
      },
      {
        heading: "Listing data",
        body: [
          "Business name, city, state, category, keywords, optional contact details, and the Google Maps place you confirmed (or a not-found status). Public directory pages show the profile you published.",
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
          "Ask us from the email on your account if you want the account closed. Campaign and listing data is removed with the account unless a legal hold applies.",
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
    intro: "PlaceFind is a web directory and account. This page explains how billing questions are handled.",
    sections: [
      {
        heading: "The public directory is free to browse",
        body: [
          "Visitors can browse listings and try a sample Maps lookup without paying. Creating an account and adding a listing does not require a purchase today.",
        ],
      },
      {
        heading: "If a paid plan is added later",
        body: [
          "If you pay for an optional plan in the future, unused time on that plan may be refunded within 14 days of the charge if you write us from the email on your account. We will say so clearly at checkout.",
        ],
      },
      {
        heading: "What we do not promise",
        body: [
          "Maps results, ranks, and traffic on Google Maps are outside our control. A refund is not available because a listing ranked lower than you hoped or because a competitor appeared in a scan.",
        ],
      },
      {
        heading: "How to ask",
        body: ["Sign in, open your account, and write us from that email.", SHARED_CONTACT],
      },
    ],
  },
]

export function legalPageFor(path: string): LegalPage | null {
  return LEGAL_PAGES.find((page) => page.path === path || page.aliases?.includes(path as LegalPath)) ?? null
}

export function isLegalPath(path: string): path is LegalPath {
  return legalPageFor(path) != null
}

export function legalNavLinks(): { href: LegalPath; label: string }[] {
  return LEGAL_PAGES.map((page) => ({ href: page.path, label: page.nav }))
}
