// Scrapes products from an e-commerce store via Firecrawl (Shopify fast-path + generic).
// Called internally by build-knowledge-base when industry=ecommerce, or directly via HTTP.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

const MAX_PRODUCTS = 30;

export interface Product {
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  image_url?: string;
  product_url: string;
  sku?: string;
  category?: string;
  tags?: string[];
}

async function embed(text: string): Promise<number[] | null> {
  if (!LOVABLE_KEY) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/text-embedding-3-small", input: text.slice(0, 4000) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch { return null; }
}

// Detect platform from URL + page content
export async function detectPlatform(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = (await res.text()).slice(0, 50000).toLowerCase();
    if (html.includes("cdn.shopify.com") || html.includes("shopify.theme")) return "shopify";
    if (html.includes("woocommerce") || html.includes("wc-block")) return "woocommerce";
    if (html.includes("gumroad.com")) return "gumroad";
    if (html.includes("lemonsqueezy") || html.includes("lemon.squeezy")) return "lemonsqueezy";
    if (html.includes("bigcommerce")) return "bigcommerce";
    if (html.includes("squarespace") && html.includes("commerce")) return "squarespace";
    return "custom";
  } catch {
    return "custom";
  }
}

// Shopify fast-path: /products.json is public on most stores
async function scrapeShopify(baseUrl: string): Promise<Product[]> {
  try {
    const u = new URL(baseUrl);
    const url = `${u.origin}/products.json?limit=${MAX_PRODUCTS}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const products: Product[] = [];
    for (const p of (data.products || []).slice(0, MAX_PRODUCTS)) {
      const variant = p.variants?.[0] || {};
      products.push({
        name: p.title,
        description: (p.body_html || "").replace(/<[^>]+>/g, "").slice(0, 500),
        price: parseFloat(variant.price) || undefined,
        currency: "USD",
        image_url: p.images?.[0]?.src || p.image?.src,
        product_url: `${u.origin}/products/${p.handle}`,
        sku: variant.sku || undefined,
        category: p.product_type || undefined,
        tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === "string" ? p.tags.split(",").map((s: string) => s.trim()) : []),
      });
    }
    return products;
  } catch (e) {
    console.warn("Shopify fast-path failed", e);
    return [];
  }
}

// Generic: map URLs filtered to product-like paths, then scrape with JSON schema
async function scrapeGeneric(baseUrl: string): Promise<Product[]> {
  if (!FIRECRAWL_KEY) return [];

  // 1. Map URLs
  const mapRes = await fetch("https://api.firecrawl.dev/v2/map", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url: baseUrl, limit: 200, includeSubdomains: false }),
  });
  if (!mapRes.ok) return [];
  const mapData = await mapRes.json();
  const allUrls: string[] = mapData.links || [];

  // Filter product-like URLs
  const productRegex = /\/(products?|p|item|shop|store|collections?\/[^/]+\/products)\//i;
  const productUrls = allUrls.filter(u => productRegex.test(u)).slice(0, MAX_PRODUCTS);

  if (productUrls.length === 0) return [];

  const schema = {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      price: { type: "number" },
      currency: { type: "string" },
      image_url: { type: "string" },
      sku: { type: "string" },
      category: { type: "string" },
    },
    required: ["name"],
  };

  // 2. Scrape each (batched concurrency)
  const products: Product[] = [];
  const batchSize = 4;
  for (let i = 0; i < productUrls.length; i += batchSize) {
    const batch = productUrls.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (url) => {
      try {
        const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            formats: [{ type: "json", schema }],
            onlyMainContent: true,
          }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const j = data?.json || data?.data?.json;
        if (!j?.name) return null;
        return {
          name: j.name,
          description: j.description || "",
          price: typeof j.price === "number" ? j.price : (parseFloat(j.price) || undefined),
          currency: j.currency || "USD",
          image_url: j.image_url || "",
          product_url: url,
          sku: j.sku || undefined,
          category: j.category || undefined,
          tags: [],
        } as Product;
      } catch { return null; }
    }));
    for (const r of results) if (r) products.push(r);
  }
  return products;
}

export async function scrapeProducts(websiteUrl: string, platform?: string): Promise<Product[]> {
  const plat = platform || await detectPlatform(websiteUrl);
  let products: Product[] = [];
  if (plat === "shopify") {
    products = await scrapeShopify(websiteUrl);
  }
  if (products.length === 0) {
    products = await scrapeGeneric(websiteUrl);
  }
  return products;
}

export async function saveProducts(chatbotId: string, products: Product[]): Promise<number> {
  if (products.length === 0) return 0;

  // Wipe existing
  await supabase.from("products").delete().eq("chatbot_id", chatbotId);

  let saved = 0;
  for (const p of products) {
    const embText = `${p.name}. ${p.description || ""}. ${p.category || ""}. ${(p.tags || []).join(" ")}`;
    const emb = await embed(embText);
    const { error } = await supabase.from("products").insert({
      chatbot_id: chatbotId,
      name: p.name,
      description: p.description || null,
      price: p.price ?? null,
      currency: p.currency || "USD",
      image_url: p.image_url || null,
      product_url: p.product_url,
      sku: p.sku || null,
      category: p.category || null,
      tags: p.tags || [],
      embedding: emb as any,
    });
    if (!error) saved++;
  }

  await supabase.from("chatbots").update({ product_count: saved }).eq("id", chatbotId);
  return saved;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { chatbotId, websiteUrl, platform } = await req.json();
    if (!chatbotId || !websiteUrl) {
      return new Response(JSON.stringify({ error: "chatbotId and websiteUrl required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const products = await scrapeProducts(websiteUrl, platform);
    const saved = await saveProducts(chatbotId, products);
    return new Response(JSON.stringify({ saved, scraped: products.length, platform: platform || "auto" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
