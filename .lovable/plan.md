# E-Commerce AI Agent Upgrade

Targeted upgrade of the existing e-commerce pipeline. Existing behavior stays intact — only the four areas below change.

## 1. OpenRouter Migration

**Add secret:** `OPENROUTER_API_KEY` (request via add_secret).

**New shared helper** `supabase/functions/_shared/openrouter.ts`:

- `chatCompletion(model, messages, opts)` and `createEmbedding(text)`
- Adds `Authorization`, `HTTP-Referer` (from `SITE_URL`), `X-Title: "AI Agency Dashboard"`
- try/catch with automatic fallback to `openai/gpt-4o-mini`
- Central `MODELS` const:
  ```
  ecommerce_chat: "anthropic/claude-3.5-haiku"
  extraction:     "google/gemini-2.0-flash-001"
  kb_build:       "anthropic/claude-3.5-haiku"
  voice:          "anthropic/claude-3.5-haiku"
  fallback:       "openai/gpt-4o-mini"
  embedding:      "openai/text-embedding-3-small"
  ```

**Files swapped from `ai.gateway.lovable.dev` → OpenRouter helper:**

- `scrape-ecommerce-products/index.ts` (embeddings)
- `build-knowledge-base/index.ts` (embeddings + LLM)
- `chatbot-conversation/index.ts` (chat + new query-parse step)
- `recommend-products/index.ts` (embedding + voice response)
- `create-demo/index.ts` (Gemini extraction + brand voice + templates)

Scope: only these five e-commerce-related functions. Other functions (inbox, follow-ups, etc.) keep their current Lovable AI setup to avoid regressions.

## 2. RAG Pipeline Upgrade

**2A — Richer embedding text** in `scrape-ecommerce-products`: replace `embeddingText` with `buildEmbeddingText` (title, category, brand, tags as natural language, options + values, price range, stock, cleaned description capped at 500 chars).

**2B — Hybrid search** (DB migration):

- New SQL function `match_products_hybrid(chatbot_id, embedding, query_text, match_count, filters jsonb)`
- Score = `0.7 * vector_similarity + 0.3 * ts_rank`
- Filters: `max_price`, `min_price`, `category`, `vendor`, `in_stock`
- GIN index on `to_tsvector('english', name || description || category)`
- Proper GRANTs (`authenticated`, `service_role`)

**2C — Query understanding** in `chatbot-conversation`:

- `parseShoppingQuery(message)` → JSON `{ search_query, max_price, min_price, category, vendor, in_stock_only, intent, quantity, attributes }`
- 60s in-memory Map cache keyed by message hash
- `intent="policy"` skips product RAG (KB only)

**2D — Dynamic top-K:** browse=6, find_specific=3, compare=6, gift=4, default=5.

**2E — Reranking:** in_stock first; sale items (`compare_at_price > price`) get +0.05 boost; out-of-stock included only if fewer than 3 in-stock found.

## 3. System Prompt Rewrite

**3A** — Update `industry_templates` row where `industry='ecommerce'` (data update via insert tool) with the new template: identity, RAG rules, short-answers-rich-cards rule, mandatory recommendations comment, one clarifying question, per-query-type handling (price/size/comparison/gift/OOS/policy/vague), and "never do" list.

**3B — Brand tone injection:**

- In `create-demo`, add `buildToneInstruction(brand_voice)` using Claude Haiku
- Store in `chatbots.widget_config.tone_instruction`
- Inject `{brand_tone_instruction}` and `{product_count}` at chat time in `chatbot-conversation`

**3C — Voice prompt:** replace ecommerce branch of `buildGenericVoicePrompt` in `create-demo` with the 2-sentence-max, spoken-price, "we have" phrasing block.

## 4. Chatbot UI Polish

Files: `RecommendationCards.tsx`, `EcommerceChatWindow.tsx`, `ChatMessage.tsx`, new `TypingIndicator`, new `ChatEmptyState`.

- **Product cards:** 200px min, horizontal scroll, 200×200 image with top-only radius, sale badge + savings line, stock pill, disabled-when-OOS View Product button, Framer Motion stagger (`delay: i*0.06`, spring 300/28).
- **Bubbles:** bot = white + slate-200 border + 28px brand avatar + radius `4/18/18/18`; user = brand bg + radius `18/4/18/18`; timestamp only every 5 min.
- **Typing indicator:** 3-dot bounce shown between send and first streamed token.
- **Input bar:** slate-100 rounded textarea (auto-expand 36–120px), voice mic button (pulse when listening), circular send button with loading spinner, quick-reply chip row above.
- **Header:** 56px, logo + "[Business] AI" + "● Online · Knows N products", Voice toggle button.
- **Empty state:** logo, greeting with product count, 2×2 suggestion grid (bestsellers / gift ideas / under $50 / return policy) that send the text on click.

Uses existing design tokens — no new palette. Framer Motion is already in the project.

## Technical Details

**New/changed files**

- Add: `supabase/functions/_shared/openrouter.ts`
- Add: `src/components/chatbot/TypingIndicator.tsx`, `ChatEmptyState.tsx`
- Modify: 5 edge functions listed in Part 1, plus `RecommendationCards.tsx`, `ProductCard.tsx`, `EcommerceChatWindow.tsx`, `ChatMessage.tsx`
- Migration: `match_products_hybrid` + GIN index + GRANTs
- Data update: `industry_templates` ecommerce row; retains old `match_products` (still used by voice tool fallback)

**Backward compatibility**

- Old `match_products` function kept — voice `recommend-products` continues to work while migrated.
- `LOVABLE_API_KEY` left untouched (other functions still use it).
- No schema change to `products` table; hybrid function reads existing columns.

**Order of build**

1. Add secret → shared helper → swap 5 functions
2. Migration for hybrid search + GIN index
3. Query parsing + dynamic top-K + reranking in `chatbot-conversation`
4. Prompt template update + tone instruction + voice prompt
5. UI: cards → bubbles → typing → input → header → empty state

**Out of scope**

- Inbox, follow-ups, workflow, health-check, and non-ecommerce demo flows are untouched.
- No changes to `products` schema, VAPI config, or auth.

Add two things to the existing e-commerce chatbot system:

1. An admin panel section showing full chatbot conversation 

   history across all demos (what visitors type, what AI 

   replies, how they engage)

2. An auto-improvement pipeline that analyzes conversation 

   patterns and suggests/applies system prompt improvements 

   over time. Backend: Supabase + Edge Functions + OpenRouter.

   Do NOT touch existing chatbot-conversation logic.

## PART 1: DATABASE ADDITIONS

New table: chatbot_sessions

- id (uuid PK)

- chatbot_id (uuid FK → chatbots)

- demo_page_id (uuid FK → demo_pages)

- business_name (text — denormalized for fast display)

- session_id (text — anonymous visitor session)

- started_at (timestamptz, default now())

- last_message_at (timestamptz)

- total_messages (int, default 0)

- user_messages (int, default 0)

- bot_messages (int, default 0)

- interaction_type (text: chat/voice/both)

- products_shown (int, default 0)

- products_clicked (int, default 0)

- sentiment_score (float, nullable — computed 

  after session ends, -1.0 to 1.0)

- outcome (text: browsed/engaged/clicked_product/

  abandoned/unknown, default unknown)

- flagged_for_review (bool, default false)

- flag_reason (text, nullable)

New table: chatbot_messages

- id (uuid PK)

- session_id (uuid FK → chatbot_sessions)

- chatbot_id (uuid FK → chatbots)

- role (text: user/assistant)

- content (text — full message text)

- products_shown (jsonb, nullable — array of 

  product names/prices shown in this message)

- query_intent (text, nullable — parsed intent: 

  browse/find_specific/compare/policy/size/gift)

- response_quality_score (float, nullable — 

  computed: 0-1, how good was this response)

- was_helpful (bool, nullable — inferred from 

  whether user continued positively after)

- created_at (timestamptz, default now())

New table: prompt_improvement_suggestions

- id (uuid PK)

- chatbot_id (uuid FK → chatbots, nullable — 

  null means applies to all ecommerce chatbots)

- industry (text, default ecommerce)

- suggestion_type (text: add_rule/modify_rule/

  add_example/fix_failure/tone_adjustment)

- current_behavior (text — what the AI currently 

  does wrong, with example)

- suggested_change (text — exact wording to 

  add/change in the system prompt)

- evidence (jsonb — array of session/message IDs 

  that demonstrate the problem)

- occurrence_count (int, default 1)

- status (text: pending/approved/applied/rejected)

- applied_at (timestamptz, nullable)

- created_at (timestamptz, default now())

New table: prompt_versions

- id (uuid PK)

- chatbot_id (uuid FK → chatbots, nullable)

- industry (text)

- version_number (int)

- system_prompt (text — full prompt at this version)

- change_summary (text — what changed from prev)

- suggestions_applied (uuid array — IDs from 

  prompt_improvement_suggestions)

- applied_by (text: auto/manual)

- created_at (timestamptz, default now())

## PART 2: WIRE CONVERSATION LOGGING

In existing chatbot-conversation/index.ts, 

after each exchange, add logging WITHOUT 

changing the core chat logic:

On FIRST message of a session:

  INSERT INTO chatbot_sessions:

    chatbot_id, demo_page_id, session_id,

    business_name (from chatbots join),

    started_at = now()

On EVERY message (user or assistant):

  INSERT INTO chatbot_messages:

    session_id, chatbot_id, role, content,

    products_shown (parse from 

      <!--recommendations:[...]-->  if assistant),

    query_intent (from parseShoppingQuery result 

      if already computed — reuse, don't re-call),

    created_at = now()

  

  UPDATE chatbot_sessions:

    last_message_at = now(),

    total_messages++,

    user_messages++ (if role=user),

    bot_messages++ (if role=assistant),

    products_shown += count of products in 

      this message if role=assistant

All logging wrapped in try/catch — 

logging failure must NEVER affect the 

chat response. Fire-and-forget pattern:

  waitUntil(logConversation(...)) 

  — do not await in the main response path.

## PART 3: SESSION ANALYSIS (runs after session ends)

Edge Function: analyze-chat-session

Triggered: via pg_cron every hour, processes 

sessions where last_message_at < now() - 30min 

AND outcome = 'unknown' (session has ended)

For each ended session:

STEP 1 — Compute outcome:

  Read all messages for this session.

  IF products_clicked > 0: outcome = 'clicked_product'

  ELSE IF products_shown > 0 AND user_messages > 2: 

    outcome = 'engaged'

  ELSE IF user_messages > 0: 

    outcome = 'browsed'

  ELSE: outcome = 'abandoned'

STEP 2 — Sentiment analysis:

  Send all user messages to OpenRouter 

  claude-3.5-haiku:

  "Rate the overall visitor sentiment in 

  this conversation from -1.0 (frustrated/

  negative) to 1.0 (positive/satisfied). 

  Return only a JSON number."

  Store in chatbot_sessions.sentiment_score

STEP 3 — Quality scoring per bot message:

  For each assistant message, score quality:

  Call claude-3.5-haiku:

  "Rate this chatbot response 0.0-1.0 for 

  helpfulness and relevance to the user's 

  question. Context: [user question before it].

  Response: [assistant message].

  Return JSON: { score: float, reason: string }"

  Store in chatbot_messages.response_quality_score

  

  was_helpful inference:

  If the next user message after this bot 

  message is positive or continues the 

  conversation naturally → was_helpful = true

  If next message shows frustration or 

  repeats the same question → was_helpful = false

STEP 4 — Flag for review:

  Auto-flag sessions where:

  - sentiment_score < -0.3 (frustrated visitor)

  - Any bot message quality_score < 0.4

  - User sent same question 2+ times 

    (repeated question = AI failed to answer)

  - Session has 1 user message then stopped 

    (immediate abandonment after first response)

  Set flagged_for_review = true, 

  flag_reason = [which condition triggered]

## PART 4: AUTO-IMPROVEMENT PIPELINE

Edge Function: generate-prompt-improvements

Runs: via pg_cron weekly (or manually triggered 

from admin panel)

STEP 1 — COLLECT FAILURE PATTERNS:

Query chatbot_messages where 

  response_quality_score < 0.5

  OR was_helpful = false

  AND created_at > now() - 7 days

Group by query_intent. Find patterns:

  "browse" intent with low scores → 

    AI not showing enough products?

  "policy" intent with low scores → 

    policy answers too vague?

  "size_help" intent with low scores →

    not using variant data well?

STEP 2 — COLLECT REPEATED QUESTIONS:

Find user messages that appear 2+ times 

with semantic similarity > 0.85 

(embed each and compare) where the 

bot response had low quality.

These are questions the system consistently 

fails at → high priority to fix.

STEP 3 — ANALYZE WITH AI:

Send failure patterns to claude-3.5-haiku:

System: "You are an AI system prompt engineer 

specializing in e-commerce chatbots. Analyze 

these conversation failures and suggest 

specific improvements to the system prompt."

User: "Here are [N] failed conversations 

from our e-commerce chatbot this week:

FAILURES:

[For each flagged session: 

  User asked: [message]

  Bot replied: [message]  

  Quality score: [score]

  Reason: [reason]

  Outcome: [outcome]]

CURRENT SYSTEM PROMPT SECTION:

[relevant section of current prompt]

Identify the top 3 most impactful improvements.

For each, return JSON:

{

  suggestion_type: 'add_rule|modify_rule|

    add_example|fix_failure|tone_adjustment',

  current_behavior: 'what the AI does wrong',

  suggested_change: 'exact text to add or 

    replace in the system prompt',

  evidence_sessions: [session_id array],

  occurrence_count: N

}"

STEP 4 — STORE SUGGESTIONS:

Insert each suggestion into 

prompt_improvement_suggestions with 

status='pending'.

STEP 5 — AUTO-APPLY HIGH CONFIDENCE:

If occurrence_count >= 10 (same failure 

10+ times this week) AND suggestion_type 

= 'add_rule' or 'fix_failure':

  Auto-apply: update the industry_templates 

  system_prompt_template, create a 

  prompt_versions row, set status='applied'.

  

  Notify admin: insert into notifications

  { type: 'prompt_improved', 

    title: 'System prompt auto-updated',

    message: 'Applied 1 improvement based 

    on [N] conversation failures this week' }

For lower confidence suggestions: 

  status='pending', show in admin for 

  manual review/approval.

## PART 5: ADMIN PANEL — CONVERSATION MONITOR PAGE

New page: /admin/conversations

Add to sidebar nav as "💬 Conversations"

### TOP STATS ROW (4 cards):

Total Sessions (this week) | Avg Messages/Session | 

Avg Sentiment Score (colored: green if >0.3, 

amber if -0.3 to 0.3, red if <-0.3) | 

Product Click Rate %

### FILTER BAR:

[All Demos ▼] — dropdown of business names

[All Outcomes ▼] — browsed/engaged/clicked/abandoned

[Date range picker]

[🚩 Flagged only] toggle

[Search: visitor said...] — text search on 

  chatbot_messages.content

### MAIN LAYOUT: two-panel (same as Inbox page)

LEFT PANEL (360px) — Session List:

Each row (h-[72px], px-4, py-3):

  Left: business logo (28px) + avatar initials 

    (36px, color by sentiment: green/amber/red)

  Center:

    Row 1: business_name (font-semibold text-sm) 

      + outcome pill (xs, color-coded)

    Row 2: first user message preview (truncated, 

      text-xs slate-500)

    Row 3: "[N] messages · [X] products shown" 

      text-xs slate-400

  Right: 

    Relative time (text-xs slate-400)

    🚩 flag icon if flagged_for_review = true 

      (red, with flag_reason on hover)

    Sentiment dot: ● green/amber/red

Sort: newest first by default.

Real-time: Supabase Realtime subscription on 

  chatbot_sessions → new sessions appear at top 

  with a slide-in animation (like Inbox new messages).

  Live badge: "● 3 active now" (sessions with 

  last_message_at within last 5 minutes — 

  these are LIVE visitors in the chatbot right now)

RIGHT PANEL — Full Conversation View:

Opens when a session row is clicked.

HEADER (h-[64px], white, border-b):

  Left: business logo + "[Business Name] Demo" 

    + outcome badge + sentiment score display

  Right: [🚩 Flag] toggle + [✓ Reviewed] button 

    + session ID (text-xs slate-400, copyable)

SESSION STATS STRIP (below header, 

  slate-50 bg, px-5 py-3, border-b):

  Started: [time] · Duration: [X min] · 

  Messages: [N] · Products shown: [N] · 

  Products clicked: [N] · 

  Outcome: [badge] · Sentiment: [score + bar]

CONVERSATION THREAD (scrollable, 

  same style as Inbox chat bubbles):

  User messages: right-aligned, slate-100 bg

    Below bubble: intent badge if detected 

    (text-xs, "Intent: browse" in slate-400)

  Bot messages: left-aligned, white bg border

    Below bubble: quality score badge 

    (text-xs: "Quality: 0.8 ●" green/amber/red)

    + was_helpful indicator: "✓ Helpful" 

    (success-600) or "✗ Not helpful" (danger-600)

    if was_helpful is not null

  Product cards shown: render the actual 

    RecommendationCards component (same as 

    demo page) so admin sees exactly what 

    the visitor saw

  Timestamps on every message in admin view 

    (not the 5-min rule from chat UI)

FLAG REASON BANNER (if flagged):

  Amber bg banner at top of thread:

  "⚠️ Flagged: [flag_reason]"

  [Mark as Reviewed] button removes flag

QUALITY ISSUES PANEL (collapsible, 

  below thread, if session has quality issues):

  Lists the low-quality messages with 

  the AI's assessment reason:

  "Step 3: Score 0.3 — Response didn't 

  use product data, gave generic answer"

### IMPROVEMENT SUGGESTIONS TAB

Add a second tab to this page: "💡 Improvements"

SUGGESTION LIST:

Each suggestion card:

  Header: suggestion_type badge + 

    "Found in [N] sessions this week"

  "What's happening:" [current_behavior text]

  "Suggested fix:" [suggested_change text in 

    a code-style block — it's prompt text]

  "Evidence:" [N] sessions link → 

    clicking filters the session list to 

    show only those sessions

  

  Action buttons:

    [✓ Apply to Prompt] → status='applied', 

      updates industry_templates, creates 

      prompt_versions row, shows success toast

    [✗ Reject] → status='rejected', 

      removes from list

    [Edit & Apply] → opens edit modal where 

      admin can modify the suggested_change 

      text before applying

PROMPT VERSION HISTORY (below suggestions):

Table of prompt_versions, newest first:

  Version # | Changed at | Applied by (auto/manual) | 

  Changes summary | [View diff] | [Rollback]

  

  [View diff] opens a modal showing 

    side-by-side before/after of the prompt text

  [Rollback] restores the previous version 

    (creates a new version_row with the 

    old prompt text, doesn't delete history)

MANUAL IMPROVE BUTTON:

[🔄 Run Analysis Now] button at top of 

Improvements tab. Triggers 

generate-prompt-improvements Edge Function 

immediately (not waiting for weekly cron).

Shows spinner + "Analyzing [N] conversations 

from the last 7 days..." while running.

On complete: refreshes suggestion list.

### LIVE MONITOR VIEW (new sub-tab: "🔴 Live")

Shows sessions with last_message_at within 

last 5 minutes — visitors actively using 

the chatbot RIGHT NOW.

Simple list: business name, how long they've 

been chatting, last message sent (live update 

via Supabase Realtime).

Clicking opens the full thread which updates 

in real time as new messages arrive.

No action buttons needed — read only.

Just shows "● 0 active" or "● 3 active" 

depending on live sessions.

### NOTIFICATION FOR NEW FLAGGED SESSIONS

In the existing notifications system 

(bell icon in header): when analyze-chat-session 

flags a session, insert a notification:

{ type: 'chat_flagged',

  title: 'Low quality chat flagged',

  message: '[Business Name] demo — visitor 

    frustrated. 3 messages with quality < 0.4',

  action_url: '/admin/conversations/[session_id]' }

This means you don't need to check the 

conversations page constantly — the bell 

tells you when something needs attention.

## PART 6: PRODUCT CLICK TRACKING

To populate products_clicked stat, add tracking 

when a visitor clicks [View Product] button on 

a product card in the chatbot.

In EcommerceChatWindow.tsx, on product card 

[View Product] click:

  Before opening the URL, fire:

  POST /functions/v1/track-chat-event

  { session_id, event: 'product_clicked', 

    product_name, product_url, chatbot_id }

Edge Function: track-chat-event (simple, fast):

  Updates chatbot_sessions.products_clicked++

  Inserts into activity_logs

  Returns 200 immediately

This gives you the conversion signal: 

"visitor clicked through to buy" = the chatbot 

actually helped them find something.

## BUILD ORDER

1. Database tables (chatbot_sessions, 

   chatbot_messages, prompt_improvement_suggestions,

   prompt_versions)

2. Conversation logging in chatbot-conversation 

   (fire-and-forget, no impact on response speed)

3. track-chat-event Edge Function 

   + product click wiring in frontend

4. analyze-chat-session Edge Function + 

   pg_cron schedule (hourly)

5. Admin conversations page — session list + 

   thread view (read-only first)

6. Live monitor sub-tab (Realtime subscription)

7. Flagged session notifications (bell icon)

8. generate-prompt-improvements Edge Function + 

   weekly cron

9. Improvements tab — suggestion cards + 

   apply/reject actions

10. Prompt version history + diff view + rollback

11. Manual "Run Analysis Now" button