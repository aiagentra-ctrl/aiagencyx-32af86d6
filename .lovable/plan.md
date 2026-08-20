# Real Estate template as the default, customizable per niche

Make the Real Estate v2 landing page the default template for every local business, with a niche
pack system that swaps copy, colors, dashboard labels and chatbot text per industry — without
touching the niches that already have their own dedicated template.

## Routing rule (decided)

On a demo page, in order:

1. Business already has a dedicated template (e-commerce, dental) → keep it exactly as today. No changes.
2. Otherwise → render the new default template with the matching niche pack.
3. Niche unknown → Real Estate pack (the default).

Niche is resolved by keyword mapping on the stored industry; when no keyword matches, the demo
creation step asks the AI once and stores the resolved niche on the demo page so the landing page
never re-guesses at runtime.

## Niche pack system

A single registry file defines each pack. Real Estate and Local Business / Contractor ship in this
pass; adding a niche later is one new object in the registry.

Each pack carries:

- Vocabulary: leads → customers/enquiries, buyer → customer, viewing → appointment,
  listings → services, "real estate teams" → "businesses".
- Hero, demo, reveal, proof, CTA and footer copy (with `{{FirstName}}`, `{{CompanyName}}` support).
- Phone mockup sample lines.
- Voice "Try saying" prompts and chat "Try asking" prompts.
- Dashboard stat labels and activity-feed sample names.
- Color accents and imagery for that industry.
- Chatbot greeting, tagline, intro blurb, suggestion chips and FAQ set.

Anything a scraped business already provides (real prompts, real headline, real services, location,
owner first name) overrides the pack defaults, so two businesses in the same niche never render
identical pages.

## Copy changes (applied via packs)

- Hero eyebrow / headline / subhead / buttons / micro-line exactly as specified, with `{{FirstName}}`.
- `{{FirstName}}` appears exactly three times: hero, demo headline, reveal headline.
- Proof: "Businesses like {{CompanyName}} are already running this." plus the three reworded bullets
  ("out on the job").
- Final CTA: "…{{CompanyName}}'s own jobs and enquiries in it" — noun comes from the pack.
- Footer: "…AI voice and chat agents for local businesses…".
- Real Estate pack keeps its current real-estate wording as its own pack values.

## Reveal / flow section

Replace the current 6-step pipeline with the 8 steps provided (Get Found, Capture, Respond, Book,
Close, Get Reviews, Reactivate, Track). Rendered as a rectangular card grid — 4x2 on desktop, 2x4 on
mobile — so it stays a clean rectangle on every screen instead of a long vertical chain. Headline and
subline updated to the "customer scoring" wording.

## Dashboard section

Rebuild the showcase dashboard to match the uploaded HTML: cream background, white cards, the
flow strip, stat grid and real-time activity feed, with the same fonts and status colors. Labels use
pack vocabulary ("Total customers captured", "Appointments booked"), and activity-feed samples use
niche-appropriate actions (booking an estimate rather than a viewing). On mobile it renders as a
proper rectangle preview with a full-screen expand, never a squeezed column.

## Chatbot

The Real Estate chat widget UI becomes the default chatbot for all niche-pack pages. Structure,
layout and styling stay identical; greeting, tagline, intro blurb, suggestion chips, FAQ questions
and sample recent message all come from the niche pack. E-commerce and dental keep the chatbots they
already have.

## Verification before rollout

One complete Real Estate demo lead is created and driven end to end in a real browser at desktop and
mobile widths, checking: landing render, personalization (no raw `{{token}}` anywhere), all buttons,
voice call start/end, chatbot open + industry copy + a real reply, the 8-step flow rectangle,
dashboard on both widths, calendar embed, videos/animations, and console/network clean. Only after
that passes does the template become live for the rest of the businesses.

## Technical notes

- New `src/components/demo/niche/packs.ts` registry + `resolveNiche()` helper.
- `RealEstateLandingPage` and its RE* sections become pack-driven (props sourced from the pack,
  overridable by scraped data); no structural rewrite.
- `DemoPage.tsx` routing updated to the three-step rule above; e-commerce and dental branches untouched.
- Niche resolution stored on the demo page's `dynamic_content` during `create-demo`, with the AI
  fallback only when keyword mapping fails.
- New flow grid and dashboard live in the v2 folder; existing REDashboard is replaced by the uploaded
  design translated to React with tokens.
