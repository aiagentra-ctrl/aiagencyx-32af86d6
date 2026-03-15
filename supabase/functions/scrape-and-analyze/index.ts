import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

  try {
    const { businessName, websiteUrl } = await req.json();

    if (!businessName || !websiteUrl) {
      return new Response(
        JSON.stringify({ error: "businessName and websiteUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ error: "Firecrawl is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(
        JSON.stringify({ error: "AI service is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Scrape website with Firecrawl
    let formattedUrl = websiteUrl.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Scraping:", formattedUrl);

    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    const scrapeData = await scrapeRes.json();
    if (!scrapeRes.ok) {
      console.error("Firecrawl error:", scrapeData);
      if (scrapeRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "Firecrawl credits exhausted. Please top up." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Failed to scrape website" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const websiteContent = scrapeData.data?.markdown || scrapeData.markdown || "";
    console.log("Scraped content length:", websiteContent.length);

    // Step 2: Analyze with Lovable AI using tool calling for structured output
    const analysisPrompt = `Analyze this business website content and extract structured information.

Business Name: ${businessName}
Website URL: ${formattedUrl}

Website Content:
${websiteContent.substring(0, 8000)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are a business analyst. Analyze the website content and extract structured business information. Call the provided tool with accurate data.",
          },
          { role: "user", content: analysisPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_business",
              description: "Return structured business analysis from website content",
              parameters: {
                type: "object",
                properties: {
                  industry: { type: "string", description: "Business industry/sector" },
                  brand_tone: { type: "string", description: "Brand communication tone (e.g. professional, friendly, casual)" },
                  services: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of services or products offered",
                  },
                  faq_topics: {
                    type: "array",
                    items: { type: "string" },
                    description: "Suggested FAQ topics for a chatbot",
                  },
                  system_prompt: {
                    type: "string",
                    description: "A complete chatbot system prompt tailored to this business. Include the business name, tone, services, and instructions for the AI assistant.",
                  },
                },
                required: ["industry", "brand_tone", "services", "faq_topics", "system_prompt"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_business" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let analysis: any;

    if (toolCall?.function?.arguments) {
      analysis = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback
      analysis = {
        industry: "General",
        brand_tone: "Professional and friendly",
        services: [],
        faq_topics: [],
        system_prompt: `You are an AI assistant for ${businessName}. Help customers with their questions about the business services. Be professional and helpful.`,
      };
    }

    // Step 3: Save chatbot to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let slug = slugify(businessName);
    if (!slug) slug = "chatbot";

    const { data: existing } = await supabase
      .from("chatbots")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${randomSuffix()}`;
    }

    const { data: chatbot, error: insertError } = await supabase
      .from("chatbots")
      .insert({
        business_name: businessName,
        website_url: formattedUrl,
        slug,
        system_prompt: analysis.system_prompt,
        industry: analysis.industry,
        brand_tone: analysis.brand_tone,
        services: analysis.services,
        faq_topics: analysis.faq_topics,
        research_data: {
          website_content_preview: websiteContent.substring(0, 2000),
          analyzed_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save chatbot" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build clean URL
    const siteDomain = Deno.env.get("SITE_DOMAIN");
    let chatbotUrl: string;
    if (siteDomain) {
      chatbotUrl = `https://${siteDomain}/${slug}/chatbot`;
    } else {
      chatbotUrl = `/${slug}/chatbot`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        chatbot_url: chatbotUrl,
        slug,
        analysis: {
          industry: analysis.industry,
          brand_tone: analysis.brand_tone,
          services: analysis.services,
          faq_topics: analysis.faq_topics,
          system_prompt: analysis.system_prompt,
        },
        chatbot,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
