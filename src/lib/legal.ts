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
          "PlaceFind is a web directory for local businesses. People use it to find shops. Businesses use it to publish a listing, request a website crawl, and collect reviews on a public profile.",
          "A business listing is $150 per month. Signed-in owners can edit the listing, request Crawl Website from the dashboard, and manage the profile visitors see. Neighbors who only leave reviews or request quotes create a free account. PlaceFind does not charge those accounts $150.",
        ],
      },
      {
        heading: "Your account",
        body: [
          "A business account lets you add and manage PlaceFind listings and use signed-in owner tools. A neighbor account is free and is only for reviews and quote requests. You may not share your password or use the service to impersonate another business.",
          "We may refuse or close an account if we reasonably believe it was obtained by fraud, used to overload the service, or used to post a listing that is not yours.",
        ],
      },
      {
        heading: "Acceptable use",
        body: [
          "Use PlaceFind to research businesses you have a legitimate interest in — your own listing, competitors, or an area you serve. Do not use it to harass people or scrape the directory at industrial volume.",
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
          "Directory listings, reviews, and crawled profile copy can change. PlaceFind does not guarantee a lead or that a listing will stay the same.",
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
          "When you create an account we store your name, email, and a hashed password. When you add a listing we store the business name, city, state, category, keywords, and optional phone, email, website, and hours.",
          "If you save a campaign from a signed-in account, we store the business name, city, state, keywords, and scan results you asked us to keep so you can come back to them.",
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
          "We send mail that the product needs: account confirmation, password reset links, notices about your listings, and quote requests a visitor asks us to pass to the email on a listing. These are not marketing messages. You receive them because you created an account, reset a password, or asked the site to do something.",
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
          "Name, email, hashed password, role (customer or admin), account type (business listing or free neighbor), and account status. This is what lets you sign in on the website.",
        ],
      },
      {
        heading: "Listing data",
        body: [
          "Business name, city, state, category, keywords, optional contact details, and visitor reviews. Crawl Website stores license and company facts on the crawl request and writes a profile article. It does not overwrite the listing form. Public directory pages show the listing you published plus that article.",
        ],
      },
      {
        heading: "Research data you create",
        body: [
          "Campaigns, keywords, map points, and scan results you start from a signed-in account. This data belongs to your account. Other customers cannot see it.",
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
          "Visitors can browse listings and read profiles without paying. Reviews and quote requests use a free neighbor account. PlaceFind does not charge $150 for those accounts.",
        ],
      },
      {
        heading: "Business listings are $150 per month",
        body: [
          "A business pays $150 per month to keep an active PlaceFind listing. That fee covers the public profile, website crawl, and review desk. Write us from the email on your account within 14 days of the first charge if you want a refund for that first month. Later months are not refunded after the period has started.",
        ],
      },
      {
        heading: "What we do not promise",
        body: [
          "A refund is not available because a listing received fewer visits or reviews than you hoped, or because crawled website copy did not match the tone you wanted. You can edit the listing or request another crawl.",
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
