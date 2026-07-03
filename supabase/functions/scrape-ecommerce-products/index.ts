// 100x Advanced Shopify-first e-commerce scraper.
// - Walks /sitemap.xml + sitemap_products_*.xml + sitemap_collections_*.xml + sitemap_pages_*.xml
// - Paginates /products.json (?limit=250&page=N) until exhausted
// - Extracts logo from /meta.json, theme settings, OG tags, or homepage <img>
// - Per-product: title, body_html→plain, vendor, type, tags, handle, ALL variants
//   (price, compare_at_price, sku, available, options), ALL images, options
// - Embeds rich text per product (title + description + vendor + tags + options + variants)
// - Generic fallback: Firecrawl /v2/map + JSON-schema scrape for non-Shopify sites
// - Saves logo to chatbots.logo_url
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
import { createEmbedding } from "../_shared/openrouter.ts";

const MAX_PRODUCTS = 500;     // hard cap
const SHOPIFY_PAGE_SIZE = 250; // Shopify max
const EMBED_CONCURRENCY = 6;

const UA = "Mozilla/5.0 (compatible; LovableBot/1.0; +https://lovable.dev)";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
export interface Product {
  handle: string;
  name: string;
  description?: string;
  vendor?: string;
  category?: string;     // product_type
  tags?: string[];
  price?: number;
  compare_at_price?: number;
  currency?: string;
  in_stock?: boolean;
  image_url?: string;
  images?: string[];
  product_url: string;
  sku?: string;
  variants?: any[];
  options?: any[];
  metadata?: Record<string, any>;
}

// ────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ────────────────────────────────────────────────────────────────────────────
async function safeFetch(url: string, init?: RequestInit, timeoutMs = 15000): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, headers: { "User-Agent": UA, ...(init?.headers || {}) } });
  } catch { return null; } finally { clearTimeout(t); }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

function abs(base: string, u: string): string {
  try { return new URL(u, base).toString(); } catch { return u; }
}

// ────────────────────────────────────────────────────────────────────────────
// Embeddings (OpenRouter → text-embedding-3-small, with fallback)
// ────────────────────────────────────────────────────────────────────────────
const embed = createEmbedding;

// ────────────────────────────────────────────────────────────────────────────
// Platform detection
// ────────────────────────────────────────────────────────────────────────────
export async function detectPlatform(url: string): Promise<string> {
  const res = await safeFetch(url);
  if (!res) return "custom";
  const html = (await res.text()).slice(0, 80000).toLowerCase();
  if (html.includes("cdn.shopify.com") || html.includes("shopify.theme") || html.includes("/cdn/shop/")) return "shopify";
  if (html.includes("woocommerce") || html.includes("wc-block")) return "woocommerce";
  if (html.includes("gumroad.com")) return "gumroad";
  if (html.includes("lemonsqueezy") || html.includes("lemon.squeezy")) return "lemonsqueezy";
  if (html.includes("bigcommerce")) return "bigcommerce";
  return "custom";
}

// ────────────────────────────────────────────────────────────────────────────
// Logo / branding extraction
// ────────────────────────────────────────────────────────────────────────────
async function extractLogo(origin: string): Promise<string | null> {
  // Try Shopify shop meta first
  const meta = await safeFetch(`${origin}/meta.json`);
  if (meta?.ok) {
    try {
      const j = await meta.json();
      const lg = j?.shop?.logo || j?.logo;
      if (lg) return abs(origin, lg);
    } catch { /* ignore */ }
  }
  // Fall back to homepage parsing
  const home = await safeFetch(origin);
  if (!home?.ok) return null;
  const html = await home.text();
  // OG image
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]) return abs(origin, og[1]);
  // <link rel="apple-touch-icon">
  const apple = html.match(/<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
  if (apple?.[1]) return abs(origin, apple[1]);
  // Img with class containing "logo"
  const logoImg = html.match(/<img[^>]+(?:class|alt|id)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i)
                || html.match(/<img[^>]+src=["']([^"']+)["'][^>]+(?:class|alt|id)=["'][^"']*logo[^"']*["']/i);
  if (logoImg?.[1]) return abs(origin, logoImg[1]);
  // Favicon as last resort
  const fav = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
  if (fav?.[1]) return abs(origin, fav[1]);
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Sitemap walker
// ────────────────────────────────────────────────────────────────────────────
async function fetchSitemap(url: string): Promise<string[]> {
  const res = await safeFetch(url);
  if (!res?.ok) return [];
  const xml = await res.text();
  const locs: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) locs.push(m[1].trim());
  return locs;
}

async function walkSitemap(origin: string): Promise<{ products: string[]; collections: string[]; pages: string[]; other: string[] }> {
  const out = { products: [] as string[], collections: [] as string[], pages: [] as string[], other: [] as string[] };
  const idx = await fetchSitemap(`${origin}/sitemap.xml`);
  const subSitemaps = idx.filter(u => u.endsWith(".xml"));
  const flat = idx.filter(u => !u.endsWith(".xml"));
  const all: string[] = [...flat];
  for (const sm of subSitemaps) {
    const locs = await fetchSitemap(sm);
    all.push(...locs);
  }
  for (const u of all) {
    if (/\/products\//.test(u)) out.products.push(u);
    else if (/\/collections\//.test(u)) out.collections.push(u);
    else if (/\/pages\//.test(u)) out.pages.push(u);
    else out.other.push(u);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Shopify scraper (advanced)
// ────────────────────────────────────────────────────────────────────────────
async function scrapeShopify(baseUrl: string): Promise<{ products: Product[]; currency?: string }> {
  const origin = new URL(baseUrl).origin;
  const products: Product[] = [];
  let currency: string | undefined;

  // 1) Try shop currency
  const meta = await safeFetch(`${origin}/meta.json`);
  if (meta?.ok) {
    try { const j = await meta.json(); currency = j?.shop?.currency || j?.currency; } catch { /* ignore */ }
  }

  // 2) Paginate /products.json
  const seen = new Set<string>();
  for (let page = 1; page <= 40 && products.length < MAX_PRODUCTS; page++) {
    const res = await safeFetch(`${origin}/products.json?limit=${SHOPIFY_PAGE_SIZE}&page=${page}`);
    if (!res?.ok) break;
    let data: any;
    try { data = await res.json(); } catch { break; }
    const arr = data?.products || [];
    if (arr.length === 0) break;

    for (const p of arr) {
      if (products.length >= MAX_PRODUCTS) break;
      if (seen.has(p.handle)) continue;
      seen.add(p.handle);

      const variants = (p.variants || []).map((v: any) => ({
        id: v.id, title: v.title, sku: v.sku || null,
        price: parseFloat(v.price) || null,
        compare_at_price: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
        available: v.available !== false,
        option1: v.option1, option2: v.option2, option3: v.option3,
      }));
      const firstAvail = variants.find((v: any) => v.available) || variants[0] || {};
      const allImgs: string[] = (p.images || []).map((i: any) => i.src).filter(Boolean);
      const inStock = variants.some((v: any) => v.available);

      products.push({
        handle: p.handle,
        name: p.title,
        description: stripHtml(p.body_html || "").slice(0, 2000),
        vendor: p.vendor || undefined,
        category: p.product_type || undefined,
        tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === "string" ? p.tags.split(",").map((s: string) => s.trim()).filter(Boolean) : []),
        price: firstAvail.price ?? undefined,
        compare_at_price: firstAvail.compare_at_price ?? undefined,
        currency: currency || "USD",
        in_stock: inStock,
        image_url: allImgs[0] || p.image?.src,
        images: allImgs,
        product_url: `${origin}/products/${p.handle}`,
        sku: firstAvail.sku || undefined,
        variants,
        options: p.options || [],
        metadata: { published_at: p.published_at, created_at: p.created_at, updated_at: p.updated_at },
      });
    }
    if (arr.length < SHOPIFY_PAGE_SIZE) break;
  }

  // 3) Backfill from sitemap if /products.json blocked
  if (products.length === 0) {
    const sm = await walkSitemap(origin);
    const urls = sm.products.slice(0, MAX_PRODUCTS);
    for (const u of urls) {
      const jsonUrl = u.replace(/\/?$/, "") + ".json";
      const r = await safeFetch(jsonUrl);
      if (!r?.ok) continue;
      try {
        const j = await r.json();
        const p = j.product;
        if (!p || seen.has(p.handle)) continue;
        seen.add(p.handle);
        const variants = (p.variants || []).map((v: any) => ({
          id: v.id, title: v.title, sku: v.sku || null,
          price: parseFloat(v.price) || null,
          compare_at_price: v.compare_at_price ? parseFloat(v.compare_at_price) : null,
          available: v.available !== false,
        }));
        const firstAvail = variants.find((v: any) => v.available) || variants[0] || {};
        const allImgs: string[] = (p.images || []).map((i: any) => i.src).filter(Boolean);
        products.push({
          handle: p.handle, name: p.title,
          description: stripHtml(p.body_html || "").slice(0, 2000),
          vendor: p.vendor, category: p.product_type,
          tags: Array.isArray(p.tags) ? p.tags : [],
          price: firstAvail.price ?? undefined,
          compare_at_price: firstAvail.compare_at_price ?? undefined,
          currency: currency || "USD",
          in_stock: variants.some((v: any) => v.available),
          image_url: allImgs[0], images: allImgs,
          product_url: u, sku: firstAvail.sku,
          variants, options: p.options || [],
        });
      } catch { /* ignore */ }
      if (products.length >= MAX_PRODUCTS) break;
    }
  }

  return { products, currency };
}

// ────────────────────────────────────────────────────────────────────────────
// Generic Firecrawl scraper (non-Shopify)
// ────────────────────────────────────────────────────────────────────────────
async function scrapeGeneric(baseUrl: string): Promise<Product[]> {
  if (!FIRECRAWL_KEY) return [];
  const origin = new URL(baseUrl).origin;

  // Try sitemap first
  const sm = await walkSitemap(origin);
  let productUrls = sm.products;

  // Else use Firecrawl /v2/map
  if (productUrls.length === 0) {
    const mapRes = await safeFetch("https://api.firecrawl.dev/v2/map", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: baseUrl, limit: 500, includeSubdomains: false }),
    });
    if (mapRes?.ok) {
      const md = await mapRes.json();
      const all: string[] = md.links || [];
      const re = /\/(products?|p|item|shop|store)\//i;
      productUrls = all.filter(u => re.test(u));
    }
  }
  productUrls = productUrls.slice(0, MAX_PRODUCTS);
  if (productUrls.length === 0) return [];

  const schema = {
    type: "object",
    properties: {
      name: { type: "string" }, description: { type: "string" },
      price: { type: "number" }, compare_at_price: { type: "number" },
      currency: { type: "string" }, image_url: { type: "string" },
      images: { type: "array", items: { type: "string" } },
      sku: { type: "string" }, category: { type: "string" },
      vendor: { type: "string" }, in_stock: { type: "boolean" },
    },
    required: ["name"],
  };

  const products: Product[] = [];
  const batch = 5;
  for (let i = 0; i < productUrls.length; i += batch) {
    const slice = productUrls.slice(i, i + batch);
    const results = await Promise.all(slice.map(async (url) => {
      const r = await safeFetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: [{ type: "json", schema }], onlyMainContent: true }),
      }, 30000);
      if (!r?.ok) return null;
      const d = await r.json().catch(() => null);
      const j = d?.json || d?.data?.json;
      if (!j?.name) return null;
      const handle = url.split("/").filter(Boolean).pop() || j.name.toLowerCase().replace(/\s+/g, "-");
      return {
        handle, name: j.name,
        description: j.description || "",
        vendor: j.vendor, category: j.category,
        tags: [],
        price: typeof j.price === "number" ? j.price : parseFloat(j.price) || undefined,
        compare_at_price: typeof j.compare_at_price === "number" ? j.compare_at_price : undefined,
        currency: j.currency || "USD",
        in_stock: j.in_stock !== false,
        image_url: j.image_url, images: j.images || (j.image_url ? [j.image_url] : []),
        product_url: url, sku: j.sku,
      } as Product;
    }));
    for (const r of results) if (r) products.push(r);
  }
  return products;
}

// ────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ────────────────────────────────────────────────────────────────────────────
export async function scrapeProducts(websiteUrl: string, platform?: string): Promise<{ products: Product[]; platform: string; logo?: string | null }> {
  const origin = new URL(websiteUrl).origin;
  const plat = platform || await detectPlatform(websiteUrl);
  let products: Product[] = [];
  if (plat === "shopify") {
    const r = await scrapeShopify(websiteUrl);
    products = r.products;
  }
  if (products.length === 0) {
    products = await scrapeGeneric(websiteUrl);
  }
  const logo = await extractLogo(origin).catch(() => null);
  return { products, platform: plat, logo };
}

// Build rich, semantic embedding text per product — improves RAG recall on
// natural-language queries ("something for running", "under $50", etc.).
function embeddingText(p: Product): string {
  const parts: string[] = [];

  // Primary identity
  parts.push(p.name);
  if (p.category) parts.push(`Category: ${p.category}`);
  if (p.vendor) parts.push(`Brand: ${p.vendor}`);

  // Tags — both flat and natural-language framing
  if (p.tags?.length) {
    parts.push(`Tags: ${p.tags.join(", ")}`);
    parts.push(`This product is: ${p.tags.join(", ")}`);
  }

  // Options (critical for apparel/fitness/etc.)
  const optionNames = (p.options || []).map((o: any) => o?.name).filter(Boolean);
  if (optionNames.length) {
    parts.push(`Available options: ${optionNames.join(", ")}`);
    for (const opt of p.options || []) {
      if (opt?.name && Array.isArray(opt?.values) && opt.values.length) {
        parts.push(`${opt.name}: ${opt.values.join(", ")}`);
      }
    }
  }

  // Price context
  const variantPrices = (p.variants || [])
    .map((v: any) => parseFloat(v?.price))
    .filter((n: number) => !Number.isNaN(n));
  if (variantPrices.length) {
    const minPrice = Math.min(...variantPrices);
    const maxPrice = Math.max(...variantPrices);
    parts.push(minPrice === maxPrice ? `Price: $${minPrice}` : `Price range: $${minPrice} to $${maxPrice}`);
  } else if (p.price != null) {
    parts.push(`Price: $${p.price}${p.compare_at_price ? ` (was $${p.compare_at_price})` : ""}`);
  }

  // Stock
  const inStock = (p.variants || []).some((v: any) => v?.available) || p.in_stock !== false;
  parts.push(inStock ? "In stock" : "Out of stock");

  // Cleaned description
  if (p.description) {
    const clean = String(p.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
    if (clean) parts.push(clean);
  }

  return parts.join(". ");
}

export async function saveProducts(chatbotId: string, products: Product[]): Promise<number> {
  if (products.length === 0) return 0;
  await supabase.from("products").delete().eq("chatbot_id", chatbotId);

  let saved = 0;
  // embed with bounded concurrency
  for (let i = 0; i < products.length; i += EMBED_CONCURRENCY) {
    const slice = products.slice(i, i + EMBED_CONCURRENCY);
    const embs = await Promise.all(slice.map(p => embed(embeddingText(p))));
    const rows = slice.map((p, idx) => ({
      chatbot_id: chatbotId,
      handle: p.handle,
      name: p.name,
      description: p.description || null,
      vendor: p.vendor || null,
      category: p.category || null,
      tags: p.tags || [],
      price: p.price ?? null,
      compare_at_price: p.compare_at_price ?? null,
      currency: p.currency || "USD",
      in_stock: p.in_stock !== false,
      image_url: p.image_url || null,
      images: p.images || [],
      product_url: p.product_url,
      sku: p.sku || null,
      variants: p.variants || [],
      options: p.options || [],
      metadata: p.metadata || {},
      embedding: embs[idx] as any,
    }));
    const { error } = await supabase.from("products").insert(rows);
    if (!error) saved += rows.length;
    else console.warn("insert error", error.message);
  }

  await supabase.from("chatbots").update({ product_count: saved }).eq("id", chatbotId);
  return saved;
}

// ────────────────────────────────────────────────────────────────────────────
// HTTP handler
// ────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { chatbotId, websiteUrl, platform } = await req.json();
    if (!chatbotId || !websiteUrl) {
      return new Response(JSON.stringify({ error: "chatbotId and websiteUrl required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { products, platform: plat, logo } = await scrapeProducts(websiteUrl, platform);
    const saved = await saveProducts(chatbotId, products);

    // Persist platform + logo on the chatbot
    const update: any = { store_platform: plat };
    if (logo) update.logo_url = logo;
    await supabase.from("chatbots").update(update).eq("id", chatbotId);

    return new Response(JSON.stringify({
      saved, scraped: products.length, platform: plat, logo,
      sample: products.slice(0, 3).map(p => ({ name: p.name, price: p.price, image: p.image_url })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
