
# AI Inbox Manager — Build Plan

A new, **fully additive** feature. Nothing in the existing system (create-demo, tracking, follow-ups, knowledge base, ecommerce, real estate, admin panel) is touched. New tables, new edge functions, new admin tab.

---

## 1. Database (new tables only)

All in `public` schema with proper GRANTs + RLS (admins read/write via service role from edge functions; authenticated users can read for the dashboard).

**`prospects`**
- email (unique), firstname, company, website_url
- campaign_id, campaign_name, sender_email, reply_to_email
- automation_paused (bool, default false)
- last_message_at (for sort), last_classification

**`inbox_messages`**
- prospect_id → prospects
- manyreach_message_id (for reply threading)
- direction ('incoming' | 'outgoing')
- source ('email' default)
- subject, body
- classification ('Positive' | 'Negative' | 'Objection' | null)
- classified_by ('ai' | 'human' | null)

**`inbox_demos`**
- prospect_id → prospects
- demo_url, business_name
- Links a generated demo to a prospect (separate from existing `demo_pages` — we just store the resulting URL here for quick lookup)

Realtime enabled on `inbox_messages` and `prospects` for live UI updates.

---

## 2. Edge Functions (all new, none modified)

1. **`webhook-manyreach-reply`** (public, no JWT) — receives ManyReach webhook, upserts prospect by email, inserts incoming message row, returns 200 immediately, then async-invokes `inbox-process-incoming`.
2. **`inbox-process-incoming`** — orchestrator. If `automation_paused`, stop. Otherwise: call classify → if Positive/Negative and no demo → call existing `/create-demo` and store in `inbox_demos` → call generate-reply → call send-reply.
3. **`inbox-classify`** — pulls full thread history, computes `demo_sent` flag (scans outgoing messages for `aiagentfor.lovable.app`), calls Lovable AI (`google/gemini-3-flash-preview`) with classification system prompt, returns one of Positive/Negative/Objection. Saves to message row.
4. **`inbox-generate-reply`** — picks template by classification (Positive / Negative / Objection prompts stored in new `inbox_prompts` admin-editable table, seeded with sensible defaults including the new Objection prompt), injects demo_url + firstname + company, calls Lovable AI, returns reply text.
5. **`inbox-send-reply`** — POSTs to `https://api.manyreach.com/api/v2/messages/reply` using existing `MANYREACH_API_KEY` secret, then inserts outgoing message row.
6. **`inbox-manual-reply`** — same send path but invoked from the dashboard with a user-typed body; marks `classified_by='human'`.
7. **`inbox-actions`** — small endpoint for toggling `automation_paused`, manually re-classifying a message, regenerating an AI draft (returns text, does NOT auto-send), and manually triggering demo generation for a prospect.

All functions are new. Existing `/create-demo` is **called** (HTTP) by the orchestrator — not modified.

---

## 3. Admin UI

New sidebar/tab entry in `AdminDashboard.tsx`: **"Inbox"** (added alongside existing tabs, nothing removed).

New file `src/pages/admin/InboxManagerPage.tsx` (or component under `src/components/admin/inbox/`), structured as:

```text
┌─────────────────────────────────────────────────────────┐
│  Stats bar: Today/Week · %Pos · %Neg · %Obj · Demos · Reply Rate │
├──────────────┬──────────────────────────────────────────┤
│ Search +     │  Header: name · company · email · campaign │
│ filter chips │  [Pause Automation ▢]                     │
│ (All/Pos/    │  ──────────────────────────────────────── │
│ Neg/Obj/     │  Demo card: URL+copy OR "Generate Demo"   │
│ Paused)      │  ──────────────────────────────────────── │
│              │  Thread bubbles (incoming gray / outgoing │
│ Conversation │   blue), classification badge + relabel    │
│ rows with    │   pencil on each incoming                  │
│ dot, name,   │  ──────────────────────────────────────── │
│ snippet,     │  [textarea] [Send] [Regenerate AI Reply]  │
│ time         │                                           │
└──────────────┴──────────────────────────────────────────┘
```

Components:
- `InboxStatsBar.tsx` — 6 metric cards via aggregate queries.
- `ConversationList.tsx` — search, filter chips, Supabase Realtime subscription on `inbox_messages`.
- `ThreadView.tsx` — header, pause toggle, demo card, message bubbles, classification badge + relabel dropdown.
- `ReplyComposer.tsx` — textarea, Send (manual-reply), Regenerate AI Reply (calls `inbox-actions` → fills textarea, does not auto-send).
- `InboxPromptsPanel.tsx` (small sub-section) — edit the 3 reply prompt templates.

States: loading skeletons, empty state, error toasts with retry, optimistic send (revert on failure). Responsive: panels stack on mobile with back button from thread → list.

---

## 4. Build Order

1. Migration: `prospects`, `inbox_messages`, `inbox_demos`, `inbox_prompts` (+ GRANTs, RLS, realtime, seed prompts).
2. Edge functions in order: `webhook-manyreach-reply`, `inbox-classify`, `inbox-generate-reply`, `inbox-send-reply`, `inbox-process-incoming`, `inbox-manual-reply`, `inbox-actions`.
3. Admin UI read-only (list + thread + stats).
4. Manual controls (pause, relabel, manual reply, regenerate, manual demo).
5. End-to-end test by POSTing a sample ManyReach payload to the webhook.

---

## 5. Open Questions (will use sensible defaults unless you say otherwise)

- **Objection flow**: by default I will **also** auto-generate a demo if none exists, then send a non-pushy reply that addresses the concern and includes the demo link. Say "objection = reply only, no demo" if you'd prefer.
- **Re-classify on every reply**: yes (matches your current n8n behavior).
- **Webhook auth**: ManyReach doesn't sign payloads, so the webhook will be public + protected by a shared secret query param (`?key=...`) stored in Supabase secrets. I'll generate this secret.
- **Prompts**: I'll seed Positive/Negative with the same intent you've used in n8n (you can paste the exact text afterwards into the admin editor) and write an Objection prompt from scratch.

Nothing in the existing app (create-demo, tracking, follow-ups, KB, ecommerce templates, real estate template, current admin tabs) will be modified.
