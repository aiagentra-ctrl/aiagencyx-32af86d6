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
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

const MAX_PAGES = 25;
const CHUNK_SIZE = 1200; // chars

function chunkText(text: string, size = CHUNK_SIZE): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= size) return [clean];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += size) out.push(clean.slice(i, i + size));
  return out;
}

async function embed(text: string): Promise<number[] | null> {
  if (!LOVABLE_KEY) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/text-embedding-3-small", input: text.slice(0, 8000) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch { return null; }
}

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

async function runJob(jobId: string, chatbotId: string, websiteUrl: string) {
  try {
    await supabase.from("knowledge_base_jobs").update({ status: "scraping" }).eq("id", jobId);

    if (!FIRECRAWL_KEY) throw new Error("FIRECRAWL_API_KEY missing");

    const urls = await fcMap(websiteUrl);
    if (urls.length === 0) urls.push(websiteUrl);

    // wipe old entries for this chatbot
    await supabase.from("knowledge_base_entries").delete().eq("chatbot_id", chatbotId);

    let pagesScraped = 0;
    let entriesCreated = 0;

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
