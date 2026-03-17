

## Plan: Automated Voice Agent Creation via VAPI API

### Summary
Create a new edge function `create-voice-agent` that takes minimal input (business name, category, website URL), automatically scrapes the website with Firecrawl, generates a production-quality system prompt via LLM, creates a VAPI assistant via `POST https://api.vapi.ai/assistant`, and returns only the `assistantId`. Then add a new section to the API docs page documenting this endpoint.

### Requirements
- A **VAPI API key** (private server key) is needed as a secret to call `https://api.vapi.ai/assistant`. This is NOT currently configured — we will need to request it from you.

### Changes

#### 1. New Edge Function: `supabase/functions/create-voice-agent/index.ts`

Pipeline steps:
1. **Validate input**: `businessName`, `category`, `websiteUrl` (all required)
2. **Scrape website** using the existing Firecrawl failover logic (reused from `scrape-and-analyze`)
3. **Generate system prompt via LLM** — use Lovable AI (or admin-configured providers with failover). The prompt instructs the LLM to produce a structured voice assistant system prompt with: Role, Identity, Tasks, Do's & Don'ts, Error Handling, plus a knowledge base summary — all dynamically based on scraped content.
4. **Create VAPI Assistant** — `POST https://api.vapi.ai/assistant` with:
   - `name`: business name (truncated to 40 chars)
   - `firstMessage`: dynamic greeting
   - `model`: `{ provider: "openai", model: "gpt-4", messages: [{ role: "system", content: generatedPrompt }] }`
   - `voice`: `{ provider: "11labs", voiceId: "rachel" }` (sensible default)
5. **Return** only `{ "assistantId": "..." }`

#### 2. Add to `supabase/config.toml`
```toml
[functions.create-voice-agent]
verify_jwt = false
```

#### 3. Update API Docs Page (`src/pages/ApiDocsPage.tsx`)
Add a new Card section for the "Automated Voice Agent API" with:
- Endpoint: `POST .../functions/v1/create-voice-agent`
- Input: `businessName`, `category`, `websiteUrl`
- cURL example
- Response: `{ "assistantId": "..." }`
- Pipeline explanation (scrape → LLM → VAPI → assistantId)

#### 4. Request VAPI_API_KEY Secret
Before implementing, we need you to provide your VAPI private/server API key so the edge function can call `https://api.vapi.ai/assistant`. This is different from the public VAPI key used in the frontend.

### Technical Details

**VAPI Create Assistant payload** (minimal, optimized):
```json
{
  "name": "ABC Dental Clinic",
  "firstMessage": "Hello! Thank you for calling ABC Dental Clinic. How can I help you today?",
  "model": {
    "provider": "openai",
    "model": "gpt-4",
    "messages": [
      { "role": "system", "content": "<generated-system-prompt>" }
    ]
  },
  "voice": {
    "provider": "11labs",
    "voiceId": "rachel"
  },
  "endCallMessage": "Thank you for calling. Goodbye!",
  "maxDurationSeconds": 600
}
```

**LLM prompt generation** will use tool calling to extract structured output: system prompt text + knowledge base content + first message, ensuring consistency.

**Firecrawl extraction** will pull: services, about, FAQs, pricing, contact details — same approach as the chatbot flow but with an enhanced prompt focused on voice assistant context.

