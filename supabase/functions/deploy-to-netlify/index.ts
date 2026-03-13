const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const netlifyToken = Deno.env.get("NETLIFY_API_TOKEN");
    if (!netlifyToken) {
      return new Response(
        JSON.stringify({ error: "NETLIFY_API_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const netlifySiteId = Deno.env.get("NETLIFY_SITE_ID");
    if (!netlifySiteId) {
      return new Response(
        JSON.stringify({ error: "NETLIFY_SITE_ID not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    console.log("Deploy triggered:", body);

    // Since the app uses dynamic routes that fetch data from Supabase at runtime,
    // redeployment is only needed when frontend code changes.
    // This function is a placeholder for triggering deploys via the Netlify API.
    // 
    // To deploy, you would:
    // 1. Build the frontend (npm run build)
    // 2. Zip the dist/ folder
    // 3. POST the zip to Netlify API
    //
    // For now, this triggers a rebuild of the existing site using Netlify's build hook
    // or you can upload a pre-built zip file.

    // Trigger a new deploy using Netlify's API (triggers a rebuild)
    const response = await fetch(
      `https://api.netlify.com/api/v1/sites/${netlifySiteId}/builds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${netlifyToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Netlify API error [${response.status}]:`, errorBody);
      return new Response(
        JSON.stringify({ error: `Netlify deploy failed: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log("Netlify deploy triggered:", result.id);

    return new Response(
      JSON.stringify({ success: true, deployId: result.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Deploy error:", err);
    return new Response(
      JSON.stringify({ error: "Deploy failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
