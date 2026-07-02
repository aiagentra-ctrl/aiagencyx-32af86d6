import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function csvEscape(v: any): string {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("sequence_template_id") || (await req.json().catch(() => ({}))).sequence_template_id;
    if (!id) return new Response("sequence_template_id required", { status: 400, headers: cors });
    const [{ data: seq }, { data: enr }] = await Promise.all([
      supabase.from("follow_up_sequences_templates").select("name").eq("id", id).maybeSingle(),
      supabase.from("follow_up_enrollments").select("*, prospects(email,firstname,company)").eq("sequence_template_id", id),
    ]);
    const header = ["prospect_email","firstname","company","enrolled_at","assigned_variant","current_step","status","replied_at","reply_classification","sequence_name"];
    const rows = [header.join(",")];
    for (const e of enr || []) {
      const p = (e as any).prospects || {};
      rows.push([p.email, p.firstname, p.company, e.started_at, e.assigned_variant, e.current_step, e.status, e.replied_at, e.reply_classification, seq?.name].map(csvEscape).join(","));
    }
    return new Response(rows.join("\n"), {
      headers: { ...cors, "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="sequence-${id}.csv"` },
    });
  } catch (e) {
    return new Response(String((e as any)?.message || e), { status: 500, headers: cors });
  }
});