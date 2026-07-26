// Reply formatting + validation.
// Fixes the broken "[link][Regards,][Sender Name]" output pattern and enforces
// short, well-formed replies with a clean sign-off.

export const DEFAULT_SENDER_NAME = "Abhiraj Yadav";

export function senderName(prospect?: { sender_name?: string | null } | null): string {
  const n = (prospect as any)?.sender_name;
  return (typeof n === "string" && n.trim()) ? n.trim() : DEFAULT_SENDER_NAME;
}

const URL_RE = /https?:\/\/[^\s<>()\[\]"']+/g;
const SIGNOFF_RE = /^\s*(regards|best|best regards|thanks|cheers|sincerely)\s*,?\s*$/i;

/** Extract the first URL from text, or null. */
export function firstUrl(text: string): string | null {
  const m = (text || "").match(URL_RE);
  return m?.[0] ?? null;
}

/**
 * Repair malformed markdown/sign-off output and re-emit a clean shape:
 *
 *   <one short line>
 *   <url>
 *
 *   Best,
 *   Abhiraj Yadav
 */
export function normalizeReply(raw: string, name = DEFAULT_SENDER_NAME): string {
  let t = (raw || "").trim();

  // 1. Unwrap markdown links: [text](url) -> "text url" (we re-emit bare URLs).
  t = t.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
    const l = String(label).trim();
    return l && !/^https?:\/\//i.test(l) ? `${l} ${url}` : url;
  });

  // 2. Unwrap leftover bracket groups: [Regards,][Abhiraj Yadav] -> newline separated.
  t = t.replace(/\]\s*\[/g, "]\n[");
  t = t.replace(/\[([^\]\n]*)\]/g, (_m, inner) => String(inner).trim());

  // 3. Strip stray unmatched brackets/parens left behind.
  t = t.replace(/[\[\]]/g, "");
  t = t.replace(/\(\s*\)/g, "");

  // 4. Pull out the (single) URL and remove every occurrence from the body.
  const url = firstUrl(t);
  let body = t.replace(URL_RE, "").trim();

  // 5. Drop any existing sign-off lines + trailing name duplicates.
  const nameLower = name.toLowerCase();
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !SIGNOFF_RE.test(l))
    .filter((l) => l.toLowerCase() !== nameLower);

  body = lines.join("\n").replace(/[ \t]+/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
  // Trailing colon/dash before where the link used to sit reads fine; keep it.
  body = body.replace(/[-–—:]\s*$/, (m) => m.trim());

  const parts: string[] = [];
  if (body) parts.push(body);
  if (url) parts.push(url);
  parts.push(`\nBest,\n${name}`);
  return parts.join("\n").trim();
}

/** Trim the body to at most `max` sentences (sign-off/link preserved by caller). */
export function limitSentences(text: string, max = 2): string {
  const sentences = (text || "").match(/[^.!?\n]+[.!?]?/g) || [];
  if (sentences.length <= max) return (text || "").trim();
  return sentences.slice(0, max).join(" ").trim();
}

export type ReplyValidation = { ok: boolean; errors: string[] };

/** Validate a reply is safe to send. */
export function validateReply(text: string, name = DEFAULT_SENDER_NAME): ReplyValidation {
  const errors: string[] = [];
  const t = (text || "").trim();

  if (!t) errors.push("empty_reply");

  // (a) no stray brackets, no broken markdown link syntax
  if (/[\[\]]/.test(t)) errors.push("stray_brackets");
  const opens = (t.match(/\(/g) || []).length;
  const closes = (t.match(/\)/g) || []).length;
  if (opens !== closes) errors.push("unbalanced_parens");

  // (b) sender name present and on its own line
  const lines = t.split(/\r?\n/).map((l) => l.trim());
  if (!lines.some((l) => l.toLowerCase() === name.toLowerCase())) errors.push("missing_sender_name");

  // (c) exactly one sign-off block
  const signoffs = lines.filter((l) => SIGNOFF_RE.test(l)).length;
  if (signoffs === 0) errors.push("missing_signoff");
  if (signoffs > 1) errors.push("duplicate_signoff");
  const nameCount = lines.filter((l) => l.toLowerCase() === name.toLowerCase()).length;
  if (nameCount > 1) errors.push("duplicate_sender_name");

  // (d) no duplicated URLs
  const urls = t.match(URL_RE) || [];
  if (new Set(urls).size !== urls.length) errors.push("duplicate_url");
  if (urls.length > 1) errors.push("multiple_urls");

  return { ok: errors.length === 0, errors };
}

/** Normalize + validate in one shot. */
export function finalizeReply(raw: string, name = DEFAULT_SENDER_NAME): ReplyValidation & { text: string } {
  const text = normalizeReply(raw, name);
  return { text, ...validateReply(text, name) };
}