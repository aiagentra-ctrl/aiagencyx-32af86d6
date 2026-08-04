// Deterministic safety net for reply sentiment.
//
// This is NOT the primary classifier any more — `inbox-classify` uses an AI
// intent step with the full thread history. This module only catches the
// unambiguous cases (explicit opt-outs / explicit "send me the link") and is
// used to veto an obviously wrong AI answer. It never guesses.

import { extractReplyText, normalizeText } from "./email-clean.ts";

export type KeywordSentiment = "Positive" | "Negative" | null;

/** Explicit refusals / opt-outs. A hit here always wins. */
const NEGATIVE_PATTERNS: RegExp[] = [
  /\bnot?\s+(interested|intrested|intersted)\b/,
  /\bno\s+(thanks|thank you|interest|need)\b/,
  /\bunsubscribe\b/,
  /\b(remove|take)\s+me\s+(off|from)\b/,
  /\bstop\s+(emailing|sending|contacting)\b/,
  /\b(do\s*n[o']?t|dont|do not)\s+(contact|email)\s+me\b/,
  /\bnot\s+(for\s+(us|me)|a\s+fit|right\s+now|at\s+this\s+time)\b/,
  /\b(we|i)\s*('re| are|m| am)?\s*(all\s+set|good\s+thanks)\b/,
  /\bmaybe\s+later\b/,
  /\bit\s+is\s+a\s+["']?no["']?\b/,
  /\bthat'?s\s+a\s+["']?no["']?\b/,
  /\bthe\s+answer\s+is\s+["']?no["']?\b/,
  /^\s*no[.!\s]*$/,
  /\bnot\s+something\s+(we|i)\b/,
  /\bplease\s+remove\b/,
  /\bspam\b/,
];

/** Explicit asks to receive the demo / proceed. */
const POSITIVE_PATTERNS: RegExp[] = [
  /\b(yes|yeah|yep|sure)\b/,
  /\bsounds?\s+good\b/,
  /\b(i\s*'?m|we\s*'?re|am)\s+interested\b/,
  /\bvery\s+interested\b/,
  /\b(send|share)\s+(me\s+)?(the\s+|it|a\s+)?(link|demo|details|info)/,
  /\bshow\s+me\b/,
  /\bhow\s+(do\s+i|to)\s+(start|begin|get\s+started)\b/,
  /\b(let'?s|lets)\s+(talk|do\s+it|chat)\b/,
  /\bbook\s+(a\s+)?(call|time|meeting)\b/,
  /\bhappy\s+to\s+(chat|talk|see)\b/,
  /\btell\s+me\s+more\b/,
  /\bwould\s+love\b/,
  /\bgo\s+ahead\b/,
];

const NEGATION_BEFORE = /\b(not|never|isn'?t|aren'?t|no)\s+(\w+\s+){0,2}$/;

/**
 * Returns Positive/Negative only for unambiguous replies, else null.
 * Reads the sender's own text only (quotes, signatures and legal
 * disclaimers are stripped first).
 */
export function keywordSentiment(body: string): KeywordSentiment {
  const text = extractReplyText(body).toLowerCase();
  if (!text.trim()) return null;

  if (NEGATIVE_PATTERNS.some((re) => re.test(text))) return "Negative";

  for (const re of POSITIVE_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const before = text.slice(0, m.index);
    if (NEGATION_BEFORE.test(before)) continue; // "not interested", "never keen"
    return "Positive";
  }
  return null;
}

/** True when the reply contains a hard opt-out — never email again. */
export function isHardOptOut(body: string): boolean {
  const text = extractReplyText(body).toLowerCase();
  return /\bunsubscribe\b|\b(remove|take)\s+me\s+(off|from)\b|\bstop\s+(emailing|sending|contacting)\b|\b(do\s*n[o']?t|dont|do not)\s+(contact|email)\s+me\b/
    .test(text);
}

export { extractReplyText, normalizeText };

/** Substitute the locked variables inside a stored template body. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return (body || "")
    .replace(/\{\{?\s*(DemoLandingPageLink|DemoLink|demo_link|demo_url)\s*\}?\}/gi, vars.demo_url ?? "")
    .replace(/\{\{?\s*(FirstName|firstname|first_name)\s*\}?\}/gi, vars.firstname ?? "there")
    .replace(/\{\{?\s*(CompanyName|company)\s*\}?\}/gi, vars.company ?? "your team")
    .replace(/\{\{?\s*sender_name\s*\}?\}/gi, vars.sender_name ?? "")
    .trim();
}
