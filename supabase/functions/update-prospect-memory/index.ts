// Central endpoint to update a prospect's AI memory brain.
// Actions: record_reply | mark_demo_sent | update_behavior | recompute
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  recordReply,
  markDemoLinkSent,
  updateDemoBehavior,
  getOrCreateMemory,
  computeWindow,
} from "../_shared/memory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prospect_id, action, classification, message_id, behavior, when } = await req.json();
    if (!prospect_id || !action) {
      return new Response(JSON.stringify({ error: "prospect_id and action required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const at = when ? new Date(when) : new Date();

    switch (action) {
      case "record_reply":
        await recordReply(prospect_id, classification ?? null, at);
        break;
      case "mark_demo_sent":
        await markDemoLinkSent(prospect_id, message_id ?? null);
        break;
      case "update_behavior":
        await updateDemoBehavior(prospect_id, behavior ?? {});
        break;
      case "recompute": {
        const mem = await getOrCreateMemory(prospect_id);
        const optimal_send_window = computeWindow(mem.reply_times || []);
        await supa
          .from("prospect_memory")
          .update({ optimal_send_window })
          .eq("prospect_id", prospect_id);
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `unknown action: ${action}` }), {
          status: 400,
          headers: corsHeaders,
        });
    }

    const { data: memory } = await supa
      .from("prospect_memory")
      .select("*")
      .eq("prospect_id", prospect_id)
      .maybeSingle();

    return new Response(JSON.stringify({ ok: true, memory }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("update-prospect-memory error:", e);
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});