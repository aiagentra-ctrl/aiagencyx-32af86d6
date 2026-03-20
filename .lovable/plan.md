

## Plan: Unified AI System API, Logo Scraping, and Conversion-Focused Demo Pages

---

### 1. Unified `create-ai-system` Edge Function

**New file: `supabase/functions/create-ai-system/index.ts`**

A single endpoint that orchestrates everything:

1. Accept: `businessName`, `websiteUrl`, `category`, `calendarUrl`, `origin`, `clientName`, `forceRefresh`
2. Scrape website (cache-first) with Firecrawl using `formats: ["markdown", "branding"]` to extract logo
3. Run LLM analysis to extract structured data (menu, hours, address, FAQs)
4. Build ONE shared system prompt (the existing restaurant prompt from `create-voice-agent`)
5. Create VAPI voice assistant using shared prompt + knowledge base
6. Create chatbot record using SAME prompt + SAME structured data
7. Create demo page record linked to both
8. Return all URLs + IDs in one response

Key principle: all three agents share identical `systemPrompt`, `knowledgeBase`, and `structuredData` — no mismatch.

Also update `supabase/config.toml` to register the new function.

---

### 2. Fix Logo Scraping in `create-voice-agent`

Currently `create-voice-agent` scrapes with `formats: ["markdown"]` only — no branding/logo extraction.

**Edit `supabase/functions/create-voice-agent/index.ts`:**
- Change scrape formats to `["markdown", "branding"]`
- Extract `logo_url` from branding response (same as `scrape-and-analyze` does)
- Save logo to `scraped_data` cache
- Return `logoUrl` in response

---

### 3. Conversion-Focused Demo Page Redesign

Completely restructure `DemoPage.tsx` section order to follow the psychological flow:

```text
1. Personalized Hook   → "Your AI receptionist for [Name] is ready"
2. Try Voice Agent      → BIG call button (primary action)
3. Try Chatbot          → Embedded chat widget (auto-open or prominent)
4. Personalization Proof → "AI already knows your business" (menu, pricing, hours)
5. Problem Reminder     → "How many customers hang up?" (emotional trigger)
6. Outcome              → More orders, no missed calls, no extra staff
7. CTA                  → "Want this running for [Name]?" + Book Call button
```

**Files to edit:**

| File | Changes |
|------|---------|
| `src/pages/DemoPage.tsx` | Complete restructure: new section order, pass logo/research data, fetch linked chatbot's research_data |
| `src/components/demo/HeroSection.tsx` | Accept `logoUrl`, show business logo in navbar + hero, personalized headline |
| `src/components/demo/VoiceAgentSection.tsx` | Bigger CTA button, more prominent "Call your AI receptionist" |
| `src/components/demo/BenefitsSection.tsx` | Rename to "Personalization Proof" — show actual menu, pricing, hours, location from research data |
| `src/components/demo/FeaturesSection.tsx` | Repurpose as "Problem Reminder" — missed calls, lost orders, busy staff |
| `src/components/demo/CTASection.tsx` | "Want this running for [Name]?" + "No commitment" line + Book Call |
| `src/components/demo/FooterSection.tsx` | Add logo to footer |

**New component:** `src/components/demo/PersonalizationProofSection.tsx`
- Shows actual scraped data: menu categories, pricing, hours, address
- "Your AI already knows your business" headline
- Pulls data from linked chatbot's `research_data` or from `scraped_data` table

**New component:** `src/components/demo/ProblemSection.tsx`
- "How many customers hang up when you don't answer?"
- Missed calls = lost orders
- Busy staff = missed bookings
- Emotional, visual, short

**New component:** `src/components/demo/OutcomeSection.tsx`
- More orders, More reservations, No missed calls, No extra staff
- Clean icon grid

---

### 4. Demo Page Data Flow

`DemoPage.tsx` currently doesn't have access to research data. Fix:
- After fetching `demo_pages` record, also fetch linked chatbot via `demo_page_id`
- From the chatbot, get `research_data` (menu items, hours, address, etc.)
- Also check `scraped_data` table as fallback
- Pass this data to the new personalization proof section
- Pass `logo_url` from chatbot/scraped_data to HeroSection and FooterSection

---

### 5. API Docs Update

**Edit `src/pages/ApiDocsPage.tsx`:**
- Add documentation for `POST /create-ai-system` endpoint
- Show all required/optional fields
- Show example response with voice agent, chatbot, and demo page URLs

---

### Files Summary

| File | Action |
|------|--------|
| `supabase/functions/create-ai-system/index.ts` | Create — unified API |
| `supabase/config.toml` | Edit — register new function |
| `supabase/functions/create-voice-agent/index.ts` | Edit — add branding format to scrape |
| `src/pages/DemoPage.tsx` | Edit — restructure sections, fetch research data + logo |
| `src/components/demo/HeroSection.tsx` | Edit — accept logoUrl, personalized headline |
| `src/components/demo/VoiceAgentSection.tsx` | Edit — bigger CTA, "Call your AI receptionist" |
| `src/components/demo/BenefitsSection.tsx` | Edit — repurpose as outcome section |
| `src/components/demo/FeaturesSection.tsx` | Edit — repurpose as problem reminder |
| `src/components/demo/CTASection.tsx` | Edit — "Want this for [Name]?" + no commitment line |
| `src/components/demo/FooterSection.tsx` | Edit — add logo |
| `src/components/demo/PersonalizationProofSection.tsx` | Create — show scraped menu/hours/location |
| `src/components/demo/ProblemSection.tsx` | Create — emotional missed calls section |
| `src/components/demo/OutcomeSection.tsx` | Create — results grid |
| `src/pages/ApiDocsPage.tsx` | Edit — document create-ai-system |

