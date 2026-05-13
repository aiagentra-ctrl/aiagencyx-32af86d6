# Voice Agent RAG + Simplified Follow-Up System

Two additive workstreams. No existing endpoints destroyed. Existing chatbot RAG, dental/real-estate templates, and current `demo_leads` flow stay intact.

---

## Part 1 — Voice Agent RAG Tool (Vapi tool-calling)

### Goal
Vapi voice assistant calls `search_knowledge_base(query)` on every user turn, speaks ONLY from KB results, falls back to "Let me check with our team on that." when empty.

### Backend
- Reuse existing `search-knowledge-base` edge function (already deployed, vector-searches `knowledge_base_entries`).
- Add a thin Vapi-friendly response shape: `{ results: [{ title, content, source_url }] }` — already returned, just formalize.
- `chatbotId` field reused as `assistantId → chatbot mapping`. Add lookup: voice assistant's `metadata.chatbot_id` → KB scope.

### Vapi assistant config (in `create-voice-agent` / `create-ai-system`)
Register a custom tool on the assistant:
```
{
  type: "function",
  function: {
    name: "search_knowledge_base",
    description: "Search the business knowledge base. ALWAYS call this before answering any factual question.",
    parameters: { query: string, top_k: number }
  },
  server: { url: "{SUPABASE_URL}/functions/v1/search-knowledge-base" }
}
```
- Inject into system prompt: rule "ALWAYS call search_knowledge_base FIRST. Speak only from results. If empty → say: Let me check with our team on that."
- Pass `chatbotId` via Vapi `serverMessages.metadata` so the function knows which KB to query.
- Set `tool_choice: "auto"` and `modelOutputEnabled: true` for streaming.

### Files touched
- `supabase/functions/create-voice-agent/index.ts` — add tool registration block
- `supabase/functions/create-ai-system/index.ts` — same
- `supabase/functions/search-knowledge-base/index.ts` — accept Vapi's tool-call payload shape (`message.toolCalls[].function.arguments`) in addition to current `{chatbotId, query}`
- `industry_templates` real_estate row — append voice prompt rules

---

## Part 2 — Simplified 2-Case Follow-Up System

Replace current 3-condition (`not_tried` / `tried_voice_agent` / `tried_chatbot`) with **2 cases only**: Case 1 (no agent tried) + Case 2 (any agent tried). Existing `follow_up_templates` table reused — seed only `case1` and `case2` rows.

### Database changes (migration)

**Extend `demo_leads`** (additive columns only):
- `fingerprint text` — SHA-256 of UA+screen+tz+lang
- `tried_voice boolean default false`
- `tried_chat boolean default false`
- `voice_first_at timestamptz`
- `chat_first_at timestamptz`
- `followup_case1_sent boolean default false`
- `followup_case2_sent boolean default false`
- `feedback_requested boolean default false`
- `feedback_link_clicked boolean default false`
- `feedback_link_clicked_at timestamptz`
- `feedback_link_visit_count int default 0`

**New table `email_queue`**:
```
id, lead_id, type ('case1'|'case2'),
scheduled_at, sent_at, status ('pending'|'sent'|'cancelled'),
cancelled_reason
```
RLS: service-role full; anon/auth read.

**New table `followup_settings`** (single row, key/value):
- `case1_delay_hours` (default 24)
- `case2_delay_hours` (default 1)
- `from_name`, `from_email`
- (Email provider stays ManyReach — already configured)

**Realtime**: `ALTER PUBLICATION supabase_realtime ADD TABLE demo_leads, email_queue;`

### Edge functions

**`track-visitor`** (modify, additive):
- Accept optional `fingerprint` from client
- On `voice_call_started` → if `!tried_voice`: set `tried_voice=true`, `voice_first_at=now()`, enqueue case2 if `!followup_case2_sent`
- On `chatbot_message_sent` → mirror for chat
- On `session_start`/`page_view` (after 1st visit, has email, no agent tried) → enqueue case1 if not already queued/sent
- Enqueue = insert into `email_queue` with `scheduled_at = now() + delay`, cancel any pending case1 if case2 fires

**New `process-email-queue`** (cron every 5 min):
- Select `pending` rows where `scheduled_at <= now()`
- Re-validate conditions (lead state may have changed)
- If case1 but lead now `tried_any_agent` → mark `cancelled` (`reason: 'switched_to_case2'`) and enqueue case2
- Otherwise call existing `trigger-follow-up` logic to send via ManyReach using the `case1`/`case2` template
- Mark `sent` + flip `followup_caseN_sent` on lead

**Cron setup** via `pg_cron` + `pg_net` (insert tool, not migration — contains URLs/keys):
```sql
select cron.schedule('process-email-queue-5min', '*/5 * * * *',
  $$ select net.http_post(url:='.../process-email-queue', headers:='...', body:='{}'::jsonb) $$);
```

**`trigger-follow-up`** (modify): switch condition picker to 2-case logic only.

### Frontend (admin)

**New `FollowUpsPanel.tsx`** (new tab in `AdminDashboard`):
- Metrics row: total leads, case1 sent, case2 sent, feedback yes/no, pending in queue
- Leads table with filters (All / No agent / Agent tried / Feedback received)
- Lead drawer: event timeline (from `link_events`), emails sent, manual force-send/cancel buttons
- Email queue table with cancel action
- Settings card (delays, from name/email)

**Update `FollowUpTemplatesPanel.tsx`**: collapse 3 tabs → 2 tabs (`case1`, `case2`). Migration seeds the 2 rows from existing copy.

**Client tracking** (`src/lib/tracking.ts`):
- Add `getFingerprint()` — SHA-256 of UA+screen.width+timezone+language using SubtleCrypto
- Pass `fingerprint` on every `track-visitor` call
- Add `feedback_clicked` event firing on feedback URL pages

### Files
- New migration: extend demo_leads, create email_queue, followup_settings
- Insert tool: seed templates, schedule cron
- New edge function: `process-email-queue`
- Modified: `track-visitor`, `trigger-follow-up`, `create-voice-agent`, `create-ai-system`, `search-knowledge-base`, `tracking.ts`, `FollowUpTemplatesPanel.tsx`, `AdminDashboard.tsx`
- New: `FollowUpsPanel.tsx`, `LeadTimelineDrawer.tsx`

---

## Guarantees
- No destructive changes. Existing 3-condition templates archived (kept in DB), UI shows only case1/case2.
- Voice RAG only activates when KB entries exist for the chatbot — fallback "Let me check…" otherwise.
- Cron re-validates conditions before send → no duplicate emails.
- All new tables RLS-enabled.

Approve to implement.
