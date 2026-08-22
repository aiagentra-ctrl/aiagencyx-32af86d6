/**
 * Builds ONE complete knowledge document per business and attaches it to the
 * Vapi assistant as a native knowledge file (canonical provider).
 *
 * The document carries the same information our custom `search_knowledge_base`
 * tool would return — curated KB markdown, spoken voice KB, core facts, menu /
 * products / property listings, and raw scraped page chunks as a fallback body.
 *
 * The custom tools stay attached: the agent reads the native file first and only
 * falls back to a tool round-trip when the file has no answer or Vapi errors.
 */
import { uploadVapiTextFile, createKnowledgeQueryTool, deleteVapiFile, deleteVapiTool } from "./vapi-files.ts";

export type KbDocResult = {
  markdown: string;
  sources: Record<string, number>;
  thin: boolean;
};

const MAX_DOC_CHARS = 400_000;

function section(title: string, body?: string | null): string {
  const b = (body || "").trim();
  return b ? `\n\n## ${title}\n\n${b}` : "";
}

function money(v: unknown, currency?: string | null): string {
  if (v === null || v === undefined || v === "") return "";
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return `${currency || "$"}${n}`;
}

function factsBlock(structured: any, core: any): string {
  const s = structured || {};
  const c = (core && typeof core === "object") ? core : {};
  const rows: string[] = [];
  const push = (label: string, value: unknown) => {
    if (value === null || value === undefined) return;
    const v = typeof value === "string" ? value.trim() : JSON.stringify(value);
    if (!v || v === "{}" || v === "[]" || v === '""') return;
    rows.push(`- **${label}:** ${v}`);
  };
  push("Location", c.location || s.address || s.location);
  push("Phone", c.contact?.phone || s.phone);
  push("Email", c.contact?.email || s.email);
  push("Hours", c.hours || s.business_hours || s.hours);
  push("Services", c.services || s.services);
  push("Pricing summary", c.pricing_summary);
  push("Tone", c.tone);
  push("Escalation", c.escalation);
  push("Top intents", c.top_intents);
  if (Array.isArray(c.top_objections)) {
    for (const o of c.top_objections) {
      if (o?.objection) rows.push(`- **Objection — ${o.objection}:** ${o.response || ""}`);
    }
  }
  return rows.join("\n");
}

function menuBlock(structured: any): string {
  const items = structured?.menu_items;
  if (!Array.isArray(items) || items.length === 0) return "";
  const byCat: Record<string, any[]> = {};
  for (const it of items) {
    const cat = it?.category || "Menu";
    (byCat[cat] ||= []).push(it);
  }
  return Object.entries(byCat).map(([cat, list]) =>
    `### ${cat}\n` + list.map((it: any) =>
      `- ${it.name || "Item"}${it.price ? ` — ${money(it.price, structured?.currency)}` : ""}${it.description ? `: ${it.description}` : ""}`
    ).join("\n")
  ).join("\n\n");
}

/** Assemble the full knowledge document from every source we already store. */
export async function buildVapiKbDoc(opts: {
  supabase: any;
  chatbotId?: string | null;
  businessName: string;
  websiteUrl?: string | null;
  industry?: string | null;
  /** Raw KB text passed by the caller (scrape output). */
  knowledgeBase?: string | null;
  structured?: any;
  /** Pre-loaded chatbots row, if the caller already fetched it. */
  chatbotRow?: any;
}): Promise<KbDocResult> {
  const sources: Record<string, number> = {};
  let cb = opts.chatbotRow ?? null;

  if (!cb && opts.chatbotId) {
    const { data } = await opts.supabase
      .from("chatbots")
      .select("business_name, website_url, industry, matched_industry, kb_chatbot_md, kb_voice_text, prompt_core, research_data")
      .eq("id", opts.chatbotId).maybeSingle();
    cb = data;
  }

  const parts: string[] = [
    `# ${opts.businessName} — Complete Knowledge Base`,
    `\nSource website: ${opts.websiteUrl || cb?.website_url || "n/a"}`,
    `Industry: ${opts.industry || cb?.matched_industry || cb?.industry || "general"}`,
    `Generated: ${new Date().toISOString()}`,
    `\nThis document is the agent's primary source of truth. Answer directly from it.`,
  ];

  const facts = factsBlock(opts.structured, cb?.prompt_core);
  if (facts) { parts.push(section("Core Facts", facts)); sources.core_facts = 1; }

  if (cb?.kb_chatbot_md) {
    parts.push(section("Business Knowledge (services, FAQs, pricing, policies, objections)", cb.kb_chatbot_md));
    sources.kb_chatbot_md = cb.kb_chatbot_md.length;
  }
  if (cb?.kb_voice_text) {
    parts.push(section("Conversational Reference (how to answer on a call)", cb.kb_voice_text));
    sources.kb_voice_text = cb.kb_voice_text.length;
  }

  const menu = menuBlock(opts.structured);
  if (menu) { parts.push(section("Menu", menu)); sources.menu_items = (opts.structured?.menu_items || []).length; }

  if (opts.chatbotId) {
    // Products (e-commerce / retail)
    const { data: products } = await opts.supabase
      .from("products")
      .select("name, description, price, compare_at_price, currency, category, vendor, in_stock, product_url")
      .eq("chatbot_id", opts.chatbotId).limit(300);
    if (products?.length) {
      parts.push(section("Product Catalog", products.map((p: any) =>
        `- **${p.name}**${p.price ? ` — ${money(p.price, p.currency)}` : ""}${p.category ? ` (${p.category})` : ""}` +
        `${p.in_stock === false ? " [out of stock]" : ""}${p.description ? `\n  ${String(p.description).slice(0, 300)}` : ""}` +
        `${p.product_url ? `\n  ${p.product_url}` : ""}`
      ).join("\n")));
      sources.products = products.length;
    }

    // Property listings (real estate)
    const { data: listings } = await opts.supabase
      .from("property_listings")
      .select("address, city, price, status, bedrooms, bathrooms, sqft, property_type, features, hoa_fee, listing_agent, description_raw, source_url")
      .eq("chatbot_id", opts.chatbotId).limit(200);
    if (listings?.length) {
      parts.push(section("Property Listings", listings.map((l: any) => [
        `- **${l.address || "Listing"}${l.city ? `, ${l.city}` : ""}**`,
        l.price ? `price ${money(l.price)}` : null,
        l.status ? `status ${l.status}` : null,
        l.bedrooms ? `${l.bedrooms} bed` : null,
        l.bathrooms ? `${l.bathrooms} bath` : null,
        l.sqft ? `${l.sqft} sqft` : null,
        l.property_type || null,
        l.hoa_fee ? `HOA ${money(l.hoa_fee)}` : null,
        Array.isArray(l.features) && l.features.length ? l.features.join(", ") : null,
        l.description_raw ? String(l.description_raw).slice(0, 400) : null,
        l.source_url || null,
      ].filter(Boolean).join(" · ")).join("\n")));
      sources.listings = listings.length;
    }

    // Raw scraped pages — the same corpus the RAG tool searches.
    const { data: entries } = await opts.supabase
      .from("knowledge_base_entries")
      .select("title, source_url, content_type, content")
      .eq("chatbot_id", opts.chatbotId)
      .neq("content_type", "architected")
      .limit(200);
    if (entries?.length) {
      parts.push(section("Website Content (scraped pages)", entries.map((e: any) =>
        `### ${e.title || e.source_url || e.content_type}\n${e.source_url ? `${e.source_url}\n` : ""}${e.content}`
      ).join("\n\n")));
      sources.scraped_entries = entries.length;
    }
  }

  // Caller-supplied KB text is the last resort — only if we found nothing curated.
  const haveCurated = !!(sources.kb_chatbot_md || sources.kb_voice_text || sources.scraped_entries);
  if (!haveCurated && opts.knowledgeBase) {
    parts.push(section("Business Information", opts.knowledgeBase));
    sources.raw_knowledge_base = opts.knowledgeBase.length;
  }

  const research = cb?.research_data;
  if (research && !haveCurated) {
    const txt = typeof research === "string" ? research : JSON.stringify(research, null, 2);
    if (txt && txt !== "{}") { parts.push(section("Research Data", txt)); sources.research_data = txt.length; }
  }

  let markdown = parts.join("\n").trim();
  if (markdown.length > MAX_DOC_CHARS) markdown = markdown.slice(0, MAX_DOC_CHARS);

  // "Thin" = nothing beyond the header/facts worth retrieving from.
  const bodyLen = markdown.length - (parts[0]?.length || 0);
  const thin = bodyLen < 600;

  return { markdown, sources, thin };
}

/**
 * Build + upload the knowledge doc, replace any previous file for this chatbot,
 * and return the Vapi `model.knowledgeBase` value (undefined when unavailable —
 * the agent then relies on the custom tools alone).
 */
export async function attachVapiKnowledge(opts: {
  supabase: any;
  apiKey: string;
  chatbotId?: string | null;
  businessName: string;
  websiteUrl?: string | null;
  industry?: string | null;
  knowledgeBase?: string | null;
  structured?: any;
  chatbotRow?: any;
}): Promise<{ toolIds: string[]; fileIds: string[]; doc: KbDocResult }> {
  const doc = await buildVapiKbDoc(opts);
  const fileIds: string[] = [];
  const toolIds: string[] = [];

  if (doc.thin) {
    console.warn(`[vapi-kb] thin knowledge doc for ${opts.businessName} — sources: ${JSON.stringify(doc.sources)}`);
  }

  if (doc.markdown && !doc.thin) {
    const file = await uploadVapiTextFile({
      apiKey: opts.apiKey,
      name: `${opts.businessName}-knowledge`,
      content: doc.markdown,
    });
    if (file) fileIds.push(file.id);
    console.log(`[vapi-kb] ${opts.businessName}: ${doc.markdown.length} chars, sources ${JSON.stringify(doc.sources)}, file ${file?.id || "FAILED"}`);
  }

  if (fileIds.length) {
    const toolId = await createKnowledgeQueryTool({
      apiKey: opts.apiKey,
      fileIds,
      businessName: opts.businessName,
      description: `Everything known about ${opts.businessName}: services, pricing, hours, policies, FAQs, menu, products, property listings and website content.`,
    });
    if (toolId) toolIds.push(toolId);
  }

  // Replace the previous file/tool so the Vapi account doesn't accumulate orphans.
  if (toolIds.length && opts.chatbotId) {
    try {
      const { data: row } = await opts.supabase
        .from("chatbots").select("vapi_file_ids, vapi_tool_ids").eq("id", opts.chatbotId).maybeSingle();
      const oldFiles: string[] = Array.isArray(row?.vapi_file_ids) ? row.vapi_file_ids : [];
      const oldTools: string[] = Array.isArray(row?.vapi_tool_ids) ? row.vapi_tool_ids : [];
      for (const id of oldTools) { if (!toolIds.includes(id)) await deleteVapiTool(opts.apiKey, id); }
      for (const id of oldFiles) { if (!fileIds.includes(id)) await deleteVapiFile(opts.apiKey, id); }
      await opts.supabase.from("chatbots")
        .update({ vapi_file_ids: fileIds, vapi_tool_ids: toolIds }).eq("id", opts.chatbotId);
    } catch (e) {
      console.warn("[vapi-kb] file bookkeeping failed", e);
    }
  }

  return { toolIds, fileIds, doc };
}

/** Prompt rules used when a native knowledge file IS attached (KB first, tools fallback). */
export function kbFirstRules(chatbotId?: string | null): string {
  return `

## KNOWLEDGE — NATIVE KNOWLEDGE BASE FIRST, CUSTOM TOOL AS FALLBACK
Your complete knowledge base is attached to you natively via \`knowledge_query\`. It contains the
business overview, services, pricing, policies, FAQs, menu / products / listings and website content.
- Answer instantly from CORE FACTS above when they cover the question.
- For anything else factual, use \`knowledge_query\` — that is your primary source of truth.
${chatbotId ? `- ONLY if \`knowledge_query\` returns nothing useful or errors, call \`search_knowledge_base(query)\` as a fallback.
- Speak only from CORE FACTS or what those lookups return. Never invent facts.
- If both come back empty, say exactly: "Let me check with our team on that."
- The knowledge scope id for this assistant is: ${chatbotId}` : `- If \`knowledge_query\` has no answer, say exactly: "Let me check with our team on that."`}
- Never mention files, tools, or lookups to the caller.
`;
}

/** Prompt rules used when NO file could be attached (tool is the only source). */
export function toolOnlyRules(chatbotId?: string | null): string {
  if (!chatbotId) return "";
  return `

## RAG TOOL — STRICT RULES
You have a tool called \`search_knowledge_base(query)\`.
- CORE FACTS above cover greetings, basic services, pricing structure, hours, objections and escalation — answer those instantly.
- Call search_knowledge_base for anything else factual before answering.
- Speak ONLY from CORE FACTS or the tool's returned text. Never invent facts.
- If the tool returns nothing useful, say exactly: "Let me check with our team on that."
- The chatbot_id for this assistant is: ${chatbotId}
`;
}
