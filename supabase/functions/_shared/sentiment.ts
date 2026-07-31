// Deterministic keyword sentiment used to trigger the two locked reply templates.
// If a keyword match is found, the exact stored template text is sent verbatim
// (only {DemoLink} / {{demo_url}} is substituted with the lead's tracked link).

const POSITIVE_KEYWORDS = [
  "yes", "yeah", "yep", "sure", "sounds good", "interested", "interesting",
  "send it", "send me", "share it", "share the", "let's do", "lets do",
  "would love", "i'd love", "id love", "happy to", "go ahead", "please do",
  "tell me more", "more info", "more information", "book", "schedule",
  "call me", "let's talk", "lets talk", "great", "perfect", "definitely",
  "keen", "curious", "show me", "demo",
];

const NEGATIVE_KEYWORDS = [
  "no thanks", "no thank", "not interested", "not intrested", "no interest",
  "unsubscribe", "remove me", "take me off", "stop emailing", "stop sending",
  "don't contact", "dont contact", "do not contact", "not right now",
  "not at this time", "we're good", "were good", "we are good", "all set",
  "no need", "pass", "not a fit", "not for us", "already have", "spam",
];

export type KeywordSentiment = "Positive" | "Negative" | null;

/** Returns Positive/Negative when the body clearly matches keywords, else null. */
export function keywordSentiment(body: string): KeywordSentiment {
  const text = (body || "").toLowerCase();
  if (!text.trim()) return null;

  const negHit = NEGATIVE_KEYWORDS.some((k) => text.includes(k));
  if (negHit) return "Negative";

  const posHit = POSITIVE_KEYWORDS.some((k) => {
    // whole-word match for the short affirmations to avoid false hits
    if (k.length <= 4) return new RegExp(`(^|[^a-z])${k}([^a-z]|$)`).test(text);
    return text.includes(k);
  });
  return posHit ? "Positive" : null;
}

/** Substitute the locked variables inside a stored template body. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return (body || "")
    .replace(/\{\{?\s*(DemoLink|demo_link|demo_url)\s*\}?\}/gi, vars.demo_url ?? "")
    .replace(/\{\{?\s*(FirstName|firstname|first_name)\s*\}?\}/gi, vars.firstname ?? "there")
    .replace(/\{\{?\s*(CompanyName|company)\s*\}?\}/gi, vars.company ?? "your team")
    .replace(/\{\{?\s*sender_name\s*\}?\}/gi, vars.sender_name ?? "")
    .trim();
}
