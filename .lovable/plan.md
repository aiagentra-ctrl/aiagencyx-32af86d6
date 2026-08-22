# Native Vapi Knowledge Files for Every Voice Agent

Today both agent-creation paths (`create-demo` and `create-voice-agent`) upload a Vapi knowledge file only when the voice KB text happens to be longer than 400 characters, and the file content is just `kb_voice_text` (plus the menu for restaurants). Everything else the agent knows still comes from the `search_knowledge_base` tool round-trip. The prompts also still instruct the agent to always call the tool first.

Goal: every agent gets one complete, researched knowledge file attached natively in Vapi, the agent reads from it first, and the custom tools stay wired in purely as fallback.

## What changes

### 1. One shared knowledge-document builder
New `supabase/functions/_shared/vapi-kb-doc.ts` that assembles a single markdown document per business from everything we already gather:

- Business overview, contact, hours, location (from `prompt_core` / structured data)
- The curated chatbot KB markdown (`kb_chatbot_md`) — richer than the voice text
- The spoken-language voice KB (`kb_voice_text`)
- Restaurant menu section / e-commerce product catalog / real-estate listings when present
- Scraped page content from `knowledge_base_entries` as a fallback body when the curated KBs are missing
- FAQs, pricing, policies, objection handling

It returns `{ markdown, sourceCounts, thin: boolean }` so callers can log what went in and detect a genuinely empty business.

### 2. Always build and upload
Both `create-demo` and `create-voice-agent` call the builder and upload unconditionally (drop the 400-char gate). If the document comes back thin, we still scrape/architect first (reuse the existing Firecrawl + KB-architect path) before uploading, so an agent is never created with an empty file. Upload failures are logged and simply leave the agent on tool-only mode.

### 3. Track and replace files
Store returned Vapi file ids on the chatbot row (new `vapi_file_ids jsonb` column via migration) so regenerating an agent deletes the previous file with `deleteVapiFile` instead of leaking orphans in the Vapi account.

### 4. Prompt rules flip to KB-first
Replace the current "ALWAYS call search_knowledge_base before answering factual questions" block with an attached-KB variant used whenever a file is attached:

- Answer from CORE FACTS and the attached knowledge base first — no tool call.
- Call `search_knowledge_base` only if the knowledge base has no answer, returns nothing, or errors.
- If both fail, say the existing fallback line.

The same switch applies to the restaurant builder (it already accepts `knowledgeBaseAttached`) and to the local-biz and real-estate builders, which get the same flag so the raw KB text is no longer duplicated into the prompt when it is attached as a file. This also shortens prompts noticeably, which helps latency.

### 5. Tools stay, descriptions updated
`search_knowledge_base`, `recommend_products`, and the restaurant/appointment tools remain attached exactly as now. Only the KB tool's description changes to "fallback lookup when the attached knowledge base does not contain the answer".

## Technical notes

- Files affected: `_shared/vapi-kb-doc.ts` (new), `_shared/vapi-files.ts` (reuse delete helper), `create-voice-agent/index.ts`, `create-demo/index.ts`, `_shared/restaurant-prompt.ts`, `_shared/localbiz-prompt.ts`, `_shared/realestate-prompt.ts`, plus one migration adding `chatbots.vapi_file_ids`.
- Vapi shape stays as verified: `POST /file` multipart with `text/markdown`, then `model.knowledgeBase = { provider: "canonical", fileIds }`.
- Verification: create a test assistant for a real scraped business, confirm the file uploads and is attached, confirm the prompt contains the KB-first rules and no duplicated KB dump, then delete the test assistant and file.
