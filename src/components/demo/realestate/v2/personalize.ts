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
