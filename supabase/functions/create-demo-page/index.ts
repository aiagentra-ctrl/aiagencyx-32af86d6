import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 6);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { assistantId, businessName, description, vapiKey } = await req.json();

    if (!assistantId || !businessName || !vapiKey) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: assistantId, businessName, vapiKey" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate slug
    let slug = slugify(businessName);
    if (!slug) slug = "demo";

    // Check if slug exists
    const { data: existing } = await supabase
      .from("demo_pages")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${randomSuffix()}`;
    }

    // Insert record
    const { data, error } = await supabase.from("demo_pages").insert({
      slug,
      assistant_id: assistantId,
      business_name: businessName,
      description: description || null,
      vapi_key: vapiKey,
    }).select().single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create demo page" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine the site URL - use SITE_URL env var or fallback
    const siteUrl = Deno.env.get("SITE_URL") || `${supabaseUrl.replace('.supabase.co', '')}.netlify.app`;
    const url = `${siteUrl}/demo/${slug}`;

    // Trigger Netlify deploy (fire and forget)
    try {
      const netlifyToken = Deno.env.get("NETLIFY_API_TOKEN");
      const netlifySiteId = Deno.env.get("NETLIFY_SITE_ID");
      if (netlifyToken && netlifySiteId) {
        await fetch(
          `${supabaseUrl}/functions/v1/deploy-to-netlify`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ trigger: "new-demo-page", slug }),
          }
        );
      }
    } catch (deployErr) {
      console.error("Deploy trigger failed (non-blocking):", deployErr);
    }

    return new Response(
      JSON.stringify({ url, slug, assistantId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
