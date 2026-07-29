
# Real-Estate Landing Page — full rebuild to the brief (50x the mockup)

Everything lands in `src/components/demo/realestate/v2/`, so every real-estate demo page picks it up automatically. Build order follows the brief exactly: copy → color → type → layout → dashboard.

## 1. Copy (locked, wired to variables)

Variables: `{{FirstName}}`, `{{CompanyName}}`, `{{Logo}}`, `{{CompanyDomain}}` — resolved from the demo record, with graceful fallbacks (no raw `{{ }}` ever renders, no "there," no empty gaps).

- Nav: `AI Agentra — for {CompanyName}` · Try Demo · Book a Call
- Hero: eyebrow `AI agent for {CompanyName}` · H1 `{FirstName}, your leads won't wait — will {CompanyName}?` · sub `Every enquiry answered in seconds, day or night. See {CompanyName}'s agent answer a real question below.` · buttons `Hear {CompanyName}'s Agent` / `Try {CompanyName}'s Agent` · micro `No signup. No install. Speak to it in the next ten seconds.`
- Demo: eyebrow `Live demo` · H2 `{FirstName}, this isn't a pitch. Talk to it yourself.` · sub `This agent has already read {CompanyName}'s website. Ask it anything a real buyer would.` · voice card `Answers the phone in one ring` · chat card `Same brain, on your website`
- Reveal: keep existing structure, restyled
- Proof: eyebrow `Client proof` · H2 `Real estate teams like {CompanyName} are already running this.` · sub `Hear it directly from someone using it right now.`
- Final CTA: `See {CompanyName}'s full system, live.` · sub · button `See It Running for {CompanyName} →` · risk reversal `Free walkthrough • No commitment • See it running in 24 hours`

`{{FirstName}}` capped at 3 uses page-wide (hero, demo, one more max) — enforced by a small counter helper so it can't silently drift.

## 2. Color system (rewrite of the `.re-page` token block in `src/index.css`)

| Role | Hex |
|---|---|
| Dark bg | `#0B0F14` |
| Light bg | `#FAFAFA` |
| Card on dark | `#151B23`, border `#232B35` |
| Card on light | `#FFFFFF`, border `#E5E5E5` |
| Text on dark | `#F5F5F5` / muted `#9CA3AF` |
| Text on light | `#111318` / muted `#4B5563` |
| Brand blue (logo, icons, name highlight only) | `#3B82F6` |
| CTA orange (every button, no exceptions) | `#F97316`, hover `#EA6A0C` |
| Footer | `#05070A` |

Section rhythm: Hero dark → Demo light → Reveal dark → Proof light → Final CTA dark → Footer near-black. No green anywhere. No blue on a button. No pure `#FFFFFF` text on dark. Per-client brand color stays confined to the logo badge so the locked system never breaks.

## 3. Typography

Inter 400–800 only; JetBrains Mono 600/700 **only** for dashboard stat numbers. Both self-hosted-style preloaded with `display=swap` and preconnect (speed rule).

H1 56/800/-0.02em → H2 36/700 → Proof + CTA 32/700 → Footer 24/700 · body 18/400 muted · card body 14/400 · buttons never below 15/600 · flow labels 13/700 brand blue.

## 4. Layout, section by section

Rebuilt: `REHero`, `REDemo`, `REReveal`, `REProof`, `REBookCall`, `REFooter` + new `RENav`, `REDashboard`, `RECalendly`.

Section padding `88px 10%` desktop, tapering per breakpoint. Hero two-column 60/40 with the live phone/voice mockup; demo two cards; reveal 01/02/03 flow + the coded dashboard; proof video; CTA dark band; footer near-black.

## 5. Coded dashboard (`REDashboard.tsx`) — replaces the static screenshot

Exact Flowly replica from your HTML, as a real component:
- Top bar `01 / COMMAND CENTRE` + `{CompanyName} Dashboard`
- Sidebar: brand badge using `{{Logo}}` image with **initials fallback**, then Dashboard, AI Brain, Email, Calling, Instagram, WhatsApp, Lead Scoring, Content, SEO & Blog, Collapse
- Header: `Dashboard overview` + admin card with `admin@{CompanyDomain}`
- 8 stat cards (1,247 / 8 / 47 / 892 / 23 / 18.4% / 34 / $847.5) — numbers in JetBrains Mono, static across clients
- "Today's quick stats" 5-up row
- "Real-time activity" feed with live pulse dot and Hot/Warm badges

Below 900px: sidebar hidden, stats 2-per-row, quick stats scroll row.

## 6. Calendly — inline, admin-controlled

New `RECalendly.tsx`: inline embed section, dark-themed via Calendly's color params, script loaded lazily only when the section approaches the viewport. Every "Book a Call" / CTA button smooth-scrolls to it — no new tab. URL resolution: per-client override → global `site_settings.calendar_url` → `https://calendly.com/aiagentra/new-meeting`, so changing it once in the admin panel changes it everywhere.

## 7. Footer — agency, not client

Client phone/email removed entirely. Shows AI Agentra: WhatsApp `+977 982 688 4653` as a `wa.me` link, `aigentron@gmail.com` as mailto, `www.aiagentra.com`. Contact text at 14px/500 with high contrast (fixes the legibility bug).

## 8. Device + performance rules (third file, applied in full)

- Mobile-first base CSS, `min-width` layering at 381 / 481 / 769 / 1025 / 1441
- Hero H1 30–34 (XS–SM) → 38–42 (MD) → 48 (LG) → 56 (XL+); demo cards never side-by-side below 768px
- Every tappable target ≥44×44px with ≥8px spacing; CTA buttons full-width below 480px; inputs/Calendly ≥48px
- No hover-only affordances — tap equivalents everywhere
- Speed: fonts preconnected + swap, Calendly and the proof video lazy-loaded on intersection, dashboard rendered as pure CSS/DOM (no image weight), reduced-motion respected, no layout-shift (explicit aspect ratios)

## 9. Bug fix

Investigate the floating "abc" overlay covering the final CTA with Playwright on a live demo route — almost certainly the chat widget launcher's z-index/position on this template — and fix it so nothing overlaps the CTA at any breakpoint.

## Verification

Playwright pass over a real demo URL: screenshots of every section at 375 / 768 / 1024 / 1440, contrast spot-checks on both themes, tap-target audit, confirmation that voice + chat handlers still fire, Calendly scrolls inline, logo-missing fallback renders initials, and the CTA is unobstructed.

## Technical notes

- New: `RENav.tsx`, `REDashboard.tsx`, `RECalendly.tsx`, plus a small `personalize.ts` helper for variable resolution and the FirstName cap.
- Edited: `src/index.css` (`.re-page` token block rewrite + responsive type scale), all six existing `RE*` components, `RealEstateLandingPage.tsx`, `index.html` (font preconnect).
- Untouched: webhooks, VAPI/chat wiring, e-commerce and generic templates, admin dashboard pages.
