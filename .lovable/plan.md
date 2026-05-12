## Real Estate Template + Knowledge Base RAG + Premium UI

Three additive workstreams. No existing endpoints, tables, or templates are modified destructively.

---

### 1. Real Estate Industry Template

**New `industry_templates` row** (`industry_name = "real_estate"`):

- **System prompt** (uses your exact structure with auto-injected variables from scraped data):
  ```
  You are {agent_name}, a voice assistant for {business_name}.

  PERSONA:
  - Speak like a warm, confident human — never robotic
  - Short sentences. Natural pauses. Conversational tone.
  - Never say "As an AI" or "I'm a bot"

  BUSINESS INFO:
  - Company: {business_name}
  - Location: {city}
  - Services: {services}
  - Speciality: {speciality}
  - Working hours: {hours}
  - Contact: {phone} / {email}

  KNOWLEDGE BASE ACCESS:
  - You have a `search_knowledge_base` tool with full property listings, pricing, locations, agent info, FAQs.
  - ALWAYS call it before answering questions about specific properties, prices, availability, or policies.
  - NEVER guess. If the tool returns nothing, say: "Let me have our team confirm that for you."

  BEHAVIOR RULES:
  - Greet with: "Hi, I'm {agent_name} from {business_name}. How can I help you today?"
  - Ask one question at a time
  - If budget mentioned → call search_knowledge_base with budget filter → match listings
  - If not available → offer alternatives via tool, never say "we don't have it"
  - Always end with a next step: book a visit, send details, or connect to a human
  - Out of scope → "Let me connect you with our team for that"

  TONE: Friendly, professional, brief. No jargon.
  ```

- **First message:** `"Hi, I'm {agent_name} from {business_name}. Looking to buy, rent, or sell today?"`
- **Floating bubbles, nav items, problem statements** tuned for real estate (missed buyer leads, after-hours inquiries, tour booking).

---

### 2. Knowledge Base + RAG Tool System

**Database (new tables, additive):**

```text
knowledge_base_entries
  id, chatbot_id, source_url, content_type (property|faq|service|page|agent),
  title, content (text), structured (jsonb), embedding (vector(1536)),
  created_at, updated_at

knowledge_base_jobs
  id, chatbot_id, website_url, status (queued|scraping|embedding|done|failed),
  pages_scraped, entries_created, error, created_at, completed_at
```

Enable `pgvector`. Index: `ivfflat` on `embedding`. RLS: service-role full; anon/auth read.

**New edge functions (additive only):**

- `build-knowledge-base` — Triggered after chatbot creation OR manually. Uses Firecrawl `/v2/map` → `/v2/scrape` (markdown) on top N pages → chunks 500–800 tokens → embeds via Lovable AI Gateway (`google/gemini-embedding-001` or OpenAI embedding) → stores in `knowledge_base_entries`. Detects property listings via JSON extraction format. Writes job row for progress.
- `search-knowledge-base` — POST `{ chatbotId, query, filters?: {budget, location, type}, limit }`. Embeds query, runs cosine-similarity SQL `<=>` against entries scoped to `chatbot_id`, returns top 5 with title/content/structured. Used as a tool by the chatbot.

**`chatbot-conversation` (additive change, no break):**

- Detect if chatbot has KB entries; if yes, register a `search_knowledge_base` tool in the OpenAI-style request (`tools: [{type:"function", function:{name, description, parameters}}]`) and pass `tool_choice: "auto"`.
- Loop on `tool_calls`: call internal `search-knowledge-base`, append tool response, re-stream.
- If no KB → existing behavior unchanged (full backward compatibility).

**Admin Panel — new "Knowledge Base" tab in chatbot edit:**

- Shows scrape job status, entry count, source URLs.
- "Rebuild knowledge base" button → triggers `build-knowledge-base`.
- Table view of entries with search + delete.

---

### 3. Real Estate Demo Page UI/UX (premium)

**New components in `src/components/demo/realestate/`:**

- `RealEstateHero.tsx` — Cinematic split layout: left = bold headline + voice CTA + chat CTA, right = animated property card stack with parallax. Glass morphism, gradient mesh background, smooth motion on load.
- `PropertyShowcaseSection.tsx` — Replaces "Services". Grid of 3 featured properties from `dynamic_content.properties` or scraped data: image, price tag, beds/baths/sqft chips, "Book Tour" button. Hover lift + shine effect.
- `RealEstateValueSection.tsx` — Three pillars (Instant Tour Booking / 24-7 Lead Capture / Multilingual Buyers), large icons, subtle gradient cards.
- `RealEstateAgentSection.tsx` — Meet-the-AI-agent block with pulse-ring avatar matching brand.
- `RealEstateCTASection.tsx` — Premium dark gradient CTA, dual buttons (Talk to AI / Browse Listings).

**Chatbot UI upgrade (`ChatWindow.tsx`, `ChatWidget.tsx`, `WelcomeScreen.tsx`):**

- New `premium` variant gated by `industry === "real_estate"` (no impact on other industries):
  - Glass header with blurred backdrop, subtle gradient border.
  - Message bubbles with soft shadows + rounded-3xl, fade-in-up animation per message.
  - Quick-action buttons restyled as pill cards with icon + label + arrow.
  - Property recommendation cards (already in `RecommendationCards.tsx`) restyled to magazine layout: large image, price overlay, spec chips, primary "Book Tour" CTA.
  - Typing indicator: animated gradient dots.
  - Send button: gradient with hover glow.

**`DemoPage.tsx` routing:**

- When `industry === "real_estate"`: render new real-estate sections; explicitly skip `OutcomeSection` "Services" block.
- Add new tokens to `index.css` under a `.theme-realestate` scope (deep navy, gold accent, warm neutrals) — semantic only, HSL.

---

### Files

**New:**
- `supabase/functions/build-knowledge-base/index.ts`
- `supabase/functions/search-knowledge-base/index.ts`
- `supabase/migrations/<ts>_knowledge_base.sql` (tables + pgvector + indexes + RLS)
- `supabase/migrations/<ts>_real_estate_template.sql` (seed industry_templates row)
- `src/components/demo/realestate/{RealEstateHero,PropertyShowcaseSection,RealEstateValueSection,RealEstateAgentSection,RealEstateCTASection}.tsx`
- `src/components/admin/KnowledgeBasePanel.tsx`

**Modified (additive only):**
- `supabase/functions/chatbot-conversation/index.ts` — add tool-calling branch
- `supabase/functions/create-chatbot/index.ts` — fire-and-forget `build-knowledge-base` after creation
- `src/pages/DemoPage.tsx` — branch on `real_estate` industry
- `src/components/chatbot/ChatWindow.tsx` + `WelcomeScreen.tsx` + `ChatMessage.tsx` — premium variant prop
- `src/components/admin/EditChatbotDialog.tsx` — add KB tab
- `src/index.css` + `tailwind.config.ts` — real-estate theme tokens
- `supabase/config.toml` — register two new functions with `verify_jwt = false`

### Guarantees

- No existing endpoint signature changes; create-demo, trigger-follow-up, track-visitor untouched.
- Existing dental and generic templates render exactly as today.
- KB tool only activates when entries exist for the chatbot — graceful no-op fallback.
- Firecrawl already configured (`FIRECRAWL_API_KEY` present); no new secrets required.
- Embeddings via Lovable AI Gateway → no API key request.
