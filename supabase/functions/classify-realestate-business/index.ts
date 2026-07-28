// Real estate business classifier — reads the scraped agency record + listing sample
// and returns a structured profile used to configure the voice agent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chatCompletion, MODELS } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SYSTEM = `You are a business analyst that reads real estate website content and
produces a structured profile used to configure a voice AI agent. Output
ONLY valid JSON matching the schema below — no prose, no markdown fences.

Infer conservatively. If content doesn't clearly support a field, use
null or an empty array. Do not invent business facts not evidenced in
the provided text.

Schema:
{
  "business_type": "brokerage | solo_agent | property_management | rental_agency | commercial_only",
  "core_job": ["lead_qualification", "booking_showings", "general_qa"],
  "service_area": ["city/region names found in the text"],
  "property_types": ["residential", "commercial", "rental", "land"],
  "tone_signals": "one paragraph on brand voice from actual copy",
  "key_differentiators": ["only claims actually stated on the site"],
  "compliance_notes": ["financing partners, in-house lending, PM fees, fair housing statement presence"],
  "suggested_agent_persona_name": "a name fitting tone_signals, or null",
  "confidence": "high | medium | low"
}

booking_showings is ONLY allowed if contact.booking_widget_detected is true.
A static contact form is lead_qualification, not booking_showings.`;

function parseJson(raw: string): any | null {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* try substring */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { chatbot_id } = await req.json();
    if (!chatbot_id) {
      return new Response(JSON.stringify({ error: "chatbot_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profileRow } = await supabase
      .from("realestate_profiles").select("*").eq("chatbot_id", chatbot_id).maybeSingle();
    if (!profileRow?.agency_record) {
      return new Response(JSON.stringify({ error: "no scraped agency record for this chatbot" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: listings } = await supabase
      .from("property_listings")
      .select("address, city, price, status, bedrooms, bathrooms, sqft, property_type, description_raw")
      .eq("chatbot_id", chatbot_id)
      .limit(12);

    const agency = profileRow.agency_record as any;
    const userMsg = JSON.stringify({
      agency_record: agency,
      listing_sample: (listings || []).map((l) => ({ ...l, description_raw: (l.description_raw || "").slice(0, 400) })),
      faq_pairs: agency?.raw_faq_pairs?.slice(0, 15) || [],
    }).slice(0, 24000);

    const res = await chatCompletion(MODELS.agent, [
      { role: "system", content: SYSTEM },
      { role: "user", content: userMsg },
    ], { temperature: 0.1, max_tokens: 1600, response_format: { type: "json_object" } });

    const parsed = res ? parseJson(res.content) : null;
    if (!parsed) {
      return new Response(JSON.stringify({ error: "classification failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bookingDetected = !!agency?.contact?.booking_widget_detected;
    let coreJob: string[] = Array.isArray(parsed.core_job) ? parsed.core_job : [];
    if (!bookingDetected) coreJob = coreJob.filter((j) => j !== "booking_showings");
    if (!coreJob.length) coreJob = ["lead_qualification", "general_qa"];

    const confidence = ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low";

    const update = {
      business_type: parsed.business_type || null,
      core_job: coreJob,
      service_area: parsed.service_area || [],
      property_types: parsed.property_types || [],
      tone_signals: parsed.tone_signals || null,
      key_differentiators: parsed.key_differentiators || [],
      compliance_notes: parsed.compliance_notes || [],
      suggested_agent_persona_name: parsed.suggested_agent_persona_name || null,
      confidence,
      booking_widget_detected: bookingDetected,
      needs_human_review: confidence === "low",
    };

    await supabase.from("realestate_profiles").update(update).eq("chatbot_id", chatbot_id);

    return new Response(JSON.stringify({ ok: true, profile: { chatbot_id, ...update } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-realestate-business error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});