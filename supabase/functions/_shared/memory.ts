// Shared AI memory helpers — the "brain" per prospect.
// Every edge function that acts on a prospect should read memory before
// deciding, and write memory after acting.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabaseAdmin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export type ProspectMemory = {
  prospect_id: string;
  demo_link_sent: boolean;
  demo_link_sent_at: string | null;
  demo_link_sent_in_message_id: string | null;
  reply_times: Array<{ timestamp: string; day_of_week: number; hour_of_day: number; weight: number }>;
  optimal_send_window: {
    best_days?: number[];
    best_hour_start?: number;
    best_hour_end?: number;
    confidence?: number;
    data_points?: number;
    timezone_guess?: string;
  };
  conversation_stage: string;
  total_replies_received: number;
  last_reply_at: string | null;
  classification_history: string[];
  demo_behavior: Record<string, any>;
  sequence_memory: Record<string, any>;
};

// Get or create the memory row for a prospect.
export async function getOrCreateMemory(prospectId: string): Promise<ProspectMemory> {
  const supa = supabaseAdmin();
  const { data } = await supa
    .from("prospect_memory")
    .select("*")
    .eq("prospect_id", prospectId)
    .maybeSingle();
  if (data) return data as ProspectMemory;
  const { data: created } = await supa
    .from("prospect_memory")
    .insert({ prospect_id: prospectId })
    .select("*")
    .single();
  return created as ProspectMemory;
}

// Recompute best-time window from reply_times[]. Timezone guess is naive:
// group by hour, pick a 2-hour window with the most points.
export function computeWindow(replyTimes: ProspectMemory["reply_times"]) {
  if (!replyTimes.length) {
    return { best_days: [], best_hour_start: 10, best_hour_end: 12, confidence: 0, data_points: 0 };
  }
  const byHour: Record<number, number> = {};
  const byDay: Record<number, number> = {};
  for (const r of replyTimes) {
    byHour[r.hour_of_day] = (byHour[r.hour_of_day] ?? 0) + (r.weight || 1);
    byDay[r.day_of_week] = (byDay[r.day_of_week] ?? 0) + (r.weight || 1);
  }
  // pick best 2-hour window
  let bestStart = 10;
  let bestSum = -1;
  for (let h = 0; h < 23; h++) {
    const sum = (byHour[h] ?? 0) + (byHour[h + 1] ?? 0);
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = h;
    }
  }
  // best days = top 3 with any hits
  const bestDays = Object.entries(byDay)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3)
    .map(([d]) => Number(d));
  const n = replyTimes.length;
  // confidence ramps up to 1.0 by 10 data points
  const confidence = Math.min(1, n / 10);
  return {
    best_days: bestDays,
    best_hour_start: bestStart,
    best_hour_end: bestStart + 2,
    confidence,
    data_points: n,
  };
}

// Record an incoming reply timestamp into memory.
export async function recordReply(
  prospectId: string,
  classification: string | null,
  when: Date = new Date(),
) {
  const supa = supabaseAdmin();
  const mem = await getOrCreateMemory(prospectId);
  const entry = {
    timestamp: when.toISOString(),
    day_of_week: when.getUTCDay(),
    hour_of_day: when.getUTCHours(),
    weight: 1,
  };
  const reply_times = [...(mem.reply_times || []), entry].slice(-100);
  const optimal_send_window = computeWindow(reply_times);
  const classification_history = classification
    ? [...(mem.classification_history || []), classification].slice(-50)
    : mem.classification_history;
  await supa
    .from("prospect_memory")
    .update({
      reply_times,
      optimal_send_window,
      classification_history,
      total_replies_received: (mem.total_replies_received || 0) + 1,
      last_reply_at: when.toISOString(),
      conversation_stage: mem.demo_link_sent ? "responded" : mem.conversation_stage,
    })
    .eq("prospect_id", prospectId);
}

// Record that a demo link was sent (locks it forever after).
export async function markDemoLinkSent(prospectId: string, messageId: string | null = null) {
  const supa = supabaseAdmin();
  await getOrCreateMemory(prospectId);
  await supa
    .from("prospect_memory")
    .update({
      demo_link_sent: true,
      demo_link_sent_at: new Date().toISOString(),
      demo_link_sent_in_message_id: messageId,
      conversation_stage: "post_demo",
    })
    .eq("prospect_id", prospectId);
}

// Update demo behavior snapshot (link_clicked, page_opened, voice_tried, etc.)
export async function updateDemoBehavior(prospectId: string, patch: Record<string, any>) {
  const supa = supabaseAdmin();
  const mem = await getOrCreateMemory(prospectId);
  const demo_behavior = { ...(mem.demo_behavior || {}), ...patch };
  await supa.from("prospect_memory").update({ demo_behavior }).eq("prospect_id", prospectId);
}

// ---------- Demo-link lock (3 layers) ----------

// Detect any URL that looks like a demo link.
const DEMO_URL_RE = /https?:\/\/[^\s)]*\/(demo|d)\/[a-z0-9-]+/gi;

export function hasDemoUrl(text: string): boolean {
  return DEMO_URL_RE.test(text);
}

// Strip any demo URL from generated text. Used when the model ignored the
// system-prompt instruction.
export function stripDemoUrls(text: string, replaceWith = ""): string {
  return text.replace(DEMO_URL_RE, replaceWith).replace(/\n{3,}/g, "\n\n").trim();
}

// Should we allow the model to include a demo link right now?
export function canSendDemoLink(memory: ProspectMemory | null | undefined): boolean {
  return !memory?.demo_link_sent;
}