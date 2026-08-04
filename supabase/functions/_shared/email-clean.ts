// Cleans a raw inbound email down to what the person actually typed.
// Removes invisible characters, quoted history, signature blocks and legal
// disclaimer boilerplate so sentiment/intent is judged on the real reply only.

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF\u00AD\u2060]/g;

/** Strip invisible chars and normalise unicode punctuation + whitespace. */
export function normalizeText(raw: string): string {
  return (raw || "")
    .replace(ZERO_WIDTH, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const QUOTE_MARKERS = [
  /^on .{0,120}\bwrote:\s*$/i,
  /^-{2,}\s*original message\s*-{2,}/i,
  /^from:\s.+$/i,
  /^sent from my /i,
  /^\s*>/,
];

const SIGNATURE_MARKERS = [
  /^--\s*$/,
  /^__+\s*$/,
  /^(best|kind)\s+regards\b/i,
  /^regards\b[,.]?\s*$/i,
  /^thanks\b[,.]?\s*$/i,
  /^cheers\b[,.]?\s*$/i,
  /^sent from /i,
];

const DISCLAIMER_MARKERS = [
  /this e-?mail (\(including|is|and any)/i,
  /confidential(ity)?\b.*(notice|intended|privileged)/i,
  /if you (have )?received (it|this) in error/i,
  /please (do )?not (copy|disclose|use) it/i,
  /any views or opinions/i,
  /internet traffic is susceptible/i,
  /disclaimer:/i,
  /registered (in|office)\b/i,
  /unsubscribe from (this|these) (list|emails)/i,
];

/**
 * Returns only the sender's own new text: quoted thread, signature block and
 * legal boilerplate removed. Falls back to the normalized full body when the
 * trimming would leave nothing behind.
 */
export function extractReplyText(raw: string): string {
  const norm = normalizeText(raw);
  if (!norm) return "";

  const lines = norm.split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (QUOTE_MARKERS.some((re) => re.test(t))) break;
    if (SIGNATURE_MARKERS.some((re) => re.test(t))) break;
    if (DISCLAIMER_MARKERS.some((re) => re.test(t))) break;
    kept.push(line);
  }

  let body = kept.join("\n").trim();

  // Drop any residual disclaimer sentences that shared a line with real text.
  body = body
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !DISCLAIMER_MARKERS.some((re) => re.test(s)))
    .join(" ")
    .trim();

  return body || norm;
}
