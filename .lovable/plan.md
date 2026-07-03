# E-commerce Landing v2 + Floating Chat Widget + Admin Preview

Rework the e-commerce demo so it matches the reference site (koushikflow.netlify.app/50): a real marketing landing page (no embedded chat panel in the hero), a **floating bottom-right chat widget** that opens on click, and an **admin live preview** of the landing template.

## 1. Landing page rebuild (`EcommerceLandingPage.tsx`)

Remove the embedded `UnifiedChatWindow` from the hero and the "Live Demo" section. Landing becomes pure marketing content — chat is only in the floating widget.

New section order (matches reference):

1. **Nav** — scraped business logo (via `logo_url`) + business name, right-side "Book Call" button. Uses `--brand`.
2. **Hero** — large headline `{{company}} — [template headline]`, sub, two CTAs: primary "Try AI Assistant" (opens floating widget), secondary "Book a Call". Right column: hero product/mockup image (scraped `logo_url` shown large in a branded card, or `hero_image_url` from template) — no chat window here.
3. **Intro** — `Hey {{visitor_name}}, ...` personalized block.
4. **Image feature** — hero image + headline + CTA.
5. **Urgency line**.
6. **Proof / YouTube video**.
7. **"See it in action"** — instead of embedding chat, show a static screenshot/illustration of the widget with an arrow pointing to bottom-right + button "Open Live Chat" that pops the widget open.
8. **Final CTA** — book call.
9. **Footer**.

All copy stays template-driven with `{{company}}`, `{{visitor_name}}`, `{{product_count}}` variables. Logo everywhere pulled from scraped `logo_url` (via `BusinessLogo` component, which already falls back to initials).

## 2. Floating chat widget (`EcomFloatingChatWidget.tsx`)

New component mounted once at page root of `EcommerceLandingPage`.

**Closed state (FAB):**
- Fixed bottom-right, 64px circle, `--brand` background, business logo inside (white ring), subtle pulse ring animation
- Small tooltip bubble on first load: "👋 Chat with {{company}} AI" (auto-dismiss after 5s)
- Unread dot if greeting hasn't been seen

**Open state (panel):**
- Fixed bottom-right, `380px × 620px` on desktop, full-screen on mobile
- Rounded 24px, shadow-2xl, spring open animation (framer-motion)
- Reuses existing `UnifiedChatWindow` as the body (no rewrite)
- Header inside widget: scraped business logo + business name + "Online · Knows {{n}} products" + voice toggle + close (X) button
- Bottom: existing input bar + quick chips
- Voice mode: overlays the `VoiceActiveBar` inside the panel (no separate screen)

State: `open/closed` in React state; `useImperativeHandle` exposes `open()` so landing CTAs can trigger it.

## 3. Scraped logo integration

- `EcommerceLandingPage` already receives `logoUrl` prop from `DemoPage` (sourced from scraped data). Ensure it's threaded into:
  - Nav (already)
  - Hero visual (new — large centered logo card if no `hero_image_url` set)
  - Floating widget FAB
  - Widget header
  - Bot message avatars
- Fallback to `BusinessLogo` initials chip (already implemented) if URL missing/errors.

## 4. Admin live preview (`EcomLandingTemplatePanel.tsx`)

Split the panel into two columns on desktop:

- **Left (existing)**: form fields for all template keys + chips.
- **Right (new)**: sticky iframe-style preview card that renders `EcommerceLandingPage` in a scaled-down (0.5×) container using:
  - Live edited template values (not the saved DB row)
  - Mock props: `businessName="Acme Store"`, `logoUrl=null` (shows initials), `brandColor="#2563EB"`, `productCount=42`, `visitorName="Alex"`
  - Floating widget rendered in closed state; a toggle above the preview lets admin open it to preview widget too
- On mobile / narrow: preview collapses to a "Preview" tab.

Preview updates in real time as admin types (no save needed).

## 5. Files

**New:**
- `src/components/chatbot/unified/EcomFloatingChatWidget.tsx`
- `src/components/admin/EcomLandingPreview.tsx` (wraps `EcommerceLandingPage` with mock data)

**Edited:**
- `src/components/demo/ecommerce/EcommerceLandingPage.tsx` — remove embedded chat panels, add hero visual with logo, mount floating widget, wire CTAs to `widgetRef.open()`
- `src/components/admin/EcomLandingTemplatePanel.tsx` — two-column form + live preview
- `src/components/chatbot/unified/UnifiedChatWindow.tsx` — small tweaks so it renders cleanly inside a fixed 380×620 panel (already flexible, verify only)

**Unchanged:** DB schema, RAG, prompts, other industries, `DemoPage` routing, admin nav.

## Technical notes

- Floating widget uses `position: fixed` + `z-50`, hides on print, respects safe-area on mobile.
- Preview iframe: use a scaled `<div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%' }}>` wrapping the page — no real iframe needed, keeps context/styles/tokens.
- Widget open state persisted in `sessionStorage` so it stays open across scroll/nav within the demo.
- Reference visual: koushikflow.netlify.app/50 — clean white landing + brand accent + floating chat bottom-right.

## Out of scope

Voice VAPI provisioning changes, other industries, prompt/RAG work, dental/real-estate demos.
