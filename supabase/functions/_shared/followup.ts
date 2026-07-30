// Shared helpers for the follow-up engine.
import { DEFAULT_SENDER_NAME } from "./reply-format.ts";

export const TRIGGER_KEYS = [
  "no_click_48h",
  "clicked_no_open",
  "opened_no_try",
  "tried_voice_only",
  "tried_chat_only",
  "tried_both_no_reply",
] as const;
export type TriggerKey = typeof TRIGGER_KEYS[number];

export function daysBetween(a?: string | null, b: Date = new Date()): string {
  if (!a) return "—";
  const ms = b.getTime() - new Date(a).getTime();
  return String(Math.max(0, Math.floor(ms / 86400_000)));
}

export function substituteVars(tpl: string, vars: Record<string, string>): string {
  return (tpl || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] ?? ""));
}

export const CALENDLY_URL = "https://calendly.com/aiagentra/new-meeting";

export function buildProspectVars(p: any, demoUrl?: string | null): Record<string, string> {
  const demo = demoUrl || "";
  return {
    firstname: p.firstname || "there",
    lastname: p.lastname || "",
    company: p.company || "your company",
    website: p.website_url || "",
    demo_url: demo,
    demo_link: demo,
    voice_agent_link: demo ? `${demo}${demo.includes("?") ? "&" : "?"}open=voice` : "",
    chatbot_link: demo ? `${demo}${demo.includes("?") ? "&" : "?"}open=chat` : "",
    calendly_link: CALENDLY_URL,
    sender_name: (p.sender_name && String(p.sender_name).trim()) || DEFAULT_SENDER_NAME,
    sender_email: p.sender_email || "",
    campaign_name: p.campaign_name || "",
    days_since_demo: daysBetween(p.demo_sent_at),
    days_since_click: daysBetween(p.demo_link_clicked_at),
    days_since_open: daysBetween(p.demo_page_opened_at),
  };
}

// ---------------------------------------------------------------------------
// Open message editor: step bodies are free text. Nothing is appended and no
// author-written link is stripped — what the operator writes is what is sent.
// ---------------------------------------------------------------------------

/** Collapse excess blank lines and trim. That is the only transformation applied. */
export function renderStepBody(rawBody: string): string {
  return (rawBody || "").replace(/\n{4,}/g, "\n\n\n").trim();
}


export const FOLLOWUP_PROMPTS: Record<TriggerKey, string> = {
  no_click_48h:
    "Write a 1-2 sentence, curiosity-driven cold-email follow-up. The prospect did not click the demo link yet. Reference {{company}} naturally. Ask a light question or spark curiosity so they reply. Do not sound salesy. End with the demo link on its own line: {{demo_url}}",
  clicked_no_open:
    "Prospect clicked the link but never opened the page. Write a 1-2 sentence nudge acknowledging they may have gotten busy, and re-share the link: {{demo_url}}",
  opened_no_try:
    "Prospect opened the demo page but didn't try the voice agent or chatbot. Write a friendly 1-2 sentence follow-up encouraging them to click the AI agent to see it in action. Include: {{demo_url}}",
  tried_voice_only:
    "Prospect tried the voice agent but not the chatbot. Write a 1-2 sentence follow-up inviting them to also try the chatbot on the same page. Include: {{demo_url}}",
  tried_chat_only:
    "Prospect tried the chatbot but not the voice agent. Write a 1-2 sentence follow-up inviting them to try the voice call agent on the same page. Include: {{demo_url}}",
  tried_both_no_reply:
    "Prospect tried both agents but hasn't replied. Write a 1-2 sentence, direct-but-friendly close asking if they'd like a 15-min call to set it up for {{company}}.",
};