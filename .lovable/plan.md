# Auto Knowledge Base Generator

Additive internal processing step. No new public endpoints. Plugs into existing `create-chatbot` and `create-voice-agent` pipelines.

---

## Architecture: Two-Layer Speed Design

**Layer 1 — System Prompt (instant, no lookup):**
Top business facts injected directly: name, location, top 5 services, pricing summary, hours, contact, top 5 objections + responses, escalation rules, tone. Handles ~80% of routine questions with zero latency.

**Layer 2 — KB Retrieval (deep, on-demand):**
Full chunks + embeddings in `knowledge_base_entries`. Queried via existing `search_knowledge_base` tool only when user asks something the prompt doesn't already cover.

---

## Flow (runs internally, triggered on agent setup)

```text
website URL
   ↓
[1] Firecrawl map + scrape (existing build-knowledge-base logic, expanded)
   ↓ clean markdown (nav/footer stripped, onlyMainContent:true)
[2] LLM Architect call (Lovable AI gateway, google/gemini-2.5-pro)
   ↓ returns JSON: { chatbot_kb_md, voice_kb_text, prompt_core }
[3] Store:
     - knowledge_base_entries (chunked + embedded for RAG)
     - chatbots.kb_chatbot_md      (full markdown, for inspection/export)
     - chatbots.kb_voice_text      (spoken-language KB)
     - chatbots.prompt_core         (top facts injected into system prompt)
[4] Inject prompt_core into:
     - chatbot system_prompt (create-chatbot / chatbot-conversation)
     - Vapi assistant system prompt (create-voice-agent)
```

---

## Backend changes

### Migration
Add 3 columns to `chatbots`:
- `kb_chatbot_md text`
- `kb_voice_text text`
- `prompt_core jsonb` — `{ business, location, services[], pricing_summary, hours, contact, top_objections[], escalation, tone, top_intents[] }`

### Modified: `supabase/functions/build-knowledge-base/index.ts`
After existing scrape + chunk + embed loop, add an "Architect" phase:
1. Concatenate all cleaned page markdown (cap ~60k chars).
2. Call Lovable AI `google/gemini-2.5-pro` with strict JSON schema:
   - `chatbot_kb_md` — structured markdown (overview, services, 20+ FAQs, pricing, policies, objections, contact). Mark unknown as `[DATA NEEDED]`.
   - `voice_kb_text` — flowing spoken-language paragraphs (no bullets/markdown), intent handling, escalation rules, tone, never-say list.
   - `prompt_core` — compact JSON of top facts (see above).
3. Save all three to `chatbots` row.
4. Also chunk `chatbot_kb_md` and re-embed into `knowledge_base_entries` (replaces raw-scrape chunks for higher-quality retrieval). Raw scrape chunks kept too, tagged `content_type='raw'`.

### Modified: `supabase/functions/create-chatbot/index.ts`
- After insert, if `website_url`, fire-and-forget invoke `build-knowledge-base` (already does this — confirmed). No change beyond reading new fields if present.

### Modified: `supabase/functions/create-voice-agent/index.ts`
- Before building Vapi assistant prompt, load chatbot's `prompt_core` + `kb_voice_text` (if exist) and inject into the system prompt under `## CORE FACTS` and `## VOICE KB` sections.

### Modified: `supabase/functions/chatbot-conversation/index.ts`
- Inject `prompt_core` block at top of system prompt for instant answers; existing RAG `match_kb_entries` stays as fallback for deeper questions.

### Modified: `supabase/functions/search-knowledge-base/index.ts`
- No change. Existing vector search already covers the embedded chunks (now higher quality).

### Modified: `supabase/functions/create-demo/index.ts`
- After voice + chatbot created, ensure KB build is triggered once for the chatbot (already happens via `create-chatbot`). Add 5s wait + best-effort fetch of `prompt_core` to inject into voice assistant on first build (otherwise voice agent picks it up on next invocation).

---

## Frontend changes

### `src/components/admin/KnowledgeBasePanel.tsx`
Add tabs to show generated KBs:
- **Chatbot KB** (rendered markdown, with `[DATA NEEDED]` highlighted)
- **Voice Agent KB** (plain text preview)
- **Core Facts** (JSON viewer)
- **Embeddings** (existing entries count + jobs table)

Add "Regenerate KB" button (calls existing `build-knowledge-base`).

---

## Guarantees
- Per-business isolation: every KB scoped by `chatbot_id`. No cross-tenant queries.
- No new public endpoints. Internal step inside existing `build-knowledge-base`.
- Backward compatible: if Architect call fails, raw-scrape embeddings still work (current behavior preserved).
- Fast: routine questions answered from system prompt; KB lookups only for edge cases.

Approve to implement.