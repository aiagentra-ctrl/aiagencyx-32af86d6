/**
 * Personalisation helpers for the real-estate landing template.
 * Every variable resolves to a real string — a raw {{token}} must never render.
 */

/** Initials fallback for the sidebar brand badge when no logo image exists. */
export const initialsOf = (name?: string): string => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AI";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Best-effort {{CompanyDomain}} — website → email domain → slugged company name. */
export const companyDomainFrom = ({
  websiteUrl,
  contactEmail,
  companyName,
}: {
  websiteUrl?: string;
  contactEmail?: string;
  companyName?: string;
}): string => {
  const clean = (h: string) => h.replace(/^www\./i, "").toLowerCase();

  if (websiteUrl) {
    try {
      const u = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`);
      if (u.hostname) return clean(u.hostname);
    } catch {
      /* fall through */
    }
  }

  if (contactEmail?.includes("@")) {
    const host = contactEmail.split("@")[1]?.trim();
    if (host) return clean(host);
  }

  const slug = (companyName || "yourcompany")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);

  return `${slug || "yourcompany"}.com`;
};

/** Possessive form that reads correctly for names ending in "s". */
export const possessive = (name: string): string =>
  /s$/i.test(name) ? `${name}'` : `${name}'s`;

/** True when a value looks like an email address. */
export const looksLikeEmail = (v?: string | null): boolean => !!v && v.includes("@");

const STOP_PARTS = new Set([
  "com","co","net","org","io","uk","au","us","ca","biz","info","shop","store","site","online",
]);

const titleCase = (s: string) =>
  s.split(/[\s-]+/).filter(Boolean)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");

const FREE_MAIL = new Set([
  "gmail.com","googlemail.com","yahoo.com","hotmail.com","outlook.com","live.com",
  "aol.com","icloud.com","me.com","proton.me","protonmail.com","gmx.com","mail.com",
]);

/** "https://www.kings-property.co.uk" or "a@walmart.com" -> "Walmart" */
export const companyFromHost = (input?: string | null): string | null => {
  if (!input) return null;
  let host = input.trim().toLowerCase();
  if (host.includes("@")) host = host.split("@").pop() || "";
  host = host.replace(/^[a-z]+:\/\//, "").split("/")[0].replace(/^www\./, "");
  if (!host.includes(".") || FREE_MAIL.has(host)) return null;
  const core = host.split(".").filter((p) => !STOP_PARTS.has(p))[0];
  if (!core) return null;
  const name = titleCase(core.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2"));
  return name.length >= 2 ? name : null;
};

/**
 * Last-line guard: a raw email address must NEVER render as a company name.
 * Falls back to the email/website domain, then to a generic label.
 */
export const safeCompanyName = (
  value?: string | null,
  ctx: { websiteUrl?: string | null; contactEmail?: string | null } = {},
): string => {
  const v = (value || "").trim();
  if (v && !looksLikeEmail(v)) return v;
  return (
    companyFromHost(v) ||
    companyFromHost(ctx.websiteUrl) ||
    companyFromHost(ctx.contactEmail) ||
    "Your Business"
  );
};

/** Greeting-safe first name — never an email, never blank. */
export const safeFirstName = (value?: string | null, fallback = "there"): string => {
  const v = (value || "").trim();
  if (!v || looksLikeEmail(v)) return fallback;
  return titleCase(v.split(/\s+/)[0]);
};
