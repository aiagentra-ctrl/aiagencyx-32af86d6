// Real estate scraper — crawls an agency site into structured listing + agency records.
// Listings → public.property_listings (embedded for RAG)
// Agency/FAQ/policy pages → public.knowledge_base_entries (existing RAG path)
// Agency record → public.realestate_profiles.agency_record
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEmbedding } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const UA = "Mozilla/5.0 (compatible; LovableBot/1.0; +https://lovable.dev)";
const MAX_LISTINGS = 200;
const MAX_SUPPORT_PAGES = 25;
const RATE_LIMIT_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function safeFetch(url: string, timeoutMs = 15000): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctl.signal, headers: { "User-Agent": UA } });
  } catch { return null; } finally { clearTimeout(t); }
}

function stripBoilerplate(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function abs(base: string, u: string): string {
  try { return new URL(u, base).toString(); } catch { return u; }
}

// ── robots.txt ──────────────────────────────────────────────────────────────
async function loadDisallowed(origin: string): Promise<string[]> {
  const res = await safeFetch(`${origin}/robots.txt`, 8000);
  if (!res?.ok) return [];
  const txt = await res.text();
  const out: string[] = [];
  let applies = false;
  for (const raw of txt.split("\n")) {
    const line = raw.trim().toLowerCase();
    if (line.startsWith("user-agent:")) applies = line.includes("*");
    else if (applies && line.startsWith("disallow:")) {
      const p = line.slice(9).trim();
      if (p) out.push(p);
    }
  }
  return out;
}

function allowed(url: string, origin: string, disallowed: string[]): boolean {
  try {
    const path = new URL(url).pathname;
    return !disallowed.some((d) => path.startsWith(d));
  } catch { return false; }
}

// ── link discovery ──────────────────────────────────────────────────────────
const LISTING_RE = /\/(listing|listings|property|properties|homes?-for-sale|for-sale|for-rent|rentals?|mls|idx)\//i;
const SUPPORT_RE = /\/(about|team|agents?|buy|buying|sell|selling|rent|renting|property-management|contact|schedule|book|faq|resources|testimonials|reviews|privacy|terms|fair-housing|disclosure)/i;

async function collectLinks(origin: string): Promise<string[]> {
  const urls = new Set<string>();

  // sitemap first
  const smRes = await safeFetch(`${origin}/sitemap.xml`);
  if (smRes?.ok) {
    const xml = await smRes.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());
    for (const loc of locs) {
      if (/\.xml$/i.test(loc)) {
        const sub = await safeFetch(loc);
        if (sub?.ok) {
          const subXml = await sub.text();
          for (const m of subXml.matchAll(/<loc>([^<]+)<\/loc>/gi)) urls.add(m[1].trim());
        }
        await sleep(RATE_LIMIT_MS);
      } else urls.add(loc);
      if (urls.size > 2000) break;
    }
  }

  // homepage anchors as fallback / supplement
  const home = await safeFetch(origin);
  if (home?.ok) {
    const html = await home.text();
    for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
      const u = abs(origin, m[1]);
      if (u.startsWith(origin)) urls.add(u);
    }
  }
  return [...urls];
}

// ── listing extraction ──────────────────────────────────────────────────────
function num(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function propertyType(text: string): string | null {
  const t = text.toLowerCase();
  if (/\bcondo|condominium\b/.test(t)) return "condo";
  if (/\btownhouse|townhome\b/.test(t)) return "townhouse";
  if (/\bmulti[- ]family|duplex|triplex\b/.test(t)) return "multi_family";
  if (/\bland|lot|acreage\b/.test(t)) return "land";
  if (/\bcommercial|office|retail|warehouse\b/.test(t)) return "commercial";
  if (/\bsingle[- ]family|house|home\b/.test(t)) return "single_family";
  return null;
}

function statusOf(text: string): string | null {
  const t = text.toLowerCase();
  if (/\bsold\b/.test(t)) return "sold";
  if (/\bpending|under contract\b/.test(t)) return "pending";
  if (/\boff[- ]market\b/.test(t)) return "off-market";
  if (/\bactive|available|for sale|for rent\b/.test(t)) return "active";
  return null;
}

/** Pull JSON-LD blocks that describe a residence/offer/product. */
function jsonLd(html: string): any[] {
  const out: any[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1].trim());
      Array.isArray(parsed) ? out.push(...parsed) : out.push(parsed);
    } catch { /* ignore malformed */ }
  }
  return out;
}

function parseListing(url: string, html: string) {
  const clean = stripBoilerplate(html);
  const ld = jsonLd(html).find((n) =>
    /Residence|House|Apartment|Product|Offer|RealEstateListing|SingleFamilyResidence/i.test(String(n?.["@type"] || ""))
  );

  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || null;
  const priceLd = ld?.offers?.price ?? ld?.price;
  const priceText = clean.match(/[$£€]\s?([\d,]{4,})/)?.[1];
  const beds = clean.match(/(\d+(?:\.\d+)?)\s*(?:bed|bd|br)\b/i)?.[1];
  const baths = clean.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba)\b/i)?.[1];
  const sqft = clean.match(/([\d,]{3,})\s*(?:sq\.?\s?ft|sqft|square feet)/i)?.[1];
  const hoa = clean.match(/hoa[^\d]{0,20}([\d,]+)/i)?.[1];
  const lot = clean.match(/lot(?:\s*size)?[:\s]{1,4}([\d.,]+\s*(?:acres?|sq\.?\s?ft))/i)?.[1] || null;

  const photos = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => abs(url, m[1]))
    .filter((u) => /\.(jpe?g|png|webp)/i.test(u))
    .slice(0, 12);

  const address = ld?.address
    ? [ld.address.streetAddress, ld.address.addressLocality, ld.address.addressRegion].filter(Boolean).join(", ")
    : (title || null);
  const city = ld?.address?.addressLocality
    || clean.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*[A-Z]{2}\b/)?.[1]
    || null;

  const features = [...clean.matchAll(/\b(garage|pool|fireplace|hardwood|updated kitchen|basement|central air|balcony|parking|pet friendly|in[- ]unit laundry)\b/gi)]
    .map((m) => m[1].toLowerCase());

  return {
    listing_id: url.split("/").filter(Boolean).pop() || null,
    address,
    city,
    price: num(priceLd) ?? num(priceText),
    status: statusOf(clean),
    bedrooms: num(beds),
    bathrooms: num(baths),
    sqft: num(sqft),
    lot_size: lot,
    property_type: propertyType(`${title || ""} ${clean.slice(0, 1500)}`),
    description_raw: clean.slice(0, 4000) || null,
    features: [...new Set(features)],
    hoa_fee: num(hoa),
    listing_agent: ld?.agent?.name || null,
    photos,
    source_url: url,
    last_scraped: new Date().toISOString(),
  };
}

// ── agency record ───────────────────────────────────────────────────────────
const BOOKING_SIGNALS = /calendly|acuityscheduling|hubspot.*meetings|schedulicity|showingtime|book-?a-?showing|squarespace-scheduling|cal\.com|setmore/i;

function parseAgency(origin: string, pages: { url: string; html: string; text: string }[]) {
  const allHtml = pages.map((p) => p.html).join(" ");
  const allText = pages.map((p) => p.text).join(" \n ");

  const phone = allText.match(/(\+?\d[\d\s().-]{8,17}\d)/)?.[1]?.trim() || null;
  const email = allText.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/)?.[0] || null;
  const bookingDetected = BOOKING_SIGNALS.test(allHtml);
  const bookingUrl = allHtml.match(/https?:\/\/[^"']*(?:calendly|cal\.com|acuityscheduling|setmore)[^"']*/i)?.[0] || null;

  const hours = allText.match(/(mon(?:day)?[^.]{0,80}(?:am|pm)[^.]{0,60})/i)?.[1] || null;
  const licenses = [...allText.matchAll(/\b(?:license|lic\.?|DRE|BRE)\s*#?\s*([A-Z0-9-]{5,15})/gi)].map((m) => m[1]);

  const services: string[] = [];
  if (/\bbuy(ing)?\b/i.test(allText)) services.push("buying");
  if (/\bsell(ing)?\b/i.test(allText)) services.push("selling");
  if (/\brent(ing|als?)?\b/i.test(allText)) services.push("renting");
  if (/property management/i.test(allText)) services.push("property_management");
  if (/\bcommercial\b/i.test(allText)) services.push("commercial");

  const serviceArea = [...new Set(
    [...allText.matchAll(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2})\b/g)].map((m) => `${m[1]}, ${m[2]}`)
  )].slice(0, 12);

  const faqPairs: { q: string; a: string }[] = [];
  for (const p of pages.filter((x) => /faq|question/i.test(x.url))) {
    for (const m of p.text.matchAll(/([A-Z][^?]{10,120}\?)\s+([^?]{20,400}?)(?=[A-Z][^?]{10,120}\?|$)/g)) {
      faqPairs.push({ q: m[1].trim(), a: m[2].trim() });
      if (faqPairs.length >= 25) break;
    }
  }

  const testimonials = pages
    .filter((x) => /testimonial|review/i.test(x.url))
    .flatMap((x) => x.text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 60).slice(0, 10))
    .slice(0, 15);

  const tagline = pages.find((p) => p.url.replace(/\/$/, "") === origin.replace(/\/$/, ""))?.text.slice(0, 800)
    || pages[0]?.text.slice(0, 800) || "";

  return {
    agency_name: null as string | null,
    tagline_or_positioning_copy: tagline,
    service_area: serviceArea,
    services_offered: services,
    business_hours: hours,
    team_size: null,
    license_numbers: [...new Set(licenses)],
    contact: {
      phone,
      email,
      booking_widget_detected: bookingDetected,
      booking_url: bookingUrl,
    },
    fair_housing_statement_present: /equal housing|fair housing/i.test(allText),
    raw_faq_pairs: faqPairs,
    raw_testimonials: testimonials,
  };
}

// ────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { chatbot_id, website_url, business_name } = await req.json();
    if (!chatbot_id || !website_url) {
      return new Response(JSON.stringify({ error: "chatbot_id and website_url are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = new URL(website_url.startsWith("http") ? website_url : `https://${website_url}`).origin;
    const disallowed = await loadDisallowed(origin);
    const links = (await collectLinks(origin)).filter((u) => allowed(u, origin, disallowed));

    const listingUrls = links.filter((u) => LISTING_RE.test(u)).slice(0, MAX_LISTINGS);
    const supportUrls = [origin, ...links.filter((u) => SUPPORT_RE.test(u))].slice(0, MAX_SUPPORT_PAGES);

    // ── support pages (agency profile + KB) ──
    const supportPages: { url: string; html: string; text: string }[] = [];
    for (const u of supportUrls) {
      const res = await safeFetch(u);
      await sleep(RATE_LIMIT_MS);
      if (!res?.ok) continue;
      const html = await res.text();
      supportPages.push({ url: u, html, text: stripBoilerplate(html) });
    }

    const agency = parseAgency(origin, supportPages);
    agency.agency_name = business_name || null;

    // KB entries for policy / faq / about pages
    let kbCount = 0;
    for (const p of supportPages) {
      if (!p.text || p.text.length < 200) continue;
      const contentType = /faq|question/i.test(p.url) ? "faq"
        : /privacy|terms|fair-housing|disclosure/i.test(p.url) ? "policy"
        : /contact|schedule|book/i.test(p.url) ? "contact"
        : "about";
      const content = p.text.slice(0, 6000);
      const embedding = await createEmbedding(content);
      const { error } = await supabase.from("knowledge_base_entries").insert({
        chatbot_id, source_url: p.url, content_type: contentType,
        title: p.html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || contentType,
        content, embedding: embedding as any,
      });
      if (!error) kbCount++;
    }

    // ── listings ──
    const rows: any[] = [];
    for (const u of listingUrls) {
      const res = await safeFetch(u);
      await sleep(RATE_LIMIT_MS);
      if (!res?.ok) continue;
      const html = await res.text();
      const listing = parseListing(u, html);
      // Skip index/search pages that carry no real property signal
      if (!listing.address && listing.price === null && listing.bedrooms === null) continue;
      rows.push({ ...listing, chatbot_id });
    }

    // embed + upsert (replace previous scrape for this chatbot so price/status stay fresh)
    if (rows.length) {
      await supabase.from("property_listings").delete().eq("chatbot_id", chatbot_id);
      for (let i = 0; i < rows.length; i += 6) {
        const batch = rows.slice(i, i + 6);
        await Promise.all(batch.map(async (r) => {
          const text = [r.address, r.city, r.property_type, r.status,
            r.bedrooms ? `${r.bedrooms} bed` : "", r.bathrooms ? `${r.bathrooms} bath` : "",
            r.price ? `price ${r.price}` : "", (r.features || []).join(" "), r.description_raw]
            .filter(Boolean).join(" | ");
          r.embedding = await createEmbedding(text);
        }));
        await supabase.from("property_listings").insert(batch);
      }
    }

    // ── agency record ──
    await supabase.from("realestate_profiles").upsert({
      chatbot_id,
      agency_record: agency,
      booking_widget_detected: agency.contact.booking_widget_detected,
    }, { onConflict: "chatbot_id" });

    return new Response(JSON.stringify({
      ok: true,
      listings_saved: rows.length,
      kb_entries: kbCount,
      pages_crawled: supportPages.length + listingUrls.length,
      booking_widget_detected: agency.contact.booking_widget_detected,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("scrape-realestate-listings error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});