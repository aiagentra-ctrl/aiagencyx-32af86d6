# E-commerce Demo Redesign + Unified Chat Window

Scope: **e-commerce industry only**. Dental/real-estate/generic flows untouched. Copy the section structure (not colors) of https://koushikflow.netlify.app/50, personalize with variables, embed the given YouTube video, add uploaded image, and replace the two-card demo with one unified chat+voice window matching the detailed spec.

## 1. Admin-editable landing template

New table `ecommerce_landing_template` (single row, edited from admin):
- `hero_headline`, `hero_sub`, `hero_cta_primary`, `hero_cta_secondary`
- `intro_greeting` (default: `Hey {{visitor_name}},`)
- `intro_body` (multiline, supports `{{company}}`, `{{visitor_name}}`)
- `image_caption`, `hero_image_url` (default = uploaded image)
- `demo_headline`, `demo_sub`
- `proof_headline`, `proof_sub`
- `youtube_embed_url` (default `https://youtu.be/eOAyie0kWGQ`)
- `cta_headline`, `cta_sub`, `cta_button_label`
- `footer_note`

Variables resolved at render: `{{company}}`, `{{visitor_name}}` (default "Guest"), `{{product_count}}`, `{{logo_url}}`. A tiny `renderTemplate(str, vars)` helper.

Admin UI: new tab in `SettingsPage.tsx` → **"E-commerce Landing Template"** with textarea/input per field, live preview link, Save button (upsert row).

Applies to **every** e-commerce demo automatically — no per-demo copy.

## 2. New e-commerce landing page

New file `src/components/demo/ecommerce/EcommerceLandingPage.tsx`, rendered by `DemoPage.tsx` when `industry === "ecommerce"` (replaces current hero + product grid + value + ecommerce chat widget composition). Sections top-to-bottom mirror the reference site:

1. **Nav** — company logo (auto-themed, 32px), "Try Demo" scrolls to chat, "Book Call" opens calendly.
2. **Hero** — headline + sub from template, two CTAs: `💬 Try the AI now` (scrolls to unified chat) and `🎙 Or start a voice call` (scrolls + triggers mic). Right side: `UnifiedChatWindow` at scale-90 in device frame showing pre-populated conversation with 2 product cards.
3. **Intro block** — `Hey {{visitor_name}},` + templated body ("I built a tool that captures leads…", "focus on running {{company}}", "Try it out 💬", "A smooth chat will begin in the bottom-right corner", "Capture sales the moment buyers are ready…").
4. **Image feature block** — uploaded image (`user-uploads://sthlxhcywbbhjjjjybr1hd9mqyhuuwvroijfcc6zkg0g4xfb.png`) uploaded via lovable-assets, with heading `Turn conversations into conversions` and sub `Book a call and see how AI Agents can sell, support, and generate leads for {{company}} 24/7.` + `Book Your Call Now` button.
5. **Urgency line** — "Don't wait until it's too late. The early adopters always win."
6. **Proof / Video** — headline `The proof? My clients can't stop talking about it` + embedded YouTube iframe (`https://www.youtube.com/embed/eOAyie0kWGQ`).
7. **Live Demo section** — `⚡ Live Demo` pill, headline `Talk to {{company}}'s AI — chat or voice, one window`, sub, then the full-size `UnifiedChatWindow` (max-w-2xl, h-580, shadow-2xl, radius-24). Below: "Try saying →" + 4 pre-built suggestion chips that inject into the chat.
8. **Final CTA** — templated headline + `Book Your Call Now`.
9. **Footer** — reuse `FooterSection`.

All text passes through `renderTemplate` so admin edits propagate everywhere.

## 3. UnifiedChatWindow (chat + voice, one surface)

New folder `src/components/chatbot/unified/`:
- `UnifiedChatWindow.tsx` — orchestrator, holds `messages`, `voiceState`, `lastResponseType`, VAPI ref.
- `ChatHeader.tsx` — 64px, `BusinessLogo` + name + green pulse "Online · Knows {{n}} products" + voice toggle button (idle/active/loading with pulse rings) per spec 2B.
- `QuickChips.tsx` — contextual chip set (`default` / `post-product` / `post-policy`) with emoji, click sends immediately, styling per 2C.
- `MessageThread.tsx` — off-white `#fafafa` background, empty-state with logo + greeting + 4 quick-start cards.
- `MessageBubble.tsx` — user (`#2563EB`) + bot (white, avatar, bordered) variants with Framer Motion spring entrance, streaming-word effect for bot text.
- `TypingIndicator.tsx` — 3 bouncing dots.
- `ProductCardsRow.tsx` + `ProductCard.tsx` — horizontal snap scroll, sale badge, OOS overlay, in-stock pill, `Order Now →` CTA using `--brand` tokens, stagger entrance.
- `ComparisonCard.tsx` — N-column grid comparison.
- `VoiceActiveBar.tsx` — 80px bar with pulsing orb, waveform bars, status text, live transcript, Stop button.
- `ChatInputBar.tsx` — auto-expand textarea + circular send button (empty vs filled vs loading states), Enter to send / Shift+Enter newline.

Behavior:
- Streams tokens from `chatbot-conversation` edge function (already wired) into `MessageBubble` with word-by-word setInterval.
- Mic click → dynamic-import `@vapi-ai/web`, wire `call-start` / `speech-start` / `speech-end` / `message` (final transcripts appended to same thread with 🎙 prefix) / `call-end` / `error`.
- Parses `<!--recommendations:[...]-->` and `<!--actions:[...]-->` markers (already emitted by backend) to render product cards + action buttons.
- Detects `lastResponseType` from parsed markers to switch chip set.

`EcommerceChatWindow.tsx` stays for the floating widget only; landing embeds `UnifiedChatWindow` directly. Old two-card demo section removed.

## 4. Branding tokens (CSS vars)

In `EcommerceLandingPage`, inject:
```
--brand, --brand-dark, --brand-mid, --brand-light, --brand-text
```
from `page.dynamic_content?.brand_color` (fallback #2563EB), computed with `hexToRgba` / `darken` / `lighten` / `getContrastColor` helpers in `src/lib/brandColors.ts`.

`BusinessLogo.tsx` new component: shows `logo_url` when present, else circular initials on brand background; auto-white ring on dark backgrounds.

## 5. Assets

- Upload the given image via `lovable-assets create` from `/mnt/user-uploads/sthlxhcywbbhjjjjybr1hd9mqyhuuwvroijfcc6zkg0g4xfb.png` → `src/assets/ecom-hero.png.asset.json` → used as default `hero_image_url`.
- YouTube: `<iframe src="https://www.youtube.com/embed/eOAyie0kWGQ" ...>`.

## 6. Build order

1. Migration: create `ecommerce_landing_template` table with GRANTs + RLS (public read, admin write via `has_role`), seed one row.
2. Upload hero image asset; add `renderTemplate` + `brandColors` helpers.
3. `BusinessLogo.tsx`.
4. Build `UnifiedChatWindow` + all sub-components with the full 2A–2G spec.
5. Build `EcommerceLandingPage.tsx` with all 9 sections using template + variables.
6. Wire `DemoPage.tsx` to render `EcommerceLandingPage` for `industry === "ecommerce"` instead of the current section stack.
7. Add `EcomLandingTemplatePanel` inside `SettingsPage.tsx`.
8. Manual verification on `humanfitcraft.com` demo: brand color, logo, product cards, chip contextual switch, voice toggle roundtrip, YouTube plays, image visible, admin edit → landing update.

## Out of scope

Dental, real-estate, generic industries; backend RAG/prompt changes; OpenRouter migration (already covered in prior turn); voice VAPI assistant provisioning.
