// Human-readable names for prospects.
//
// ManyReach frequently sends a reply with ONLY an email address — no firstname,
// no company. The old fallback chain ended in `prospect.email`, so landing pages
// rendered "executive.communications@walmart.com" as the company name in every
// headline, button and greeting. Nothing here may ever return a string with an
// "@" in it.
import { emailDomain, isFreeMailDomain } from "./website.ts";

const GENERIC_COMPANY = "Your Business";
const GENERIC_FIRST_NAME = "there";

/** True when the value looks like an email address (or a bare mail-ish token). */
export function looksLikeEmail(v?: string | null): boolean {
  return !!v && /@/.test(v);
}

const STOP_PARTS = new Set(["com", "co", "net", "org", "io", "uk", "au", "us", "ca", "biz", "info", "shop", "store", "site", "online"]);

function titleCase(s: string): string {
  return s
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/** "https://www.kings-property.co.uk" -> "Kings Property" */
export function companyFromDomain(input?: string | null): string | null {
  if (!input) return null;
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z]+:\/\//, "").split("/")[0].replace(/^www\./, "");
  if (!host.includes(".")) return null;
  if (isFreeMailDomain(host)) return null;
  const parts = host.split(".").filter((p) => !STOP_PARTS.has(p));
  const core = parts[0];
  if (!core) return null;
  // split camel/word boundaries in slugged domains
  const spaced = core.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  const name = titleCase(spaced);
  return name.length >= 2 ? name : null;
}

export interface NameSource {
  company?: string | null;
  firstname?: string | null;
  website_url?: string | null;
  email?: string | null;
}

/**
 * Best display name for a business. Order:
 * company -> website domain -> email domain (business mail only) -> first name
 * -> generic. Never an email address.
 */
export function resolveCompanyName(p: NameSource, fallback = GENERIC_COMPANY): string {
  const company = (p.company || "").trim();
  if (company && !looksLikeEmail(company)) return company;

  const fromSite = companyFromDomain(p.website_url);
  if (fromSite) return fromSite;

  const domain = emailDomain(p.email);
  if (domain && !isFreeMailDomain(domain)) {
    const fromMail = companyFromDomain(domain);
    if (fromMail) return fromMail;
  }

  const first = (p.firstname || "").trim();
  if (first && !looksLikeEmail(first)) return `${first}'s Business`;

  return fallback;
}

/** Best first name for greetings — never an email, never a raw domain. */
export function resolveFirstName(p: NameSource, fallback = GENERIC_FIRST_NAME): string {
  const first = (p.firstname || "").trim();
  if (first && !looksLikeEmail(first) && !/\d{3}/.test(first)) {
    return titleCase(first.split(/\s+/)[0]);
  }
  return fallback;
}

/** Last-line guard for values already stored in the DB. */
export function safeDisplayName(value?: string | null, ctx: NameSource = {}): string {
  if (value && !looksLikeEmail(value)) return value;
  return resolveCompanyName({ ...ctx, company: null, email: ctx.email ?? value ?? null });
}
