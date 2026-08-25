# Fix: email shown as company name + chatbot 503

Both bugs are confirmed with live checks, not guesses.

## Bug 1 — Raw email used as the business name

Verified in the database: the Walmart prospect row has `firstname` and `company` both empty, only `email = executive.communications@walmart.com` and `website_url = https://walmart.com`. The demo builder falls back to the email:

`business_name: prospect.company || prospect.firstname || prospect.email`

So the chatbot row was literally created with `business_name = "executive.communications@walmart.com"`, and every headline, button and greeting on the landing page renders that string. The webhook does read `prospect.company` / `prospect.firstname` when ManyReach sends them — for this lead it did not send them.

### Fix

1. Add a shared display-name resolver (next to the existing `website.ts` helper):
   - order: `company` -> a name derived from the website/business email domain (`walmart.com` -> "Walmart", multi-word domains title-cased) -> `firstname` -> the generic fallback `"your business"` / `"there"` for first name.
   - the resolver **never** returns a string containing `@`.
2. Use it everywhere a demo/chatbot/landing page is created from a prospect: `inbox-process-incoming` (3 call sites), `create-demo`, `create-chatbot`, and the follow-up/reply templates that inject `{{CompanyName}}` / `{{FirstName}}`.
3. Add a last-line guard in the landing-page personalisation layer (`personalize.ts` + the RE components): if a name value looks like an email address, swap it for the generic fallback before rendering. This means even old rows already stored with an email stop showing it.
4. Backfill the existing affected rows (chatbots / demo_pages) with the resolved name so current live links repair themselves.

## Bug 2 — Chatbot returns 503 on every message

Reproduced live against the deployed function. The real response is:

```
503 {"error":"AI credits exhausted. Please add a backup API provider.",
     "details":["OpenRouter: Claude Sonnet 5: credits exhausted"]}
```

The service is running fine — OpenRouter is returning HTTP 402 (out of credits) for the API key. Every chatbot goes through the same provider list, so this affects **all** demo links, not just this one. Note the chatbot rows say `ai_provider = "lovable"`, but the code has no Lovable AI path at all — it only ever calls OpenRouter, so when OpenRouter is dry there is nothing left to fall back to.

### Fix

1. Add the Lovable AI Gateway as a first-class provider in `chatbot-conversation` (and the shared model helper): `https://ai.gateway.lovable.dev/v1/chat/completions` with `LOVABLE_API_KEY`, model `google/gemini-3-flash` — it is OpenAI-compatible and streams, so it drops into the existing loop.
2. Ordering: when `chatbot.ai_provider = "lovable"` (all current rows) the gateway is the primary provider and OpenRouter/custom keys are fallbacks; otherwise the chatbot's own key stays first with the gateway as the final safety net.
3. Keep the status handling honest: `402`/`403` from the gateway surface the gateway's own message; `429`/`5xx` fall through to the next provider.
4. Replace the raw "Error 503" bubble in the chat UI with the readable message from the response body so a future outage is diagnosable from the widget.

## Verification (before I report back)

1. Create a test prospect with a real first name + company, and one with **only** a business email, run the demo build for both.
2. Open both landing pages in a real browser and confirm: no `@` anywhere in headline, buttons, greeting; the email-only lead shows "Walmart"-style derived name.
3. Send a real message through the chatbot on those links and confirm a streamed AI answer comes back (HTTP 200, non-empty content) — checked both via a direct function call and through the widget.
4. Capture screenshots of the page and of the working chat reply, and post them in chat with the test link.
5. Clean up the test prospect/demo rows afterwards.

## Technical notes

- Files touched: `supabase/functions/_shared/website.ts` (or a new `display-name.ts`), `inbox-process-incoming/index.ts`, `create-demo/index.ts`, `create-chatbot/index.ts`, `chatbot-conversation/index.ts`, `_shared/openrouter.ts`, `src/components/demo/realestate/v2/personalize.ts`, chat widget error rendering.
- One small backfill migration/SQL for existing `chatbots` / `demo_pages` rows whose `business_name` contains `@`.
- No schema changes beyond the backfill.
