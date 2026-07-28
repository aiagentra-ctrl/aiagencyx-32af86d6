## Goal

Add three things without touching existing behaviour: a real-estate scraper → classifier → v3 voice-prompt pipeline, a shorter ManyReach webhook, and one shared chatbot design system used by both e-commerce and real estate.

Nothing existing is removed. New code is added alongside; existing e-commerce, dental, restaurant and generic flows keep their current paths.

---

## Phase 1 — Real estate data layer

New table `property_listings` matching your listing schema (listing_id, address, city, price, status, bedrooms, bathrooms, sqft, lot_size, property_type, description_raw, features, hoa_fee, listing_agent, photos, source_url, last_scraped) plus `chatbot_id` and an embedding column for RAG. Fields stay nullable — no inferred values.

Agency-level record (service_area, services_offered, business_hours, license_numbers, contact/booking detection, fair-housing flag, raw FAQ pairs, testimonials) is stored on the existing chatbot record as structured JSON, so nothing else has to change.

A hybrid search function `match_listings_hybrid` mirrors the existing product search (vector + full-text), so retrieval behaves the same way the e-commerce side already does.

## Phase 2 — Scraper

New edge function `scrape-realestate-listings`, modelled on the existing e-commerce scraper:
- crawls listing pages, listings index, about/team, services, contact/booking, FAQ, testimonials, legal/fair-housing footer
- strips nav/footer/script boilerplate before storing descriptions
- respects robots.txt, rate-limits, stores `source_url` + `last_scraped` on every row
- detects a real booking widget vs a plain contact form (this drives `booking_showings` later)
- writes listings to `property_listings`, everything else into the existing knowledge-base table so the current RAG search keeps working

Re-scrape is re-runnable per chatbot so price/status can be refreshed.

## Phase 3 — Classifier

New edge function `classify-realestate-business` using OpenRouter (same client the rest of the system uses). Feeds the agency record + listing sample + FAQ pairs, returns strict JSON: business_type, core_job, service_area, property_types, tone_signals, key_differentiators, compliance_notes, suggested_agent_persona_name, confidence.

`booking_showings` is only allowed when a booking widget was actually detected. When confidence is `low`, the profile is saved and flagged for human fill-in instead of auto-generating the prompt.

## Phase 4 — v3 master prompt

A real-estate prompt builder added to the existing voice-prompt dispatcher (same place restaurant and dental branches live). It renders your full v3 spec: identity, tone, speaking style, calibrated disfluency, rapport/energy matching, the four business-type branches, Core-Knowledge-vs-RAG discipline, scope, Fair Housing overrides, guardrails, emotional expression limits, escalation and call length, with the worked examples.

Optional sections (booking, incremental capture) only render when the classifier enabled them.

Per your answer: the prompt is applied automatically to the VAPI agent when a real-estate demo is created — except when confidence is `low`, where the existing generic prompt stays in place and the gaps are flagged in the dashboard.

## Phase 5 — Webhook

Add a short path-token route: `/functions/v1/mr/<token>` (chosen over a header-only secret because ManyReach's webhook form doesn't reliably let you set custom headers). The token is compared constant-time against the existing secret, so no new secret is needed.

The existing `?key=` / `?secret=` / `x-webhook-key` forms keep working unchanged — pure backward compatibility. The handler acknowledges early and does the heavier work after responding, which cuts webhook response time. The admin webhook card shows the new short URL with the old one still copyable.

## Phase 6 — Shared chatbot design system

Extract the current e-commerce widget into a reusable, themeable chat kit:
- shared shell (Home / Chats / FAQ tabs, launcher, panel sizing, animations, responsive/mobile full-screen behaviour)
- shared message list, bubbles, typing state, input bar, quick chips, voice-call view
- a theme layer (brand colour, logo, copy, tab labels) plus a card slot so e-commerce renders product cards and real estate renders listing cards

E-commerce keeps its current look — it becomes the default theme. Real estate switches from the older widget to the same kit with a listings theme, so both look and behave identically.

---

## Technical notes

- All new AI calls go through the existing OpenRouter client and shared retry/fallback helper.
- New tables get RLS plus explicit grants, following the pattern already used by `products`.
- Real-estate industry detection reuses the keyword match already in `DemoPage`.
- No changes to follow-up sequences, inbox pipeline, dental/restaurant prompts, or the e-commerce landing page.

## Verification

Playwright screenshots of both widgets at desktop and mobile widths, a live scrape + classify run against a real real-estate site, and a webhook test through both the old and new URL forms.