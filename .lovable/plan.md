# E-Commerce AI Integration Module

A new industry template + scraping pipeline + unified chat/voice UI tailored for digital-product stores.

## 1. Detection & Activation

- Add `ecommerce` industry template in `industry_templates` (seeded via migration).
- In `CreateChatbotDialog` / API settings, add a dedicated **E-Commerce** section:
  - Fields: `store_name`, `store_url`, `platform` (Shopify / WooCommerce / Gumroad / Lemon Squeezy / Custom).
  - Toggling industry = "E-Commerce" unlocks this section.
- Auto-detection on scrape: in `scrape-and-analyze`, sniff for Shopify (`cdn.shopify.com`, `/products.json`), Woo (`wp-content`, `wc-`), Gumroad, Stripe checkout, Lemon Squeezy markers → auto-set industry to `ecommerce`.

## 2. Advanced Product Scraper (extends `build-knowledge-base`)

New phase before the Architect step:
- **Sitemap pull** via Firecrawl `/v2/map` (already used) — filter URLs matching `/product`, `/products`, `/p/`, `/item`, `/shop`, `/store`.
- For Shopify stores, fetch `/{store}/products.json` directly (fast path, structured).
- For others, Firecrawl `/v2/scrape` each product URL with `formats: ["markdown", { type: "json", schema: ProductSchema }]`.
- `ProductSchema`: `{ name, description, price, currency, image_url, product_url, sku?, category?, tags? }`.
- Cap at 20+ products (configurable, default 30).
- Store in new `products` table (per-chatbot), linked to KB.
- Also scrape About / Contact / Policy / FAQ pages and feed into existing KB pipeline.

## 3. Database Changes

```sql
CREATE TABLE products (
  id uuid PK,
  chatbot_id uuid,
  name text, description text,
  price numeric, currency text,
  image_url text, product_url text,
  sku text, category text, tags text[],
  embedding vector(1536),
  created_at timestamptz
);
-- RLS: public read, service write
-- Index: ivfflat on embedding
```

Add to `chatbots`: `store_name`, `store_platform`, `product_count`.

## 4. Product Recommendation Engine

- New edge function `recommend-products`: takes user query + chatbotId → embeds query → returns top-5 products via pgvector similarity.
- `chatbot-conversation` registers a new tool `recommend_products(query)` alongside `search_knowledge_base`.
- System prompt updated to: "For product/buy/recommend intents → call `recommend_products`. For policy/shipping/about → call `search_knowledge_base`."
- Response renders as **product cards** (existing `RecommendationCards.tsx` extended to show image, price, "Buy Now" → product_url).

## 5. Unified Chat + Voice UI (single interface)

Redesign `ChatWindow.tsx` for e-commerce:
- One unified panel — no separate voice page.
- Bottom bar: text input + **mic button** (tap to start, tap to stop) using Vapi Web SDK.
- Mic state: idle → listening (pulse ring) → speaking (waveform).
- Voice transcripts stream into the same chat thread as messages.
- Product cards render inline whether triggered by chat or voice.

Components:
- `EcommerceChatWindow.tsx` — variant of ChatWindow with voice toggle.
- `VoiceMicButton.tsx` — Vapi start/stop, animated states.
- `ProductCard.tsx` — image, name, price, CTA.

## 6. E-Commerce Landing Page Template

New `src/components/demo/ecommerce/` sections:
- `EcommerceHero.tsx` — pitches the AI chatbot as core product (not the store).
- `UnifiedChatVoiceShowcase.tsx` — big embedded chatbot demo, voice + chat in one.
- `ProductGridPreview.tsx` — shows scraped products as proof.
- `EcommerceValueSection.tsx` — "Recover lost sales", "24/7 product expert", "Voice shopping".
- Footer + CTA.

Wire into `DemoPage.tsx` when `industry === 'ecommerce'`.

## 7. Backend Functions Touched

- **NEW** `scrape-ecommerce-products` — product extraction phase
- **NEW** `recommend-products` — pgvector similarity search tool
- **EDIT** `build-knowledge-base` — call product scraper when industry=ecommerce, embed products
- **EDIT** `scrape-and-analyze` — platform auto-detection
- **EDIT** `chatbot-conversation` — register `recommend_products` tool, render product cards
- **EDIT** `create-voice-agent` — register `recommend_products` Vapi tool + e-commerce persona
- **EDIT** `create-chatbot` / `create-demo` — accept store fields, pass through

## 8. System Prompt (E-Commerce Persona)

Injected via `industry_templates.system_prompt_template`:
```
You are {AGENT_NAME} for {STORE_NAME}, a {PLATFORM} store.
TOOLS: recommend_products(query), search_knowledge_base(query)
RULES:
- Product/buy/looking-for intent → recommend_products FIRST, show 3-5 cards.
- Policy/shipping/refund/about → search_knowledge_base.
- Never invent prices or SKUs — only speak from tool results.
- Offer "Buy Now" link from product_url. Don't guess stock.
- Voice mode: short sentences, suggest 1-2 products max per turn.
```

## 9. Admin UI

- `KnowledgeBasePanel`: new "Products" tab — table of scraped products with image, price, edit/delete.
- `CreateChatbotDialog`: E-Commerce section (store name, URL, platform dropdown).
- "Re-scrape products" button per chatbot.

## Out of Scope (this round)
- Actual checkout / cart inside chatbot (just deep-links to store).
- Multi-currency conversion.
- Inventory sync webhooks.

---

**Confirm and I'll build:** migration → product scraper → recommendation tool → unified chat+voice UI → e-commerce landing template → admin wiring.