import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
import { createEmbedding, chatCompletion, MODELS } from "../_shared/openrouter.ts";

const MAX_PAGES = 25;
const CHUNK_SIZE = 1200; // chars

function chunkText(text: string, size = CHUNK_SIZE): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= size) return [clean];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += size) out.push(clean.slice(i, i + size));
  return out;
}

const embed = createEmbedding;

async function fcMap(url: string): Promise<string[]> {
  const res = await fetch("https://api.firecrawl.dev/v2/map", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, limit: 50, includeSubdomains: false }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.links || []).slice(0, MAX_PAGES);
}

async function fcScrape(url: string): Promise<{ markdown: string; title?: string } | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const md = data?.markdown || data?.data?.markdown;
    const title = data?.metadata?.title || data?.data?.metadata?.title;
    return md ? { markdown: md, title } : null;
  } catch { return null; }
}

function classify(url: string, title?: string): string {
  const u = url.toLowerCase();
  const t = (title || "").toLowerCase();
  if (/property|listing|home|house|apartment|condo|villa|rent|sale/.test(u + t)) return "property";
  if (/agent|team|about/.test(u + t)) return "agent";
  if (/faq|question/.test(u + t)) return "faq";
  if (/service|offer/.test(u + t)) return "service";
  return "page";
}

// ── KB Architect: LLM generates dual KBs + core facts from scraped content ──
async function architectKnowledgeBase(
  businessName: string,
  websiteUrl: string,
  industry: string,
  combinedMarkdown: string,
): Promise<{ chatbot_kb_md: string; voice_kb_text: string; prompt_core: any } | null> {
  if (!LOVABLE_KEY) return null;

  const systemPrompt = `You are a Knowledge Base Architect. Using the scraped business website data, produce a JSON object with three fields:

1. "chatbot_kb_md" — structured markdown for a chatbot RAG pipeline. Sections in this order:
   ## Business Overview
   ## Services / Products (with prices if found)
   ## FAQs (at least 20 Q&A pairs — infer realistic questions for this industry)
   ## Pricing & Packages
   ## Policies (cancellation, refund, hours, etc.)
   ## Common Objections & Responses (at least 5)
   ## Contact Information
   Fill gaps logically based on industry norms. Mark any unverifiable facts with [DATA NEEDED].

2. "voice_kb_text" — conversational spoken-language plain text for a voice agent. NO markdown, NO bullets, NO headers. Flowing paragraphs only. Must include: caller intent handling, escalation rules, tone guide, key facts spoken naturally, and a "things the agent must never say" paragraph.

3. "prompt_core" — compact JSON of TOP business facts for instant in-prompt answers (no retrieval needed). Shape:
{
  "business": "name",
  "location": "city/area or address",
  "services": ["top 5"],
  "pricing_summary": "1-2 sentence summary",
  "hours": "spoken-friendly hours string",
  "contact": { "phone": "...", "email": "..." },
  "top_objections": [{ "objection": "...", "response": "..." }],
  "escalation": "when/how to escalate to human",
  "tone": "warm, professional, conversational, etc.",
  "top_intents": ["book appointment", "check pricing", "ask hours", ...]
}

Use [DATA NEEDED] strings inside prompt_core for missing fields. Return ONLY raw JSON, no markdown code fences.`;

  const userPrompt = `BUSINESS: ${businessName}
WEBSITE: ${websiteUrl}
INDUSTRY: ${industry || "general"}

SCRAPED CONTENT:
${combinedMarkdown.slice(0, 60000)}`;

  try {
    const result = await chatCompletion(MODELS.kb_build, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], { temperature: 0.2, max_tokens: 4000, response_format: { type: "json_object" } });
    if (!result) {
      console.error("Architect call failed");
      return null;
    }
    const raw = result.content || "";
    const cleaned = raw.replace(/^```json\s*|```$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.chatbot_kb_md || !parsed.voice_kb_text || !parsed.prompt_core) return null;
    return parsed;
  } catch (e) {
    console.error("Architect parse error", e);
    return null;
  }
}

async function runJob(jobId: string, chatbotId: string, websiteUrl: string) {
  try {
    await supabase.from("knowledge_base_jobs").update({ status: "scraping" }).eq("id", jobId);

    if (!FIRECRAWL_KEY) throw new Error("FIRECRAWL_API_KEY missing");

    // Fetch chatbot meta for architect phase
    const { data: cbMeta } = await supabase
      .from("chatbots").select("business_name, industry, store_platform").eq("id", chatbotId).single();

    const isEcommerce = ((cbMeta?.industry || "").toLowerCase().includes("ecommerce")
      || (cbMeta?.industry || "").toLowerCase().includes("shop")
      || (cbMeta?.industry || "").toLowerCase().includes("store")
      || (cbMeta?.industry || "").toLowerCase().includes("retail"));

    // Fire ecommerce product scraper in parallel (fire-and-forget — it has its own DB writes)
    if (isEcommerce) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        // Don't await — runs alongside KB scraping
        fetch(`${supabaseUrl}/functions/v1/scrape-ecommerce-products`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ chatbotId, websiteUrl, platform: cbMeta?.store_platform }),
        }).catch((e) => console.warn("product scrape failed", e));
      } catch (e) { console.warn("product scrape dispatch failed", e); }
    }

    const urls = await fcMap(websiteUrl);
    if (urls.length === 0) urls.push(websiteUrl);

    // wipe old entries for this chatbot
    await supabase.from("knowledge_base_entries").delete().eq("chatbot_id", chatbotId);

    let pagesScraped = 0;
    let entriesCreated = 0;
    const allPagesMd: string[] = [];

    // Scrape concurrently in batches of 5
    const batchSize = 5;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const scraped = await Promise.all(batch.map(fcScrape));
      for (let j = 0; j < scraped.length; j++) {
        const s = scraped[j];
        const url = batch[j];
        if (!s) continue;
        pagesScraped++;
        allPagesMd.push(`# ${s.title || url}\n${s.markdown}`);
        const chunks = chunkText(s.markdown);
        const contentType = classify(url, s.title);
        for (const chunk of chunks) {
          const emb = await embed(chunk);
          if (!emb) continue;
          const { error } = await supabase.from("knowledge_base_entries").insert({
            chatbot_id: chatbotId,
            source_url: url,
            content_type: contentType,
            title: s.title || null,
            content: chunk,
            embedding: emb as any,
          });
          if (!error) entriesCreated++;
        }
      }
      await supabase.from("knowledge_base_jobs").update({
        pages_scraped: pagesScraped, entries_created: entriesCreated, status: "embedding",
      }).eq("id", jobId);
    }

    // ── Architect phase: generate dual KBs + core facts ──
    await supabase.from("knowledge_base_jobs").update({ status: "architecting" }).eq("id", jobId);

    const combined = allPagesMd.join("\n\n---\n\n");
    const architected = await architectKnowledgeBase(
      cbMeta?.business_name || "the business",
      websiteUrl,
      cbMeta?.industry || "",
      combined,
    );

    if (architected) {
      // Save dual KBs + prompt_core to chatbots row
      await supabase.from("chatbots").update({
        kb_chatbot_md: architected.chatbot_kb_md,
        kb_voice_text: architected.voice_kb_text,
        prompt_core: architected.prompt_core,
      }).eq("id", chatbotId);

      // Also chunk + embed the high-quality chatbot_kb_md for better RAG retrieval
      const kbChunks = chunkText(architected.chatbot_kb_md, 1500);
      for (const chunk of kbChunks) {
        const emb = await embed(chunk);
        if (!emb) continue;
        const { error } = await supabase.from("knowledge_base_entries").insert({
          chatbot_id: chatbotId,
          source_url: websiteUrl,
          content_type: "architected",
          title: "Curated KB",
          content: chunk,
          embedding: emb as any,
        });
        if (!error) entriesCreated++;
      }
    }

    await supabase.from("knowledge_base_jobs").update({
      status: "done", pages_scraped: pagesScraped, entries_created: entriesCreated,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    await supabase.from("knowledge_base_jobs").update({
      status: "failed", error: msg, completed_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { chatbotId, websiteUrl } = await req.json();
    if (!chatbotId || !websiteUrl) {
      return new Response(JSON.stringify({ error: "chatbotId and websiteUrl required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error } = await supabase.from("knowledge_base_jobs").insert({
      chatbot_id: chatbotId, website_url: websiteUrl, status: "queued",
    }).select().single();
    if (error || !job) throw new Error(error?.message || "failed to queue");

    // Fire-and-forget
    // @ts-ignore EdgeRuntime
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(runJob(job.id, chatbotId, websiteUrl));
    } else {
      runJob(job.id, chatbotId, websiteUrl);
    }

    return new Response(JSON.stringify({ jobId: job.id, status: "queued" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
