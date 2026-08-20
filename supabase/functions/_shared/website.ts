// Derive a usable business website from a prospect's email address.
// ManyReach often delivers a reply without the `www` field, which used to
// leave `prospects.website_url` empty — and an empty website silently skipped
// demo creation, so the positive-reply template had no link and the whole
// reply was blocked with `demo_link_missing`.

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.com.au",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "outlook.com.au", "live.com",
  "live.com.au", "msn.com", "aol.com", "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me", "gmx.com", "gmx.de", "mail.com", "yandex.com",
  "zoho.com", "bigpond.com", "bigpond.net.au", "optusnet.com.au", "iinet.net.au",
  "example.com", "test.com",
]);

export function emailDomain(email?: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.includes(".") ? domain : null;
}

export function isFreeMailDomain(domain?: string | null): boolean {
  if (!domain) return true;
  return FREE_MAIL_DOMAINS.has(domain);
}

/**
 * Returns `https://<company-domain>` for a business email, or null for
 * personal/free mailboxes (where the domain says nothing about the business).
 */
export function websiteFromEmail(email?: string | null): string | null {
  const domain = emailDomain(email);
  if (!domain || isFreeMailDomain(domain)) return null;
  return `https://${domain}`;
}

/** Best available website: explicit value first, email-derived fallback. */
export function resolveWebsite(explicit?: string | null, email?: string | null): string | null {
  const trimmed = (explicit || "").trim();
  if (trimmed) return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`;
  return websiteFromEmail(email);
}
