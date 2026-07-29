
# Two workstreams: Webhook system, then Real-Estate landing redesign

## Part 1 — Proper webhook generation system

### Problem with today's setup
The URL is built as `/functions/v1/mr/<INBOX_WEBHOOK_SECRET>` — the raw shared secret is URL-encoded into the path. If the secret contains slashes or a URL, the result looks like a URL nested inside a URL, it can't be rotated without breaking every other integration that uses the same secret, and there is no way to have more than one endpoint.

### What gets built
**A real endpoint registry instead of a shared secret in the path.**

1. **New table `webhook_endpoints`** (with GRANTs + RLS, admin-only):
   - `id`, `label` (e.g. "ManyReach — Reply"), `token` (short opaque slug, e.g. `wh_7f3k9q2m4x8p`), `provider` (`manyreach` for now), `active`, `created_at`, `last_used_at`, `hit_count`, `last_status`.
   - Token is generated server-side, URL-safe, no encoding needed, unique per endpoint.

2. **New edge function `hook`** — the single public entry point:
   - `POST /functions/v1/hook/wh_7f3k9q2m4x8p` → looks the token up, records the hit, and passes the request into the existing shared `handleManyreachWebhook` logic.
   - `GET` on the same URL returns a small JSON health body (`{ok:true, endpoint:"…", ready:true}`) so providers that ping the URL before saving it succeed.
   - `OPTIONS` → CORS preflight.
   - Accepts JSON, form-encoded, and raw-text bodies; query params and custom headers are forwarded into the handler payload so nothing is lost.
   - Returns 404 for unknown tokens, 410 for deactivated ones — no timing-probe surface, no secret in the URL that can be replayed against other functions.

3. **Backward compatibility preserved** — `webhook-manyreach-reply` (`?key=`/`?secret=`/`x-webhook-key`) and the existing `/mr/<secret>` route stay exactly as they are. Nothing already wired into ManyReach breaks.

4. **New `manage-webhook-endpoints` function** for the admin panel: list, create, regenerate token, rename, activate/deactivate, delete.

### Admin UI (`WebhookUrlCard` → new `WebhookEndpointsCard`)
- Table of endpoints: label, full URL, status pill, hit count, last used, last response code.
- Per row: **Copy**, **Regenerate** (with confirm — warns the old URL stops working), **Test** (sends a real signed sample payload and shows status + latency), **Disable**, **Delete**.
- **+ New webhook** button.
- One "Legacy URLs" collapsible section at the bottom holding the two old formats so existing wiring is still discoverable.
- URL displayed in full, plain text, one click to copy — no masking, since the token is revocable and not the shared secret.

### Verification
Test each generated URL end to end from the sandbox: GET health, POST JSON reply payload, POST with query params, POST with unknown token, POST to a disabled endpoint — and confirm a prospect + inbox message actually lands.

---

## Part 2 — Real-estate landing page redesign

Rebuilt in place under `src/components/demo/realestate/v2/` so every real-estate demo page picks it up automatically. This replaces the current flat ivory/green look entirely.

### Colour + type system (scoped `.re-page` tokens rewritten)
| Role | Value |
|---|---|
| Dark bg | `#0B0F14` |
| Light bg | `#FAFAFA` |
| Card on dark | `#151B23`, border `#232B35` |
| Text on dark | `#F5F5F5` / muted `#9CA3AF` |
| Text on light | `#111318` / muted `#4B5563` |
| Brand blue (logo, icons, name highlight only) | `#3B82F6` |
| CTA orange (every button, no exceptions) | `#F97316` |
| Footer | `#05070A` |

Inter only (400–800); JetBrains Mono reserved exclusively for dashboard stat numbers. H1 56/800/-0.02em → H2 36/700 → Proof-CTA 32/700 → Footer 24/700; body 18/400; buttons never below 15/600.

Section rhythm: Hero (dark) → Demo (light) → Reveal (dark) → Proof (light) → Final CTA (dark) → Footer (near-black).

### Copy — the locked rewrite, wired to variables
- Nav: `AI Agentra — for {{CompanyName}}` · Try Demo · Book a Call
- Hero: eyebrow `AI agent for {{CompanyName}}`; H1 `{{FirstName}}, your leads won't wait — will {{CompanyName}}?`; buttons `Hear {{CompanyName}}'s Agent` / `Try {{CompanyName}}'s Agent`
- Demo: `{{FirstName}}, this isn't a pitch. Talk to it yourself.` + the two card lines
- Proof: `Real estate teams like {{CompanyName}} are already running this.`
- Final CTA: `See {{CompanyName}}'s full system, live.` → button `See It Running for {{CompanyName}} →` + risk-reversal line
- `{{FirstName}}` capped at 3 uses page-wide.

### Coded dashboard (replaces the static screenshot)
New `REDashboard.tsx` — a real component, not an image, matching the Flowly reference: dark command-bar, sidebar (Dashboard, AI Brain, Email, Calling, Instagram, WhatsApp, Lead Scoring, Content, SEO & Blog), 8 stat cards, "Today's quick stats" row, "Real-time activity" feed with hot/warm badges.
- Personalised: `{{CompanyName}}` in top bar + sidebar, `{{Logo}}` in the sidebar badge with **initials fallback** when no logo exists, `admin@{{CompanyDomain}}` in the header.
- Stat numbers and activity names stay static/illustrative.
- Numbers in JetBrains Mono; subtle live-pulse on the activity dot; responsive collapse below 900px.

### Calendly
Every "Book a Call" scrolls to an **inline embedded Calendly** section on the page (no new tab). URL comes from the existing global `site_settings.calendar_url` with the per-client override already in the demo record, falling back to `https://calendly.com/aiagentra/new-meeting` — so changing it once in the admin panel changes it everywhere.

### Footer — agency, not client
Client phone/email removed. Shows AI Agentra: WhatsApp `+977 982 688 4653` (opens `wa.me` link), `aigentron@gmail.com`, `www.aiagentra.com` — at 500 weight / high contrast to fix the current legibility issue.

### Bug
Investigate and fix the stray floating overlay covering the final CTA (likely the chat widget's launcher z-index/position on this template) with Playwright on the live demo route.

### Verification
Playwright screenshots of every section at desktop + mobile, contrast spot-checks on both themes, and a check that voice/chat handlers still fire.

---

## Technical notes
- New files: `supabase/functions/hook/index.ts`, `supabase/functions/manage-webhook-endpoints/index.ts`, one migration, `src/components/admin/inbox/WebhookEndpointsCard.tsx`, `src/components/demo/realestate/v2/REDashboard.tsx`, `RECalendly.tsx`.
- Edited: `_shared/manyreach-webhook.ts` (accept token-resolved auth + non-JSON bodies), `LogsPage.tsx`, `src/index.css` (`.re-page` token block rewrite), all six `RE*` section components, `RealEstateLandingPage.tsx`.
- Untouched: existing webhook routes, VAPI/chat wiring, e-commerce template, all other dashboard pages.
