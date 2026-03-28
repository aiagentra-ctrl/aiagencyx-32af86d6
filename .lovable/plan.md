

## Plan: Intelligent Default Industry System + Advanced Landing Page

### Summary
Two workstreams: (1) Upgrade the "default" industry flow in `create-demo` to deeply analyze websites, auto-detect industry, match/generate/store templates, and inject real business data. (2) Rebuild all landing page sections to be fully dynamic and industry-agnostic using the P.I.E.C.E conversion framework.

---

### 1. Edge Function: `create-demo/index.ts` — Deep Default Logic

**Current problem:** When `industry=default`, the system uses a generic one-liner prompt and basic single-page scraping.

**Changes:**

**A. Multi-page scraping (Firecrawl Map + Scrape)**
- Before scraping, call Firecrawl `/v1/map` to discover all pages on the site
- Scrape up to 5 key pages (about, services/menu, pricing, contact, FAQ) using URL pattern matching
- Concatenate content for richer extraction
- Fall back to single-page scrape if map fails

**B. Enhanced structured extraction**
- Expand the LLM extraction tool to also return: `key_selling_points`, `customer_flow` (how customers interact), `use_cases` (3 real scenarios), `brand_personality`, `target_audience`
- Send more content to extraction (up to 15K chars from multi-page scrape)

**C. Smart industry detection + template matching**
- After extraction, use `structuredData.industry` (LLM-detected)
- Query `industry_templates` for a matching template
- If found: use it with variable injection
- If NOT found: generate a full template via LLM and **save it** to `industry_templates` for future reuse

**D. Advanced system prompt generation**
- When no template exists, generate a production-level system prompt via LLM that includes: role definition, personality, conversation flow, sales behavior, error handling, do's and don'ts
- Store generated prompt as a new `industry_templates` row

**E. Expanded dynamic content generation**
- Add to the LLM generation call: `use_case_scenarios` (3 visual flow scenarios), `outcome_metrics` (4 before/after items), `trust_lines` (3 personalization trust statements)
- These power the new landing page sections

**F. Template variable injection**
- All generated/stored templates use `{business_name}`, `{main_service}`, `{industry}` placeholders
- Real data from scraping replaces these at generation time

---

### 2. Database: Expand `dynamic_content` Schema

No migration needed — `dynamic_content` is already JSONB. We just store more fields:
- `use_case_scenarios`, `outcome_metrics`, `trust_lines`, `voice_prompts` (try-saying suggestions)

---

### 3. Frontend: Rebuild Landing Page Sections

All sections become dynamic, reading from `dynamic_content` with smart fallbacks.

**A. `HeroSection.tsx`** — Already dynamic. Minor: add `{main_service}` to subtitle fallback.

**B. `VoiceAgentSection.tsx`** — Make dynamic
- Accept `voicePrompts` prop from `dynamic_content.voice_prompts`
- Replace hardcoded restaurant prompts ("Book a table", "Place an order") with industry-relevant ones
- Accept `companyName` in section copy (already does)

**C. `PersonalizationProofSection.tsx`** — Make universal
- Rename "Menu" section header to "Products & Services" when not restaurant
- Accept `products` array alongside `menuItems`
- Show whichever has data (menu_items for restaurants, products for others)
- Add `services` display as tag chips when available
- Update copy: "We scraped your website" → "Built using your website data"

**D. `ProblemSection.tsx`** — Already dynamic. No changes needed (accepts `problems` prop).

**E. `OutcomeSection.tsx`** — Make dynamic
- Accept optional `outcomes` prop from `dynamic_content.outcome_metrics`
- If provided, use those instead of hardcoded restaurant outcomes
- Keep current outcomes as fallback
- Update headline to use `{companyName}`

**F. `VoiceAgentSection.tsx` chatbot prompts** — Use same `voicePrompts` for chatbot "Try asking" suggestions

---

### 4. Frontend: `DemoPage.tsx` — Pass New Props

- Extract `voice_prompts`, `outcome_metrics`, `use_case_scenarios` from `dynamic_content`
- Pass to `VoiceAgentSection`, `OutcomeSection`
- Pass `products` from research_data to `PersonalizationProofSection`

---

### Files Summary

| File | Action |
|------|--------|
| `supabase/functions/create-demo/index.ts` | Edit — multi-page scrape, smart detection, template auto-save, expanded LLM generation |
| `src/pages/DemoPage.tsx` | Edit — pass new dynamic props |
| `src/components/demo/VoiceAgentSection.tsx` | Edit — dynamic prompts |
| `src/components/demo/PersonalizationProofSection.tsx` | Edit — universal products/services display |
| `src/components/demo/OutcomeSection.tsx` | Edit — accept dynamic outcomes |

