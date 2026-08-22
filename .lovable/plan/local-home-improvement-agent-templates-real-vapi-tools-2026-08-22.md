# Local Home-Improvement Agent Templates + Real Vapi Tools

## Answers to your two questions

- This is built **into the system**, not a note for a teammate. The templates become seeded rows in the existing `industry_templates` table, so every future demo pulls from them automatically.
- Yes, I'll build the **actual matching logic**, not just the copy: a cheap keyword/signal pass over scraped site content, then an LLM classification step that picks a template and decides "use as-is" vs "adapt".

## What gets built

### 1. Pre-filled template library (14 niches)
Seed `industry_templates` with one row per niche: General Contractor, Home Remodeling, Roofing, Concrete Contractor, Deck Contractor, Fence Contractor, Painting, Waterproofing, Concrete Sealing, Concrete Coating, Deck Sealing, Deck Restoration, Concrete Restoration, Paver Sealing.

Every row uses the **exact structure you supplied** — IDENTITY, INBOUND CALL OPENING, VOICE STYLE, TOOL AND TRUTH RULES, CALL TYPE DETECTION, SCOPE, OFFICE HOURS, TRANSFER RULES, AFTER-HOURS, NEW ESTIMATE FLOW, NAME/PHONE/EMAIL/PROJECT DETAIL handling, ADDRESS REQUIREMENTS, CHECK CALENDAR AVAILABILITY, MARKET & ESTIMATOR ROUTING, FAR-DISTANCE, SATURDAY/SUNDAY, RETURNED SLOTS, BOOK APPOINTMENT, SUCCESS/DUPLICATE/FAILURE, SEND OFFICE NOTE, OUT-OF-AREA, LOG UNBOOKED LEAD, VOICEMAIL/IVR, WRONG NUMBER, PRICING, ERROR HANDLING, DUPLICATE PREVENTION, END CALL, HARD RULES.

Only the variables change per niche: `{{industry_category}}`, `{{project_type_list}}`, `{{pricing_policy_line}}`, plus scheduling defaults. Universal call-handling logic stays byte-identical across niches.

A shared variable resolver fills `{{company_name}}`, `{{agent_name}}`, `{{timezone_city}}`, transfer hours/days, `{{destination_team_name}}`, slot limits, `{{opening_line}}`, `{{unrelated_request_line}}` from the scraped business + site settings, with safe defaults for anything unknown.

The same template drives the **chatbot** prompt too — same structure and rules, with voice-only sections (voicemail, transfer, end_call phrasing) swapped for chat equivalents.

### 2. Industry matching from the scraped site
New step in the demo pipeline, after Firecrawl scrape / KB build:

```text
scraped pages ──▶ signal extraction (services, nav labels, page titles,
                  service-area copy, pricing language)
             ──▶ keyword scoring against each template's niche signals
             ──▶ LLM classifier (confirms niche, confidence, notes gaps)
             ──▶ score >= high  -> use template as-is
                  score  mid    -> adapt: rewrite project_type_list,
                                   pricing line, scope/service names
                  score  low    -> nearest template + generated overrides
```

Result stored on the chatbot row (matched template, confidence, adaptation notes) so you can see in the dashboard why a niche was picked.

### 3. Real tools — Google Calendar + Gmail (not simulated)
Link the workspace **Google Calendar** and **Gmail** connections to this project, then expose real Vapi custom tools backed by edge functions:

| Vapi tool | Backing | Real behaviour |
| --- | --- | --- |
| `check_calendar_availability` | Google Calendar | reads real free/busy, applies distance/Saturday/lead-time rules |
| `book_appointment` | Google Calendar + Gmail | creates the real event, sends the real confirmation email |
| `send_office_note` | Gmail | sends a real note to the office address |
| `search_knowledge_base` | existing KB function | already real |
| `log_unbooked_lead` | database | real row in leads |
| `transfer_call_tool` | not available | honest demo behaviour (see below) |

Each tool returns a `mode` of `live` or `demo`. If a connection is missing or a call fails, it falls back to realistic demo data **and the response still looks production-grade to the client** — but the prompt's truth rules are respected: the agent never claims a transfer connected when there is no transfer line. For the transfer path in demo mode the agent goes straight to the office-note flow, which is real.

A small Tools Health card in the dashboard shows live/demo status per tool with a test button.

### 4. site_url config migration
Migration creating a dedicated `app_config` table (key/value, RLS + grants, service_role write, authenticated read) seeded with `site_url = https://aiagencyx.lovable.app`. Demo-link builders read from it with the `SITE_URL` secret as fallback, so generated links always use the Lovable domain.

## Technical notes

- New: `supabase/functions/_shared/localbiz-prompt.ts` (master template + per-niche variable packs + chatbot variant), `_shared/industry-match.ts` (signal extraction + scoring + LLM confirm), edge functions `vapi-check-availability`, `vapi-book-appointment`, `vapi-send-office-note`, `vapi-log-lead`.
- Gateway calls go through `connector-gateway.lovable.dev/google_calendar/...` and `/google_mail/...` with `LOVABLE_API_KEY` + connection key, server-side only; provider status and body surfaced on failure.
- `create-voice-agent` registers the tool set on the Vapi assistant; `create-demo` calls the matcher before prompt build.
- Migration also adds `matched_industry`, `match_confidence`, `template_overrides` to `chatbots`, with grants unchanged.
