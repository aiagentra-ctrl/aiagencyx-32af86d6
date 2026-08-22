/**
 * Match a scraped business to the closest pre-filled niche template.
 *
 * Pass 1: cheap keyword/signal scoring over scraped content.
 * Pass 2: LLM confirmation — picks the final niche, a confidence, and
 *         adaptation notes when the template needs adjusting.
 */
import { NICHE_PACKS, findNichePack, type NichePack } from "./localbiz-prompt.ts";
import { chatCompletion, MODELS } from "./openrouter.ts";

export type MatchResult = {
  niche: string;
  display_name: string;
  confidence: "high" | "medium" | "low";
  score: number;
  decision: "use_as_is" | "adapt" | "nearest_with_overrides";
  adaptation_notes: string;
  project_type_list?: string;
  pricing_policy_line?: string;
  industry_category?: string;
  runner_ups: { niche: string; score: number }[];
  source: "keyword" | "llm";
};

export function scoreNiches(text: string): { pack: NichePack; score: number }[] {
  const hay = (text || "").toLowerCase();
  const scored = NICHE_PACKS.map((pack) => {
    let score = 0;
    for (const sig of pack.signals) {
      const needle = sig.toLowerCase();
      let idx = hay.indexOf(needle);
      let hits = 0;
      while (idx !== -1 && hits < 12) {
        hits++;
        idx = hay.indexOf(needle, idx + needle.length);
      }
      // multi-word signals are far more discriminating than single words
      const weight = needle.includes(" ") ? 3 : 1;
      score += hits * weight;
    }
    return { pack, score };
  });
  return scored.sort((a, b) => b.score - a.score);
}

/** Compact the scraped site into the signals the classifier actually needs. */
export function extractSignals(input: {
  markdown?: string | null;
  services?: string[] | null;
  navLabels?: string[] | null;
  titles?: string[] | null;
}): string {
  const parts: string[] = [];
  if (input.titles?.length) parts.push(`PAGE TITLES: ${input.titles.slice(0, 40).join(" | ")}`);
  if (input.navLabels?.length) parts.push(`NAV: ${input.navLabels.slice(0, 40).join(" | ")}`);
  if (input.services?.length) parts.push(`SERVICES: ${input.services.slice(0, 40).join(" | ")}`);
  if (input.markdown) parts.push(`CONTENT:\n${input.markdown.slice(0, 25000)}`);
  return parts.join("\n\n");
}

const SYSTEM = `You classify local home-improvement businesses into one of a fixed set of agent templates.

Return ONLY raw JSON (no code fences) shaped exactly:
{
  "niche": "<one of the allowed keys>",
  "confidence": "high" | "medium" | "low",
  "decision": "use_as_is" | "adapt" | "nearest_with_overrides",
  "industry_category": "short human label for this business's category",
  "project_type_list": "comma separated list of the ACTUAL project types this business sells, taken from their site",
  "pricing_policy_line": "one sentence describing what their pricing depends on, phrased for a receptionist",
  "adaptation_notes": "short bullet-style notes (max 8 lines) telling the receptionist what is specific to THIS business: service names they actually use, service area, notable policies, things they do NOT do. Empty string when decision is use_as_is."
}

Rules:
- "use_as_is" when the business is squarely the chosen niche and offers nothing unusual.
- "adapt" when the niche is right but their service mix, wording or policies differ.
- "nearest_with_overrides" when no template truly fits; pick the closest and describe the gap.
- Never invent services, prices, guarantees or a service area that is not on the site.`;

export async function matchIndustry(input: {
  businessName: string;
  websiteUrl?: string | null;
  signalsText: string;
}): Promise<MatchResult> {
  const keyword = scoreNiches(`${input.businessName} ${input.websiteUrl || ""} ${input.signalsText}`);
  const top = keyword[0];
  const runner_ups = keyword.slice(0, 4).map((k) => ({ niche: k.pack.key, score: k.score }));

  const allowed = NICHE_PACKS.map((p) => `${p.key} (${p.display_name})`).join(", ");
  const shortlist = keyword.slice(0, 5).map((k) => `${k.pack.key}=${k.score}`).join(", ");

  const llm = await chatCompletion(
    MODELS.extraction,
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `ALLOWED KEYS: ${allowed}

KEYWORD PRE-SCORES: ${shortlist}

BUSINESS: ${input.businessName}
WEBSITE: ${input.websiteUrl || "unknown"}

SCRAPED SIGNALS:
${input.signalsText.slice(0, 30000)}`,
      },
    ],
    { temperature: 0.1, max_tokens: 900, response_format: { type: "json_object" } },
  ).catch(() => null);

  if (llm?.content) {
    try {
      const parsed = JSON.parse(llm.content.replace(/^```json\s*|```$/g, "").trim());
      const pack = findNichePack(parsed.niche);
      if (pack) {
        return {
          niche: pack.key,
          display_name: pack.display_name,
          confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "medium",
          score: top?.score ?? 0,
          decision: ["use_as_is", "adapt", "nearest_with_overrides"].includes(parsed.decision)
            ? parsed.decision
            : "adapt",
          adaptation_notes: typeof parsed.adaptation_notes === "string" ? parsed.adaptation_notes : "",
          project_type_list: parsed.project_type_list || undefined,
          pricing_policy_line: parsed.pricing_policy_line || undefined,
          industry_category: parsed.industry_category || undefined,
          runner_ups,
          source: "llm",
        };
      }
    } catch { /* fall through to keyword result */ }
  }

  // Keyword-only fallback
  const pack = top?.pack || NICHE_PACKS[0];
  const score = top?.score ?? 0;
  return {
    niche: pack.key,
    display_name: pack.display_name,
    confidence: score >= 12 ? "high" : score >= 4 ? "medium" : "low",
    score,
    decision: score >= 12 ? "use_as_is" : "adapt",
    adaptation_notes: "",
    runner_ups,
    source: "keyword",
  };
}
