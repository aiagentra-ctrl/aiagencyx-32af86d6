

## Plan: Restaurant AI System Overhaul — Voice Agent, Chatbot UI, and Scrape Caching

This is a large request spanning 5 workstreams. Here is a structured plan covering all areas.

---

### 1. Database: Add `scraped_data` Cache Table

Create a new `scraped_data` table to cache Firecrawl results per URL, preventing duplicate scraping.

```sql
CREATE TABLE public.scraped_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_url text NOT NULL UNIQUE,
  raw_content text,
  structured_data jsonb DEFAULT '{}'::jsonb,
  logo_url text,
  scraped_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days')
);
ALTER TABLE public.scraped_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.scraped_data FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public read" ON public.scraped_data FOR SELECT TO anon, authenticated USING (true);
```

The `structured_data` JSONB will store: `{ menu_items, categories, pricing, services, faqs, contact, hours, address }`.

---

### 2. Edge Function: `scrape-and-analyze` — Add Cache Layer + Structured Extraction

**Changes to `supabase/functions/scrape-and-analyze/index.ts`:**

- Before calling Firecrawl, check `scraped_data` table for matching `website_url` where `expires_at > now()`
- If cached data exists, skip Firecrawl and use stored content
- After scraping, save results to `scraped_data` table
- Enhance the LLM analysis prompt to extract structured restaurant data: full menu items with prices, categories, hours, address, contact, FAQs
- Store structured extraction in `research_data` on the chatbot AND in `scraped_data.structured_data`
- Accept optional `forceRefresh: true` param to bypass cache

---

### 3. Edge Function: `create-voice-agent` — Optimized System Prompt + Cache Reuse

**Changes to `supabase/functions/create-voice-agent/index.ts`:**

- Reuse cached scrape data from `scraped_data` table (same cache-first logic)
- Replace the generic LLM prompt with a restaurant-specific structured prompt template:

```text
## Role & Identity
You are [Name], the AI phone assistant for [Business]. You are friendly, professional, and speak naturally.

## Core Tasks
A. Food Ordering: Ask items, quantity, delivery/pickup, confirm order
B. Table Reservation: Ask date, time, guests, name, phone, confirm
C. General Inquiry: Answer from knowledge base, keep responses short and voice-friendly

## Conversation Style
- Speak naturally, avoid robotic language
- Keep responses under 2-3 sentences for voice
- Confirm details by repeating back
- Use transitions like "Great choice!" or "Let me help with that"

## Do's & Don'ts
- DO: Stay in character, be helpful, confirm before finalizing
- DON'T: Make up info, discuss competitors, share internal data

## Error Handling
- If unclear: "I'm sorry, could you repeat that?"
- If outside scope: "I'd recommend speaking with our team directly. Would you like me to transfer you?"
```

- Dynamic `firstMessage`: `"Hi, thank you for calling [Business]! I can help you place an order, book a table, or answer any questions. What would you like to do?"`
- Include full menu + pricing in knowledge base section

---

### 4. Edge Function: `chatbot-conversation` — Improved System Prompt + Reservation Flow

**Changes to `supabase/functions/chatbot-conversation/index.ts` (`buildSystemPrompt`):**

- Remove excessive emoji instructions
- Add structured reservation flow instructions: the AI should collect date, time, guests, name, phone step-by-step using action buttons
- Add ordering flow: show categories → items with prices → link to ordering system
- Include full menu data from `research_data.structured  _data` or `scraped_data`
- Cleaner action button format guidance — fewer emojis, more professional labels

---

### 5. Chatbot UI Improvements

**Files affected:** `ChatWidget.tsx`, `ChatWindow,(tsx`, `WelcomeScreen.tsx`, `ActionButtons.tsx`, `ChatMessage.tsx`

#### A. Logo & Branding (`WelcomeScreen.tsx`, `ChatWidget.tsx`)
- Make logo larger and responsive (from fixed 16x16/9x9 to responsive sizing)
- Support rectangular logos, not just circles
- Remove excessive pulse animations

#### B. Input Box Fix (`ChatWindow.tsx`)
- Ensure input is always visible and properly styled
- Add focus ring, better padding

#### C. Message Design (`ChatMessage.tsx`)
- Better spacing between messages
- Remove unnecessary emojis from AI prompt instructions
- Cleaner markdown rendering

#### D. Action Buttons (`ActionButtons.tsx`)
- Make buttons actually clickable (fix any z-index/disabled issues)
- Better touch targets for mobile
- Clean professional labels without excessive emojis

#### E. Reservation Flow (handled by AI prompt)
- The AI will be instructed to collect reservation details step-by-step
- Each step shows action buttons for choices (date selection, time slots, guest count)
- Final confirmation message with all details

#### F. Chat Widget Header (`ChatWidget.tsx`)
- Clean up navigation grid layout
- Ensure menu button works properly

---

### 6. Landing Page Cleanup (`ChatbotPage.tsx`)
- Minor polish: remove emoji from "👇 Click the chat button" text
- Ensure chatbot widget is embedded directly in the demo section (not just floating)

---

### Summary of Files to Create/Edit

| File | Action |
|------|--------|
| `scraped_data` table | Create (migration) |
| `supabase/functions/scrape-and-analyze/index.ts` | Edit — add cache layer + structured extraction |
| `supabase/functions/create-voice-agent/index.ts` | Edit — cache reuse + restaurant prompt template |
| `supabase/functions/chatbot-conversation/index.ts` | Edit — cleaner prompt, reservation flow |
| `src/components/chatbot/ChatWidget.tsx` | Edit — larger logo, UI polish |
| `src/components/chatbot/ChatWindow.tsx` | Edit — input fix |
| `src/components/chatbot/WelcomeScreen.tsx` | Edit — responsive logo |
| `src/components/chatbot/ActionButtons.tsx` | Edit — better styling/clickability |
| `src/components/chatbot/ChatMessage.tsx` | Edit — spacing, cleaner design |
| `src/pages/ChatbotPage.tsx` | Edit — minor polish |

