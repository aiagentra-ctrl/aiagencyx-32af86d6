# Ecom Landing v3 + Chatbot Polish

Copy the koushikflow.netlify.app aesthetic for the ecom landing page, personalized with the scraped business (logo, name, first-name greeting). Keep the widget architecture we already built; polish the chat UX so product cards drive to real product URLs, add a dedicated in-widget voice call screen, and use scraped policy pages to populate FAQs.

## 1. Landing page — koushikflow-style (`EcommerceLandingPage.tsx`)

Replace the current hero/sections with a single dark, centered, minimal viewport:

- **Background**: near-black `#0a0620` → deep indigo, faint animated grid + soft glowing dot particles (pure CSS, no libs).
- **Top-right nav**: pill button "Try AI Now" (brand gradient), and small brand mark top-left = client `logo_url` + `businessName` (fallback initials via `BusinessLogo`).
- **Center block** (vertically centered, ~60ch max):
  1. Huge headline: `Hey {{visitorFirstName || "there"}},` — the name gets a purple glow (`text-shadow`) and gradient fill using brand color, matching the reference "Guest" treatment.
  2. Subhead (light gray, ~1.5rem): `I built an AI that captures sales while you're off the clock.`
  3. Framed quote card (rounded, subtle brand border, backdrop-blur): `It's an AI that talks to your customers on {{siteDomain}}, answers questions about your products, and helps them checkout — while you focus on running {{businessName}}.`
  4. Primary CTA: gradient pill `Try it out 💬` → opens floating widget (already wired via `EcomFloatingChatWidgetHandle.open`).
  5. Small caption under CTA: `A smooth chat will begin in the bottom-right corner`.
- **Second viewport (scroll)**: matching dark section
  - Small brand-tinted eyebrow: `Turn conversations into conversions`
  - H2: `Capture sales the moment buyers are ready.`
  - Body: `See how the AI can sell, support, and recommend products for {{businessName}} 24/7.`
  - CTA: `Start Chatting Now` (opens widget) + secondary ghost `Talk to AI` (opens widget → voice view).
  - Tag line: `Don't wait until it's too late. Early adopters always win.`
- Typography: import Google Font `Sora` (headings) + `Inter` (body) via `<link>` in `index.html`; add tokens to `tailwind.config.ts` (`font-display`, `font-sans`).
- Personalization: pull `businessName`, `logo_url`, `first_name` (visitor), domain, and product count from the same props the page already receives — no schema change.
- Remove the old Hero / ValueProps / ProductGrid marketing sections from `EcommerceLandingPage.tsx`; the widget is the product showcase. Keep the floating widget mount unchanged.

## 2. Chatbot polish (`EcomChatShell.tsx` + subparts)

Everything stays in the existing 390×640 shell; no new tabs.

### 2a. Product recommendation cards
- `ProductCard` (dark variant used inside chat) gets two buttons stacked:
  - Primary `Buy Now` → opens `product.url` in new tab (`target=_blank rel=noopener`).
  - Secondary `Add to Cart` → same URL for now (most Shopify/Woo add-to-cart is `?add-to-cart={id}` or the product URL); we pass through whatever the scraper stored in `products.url`.
- Ensure image, name, price, and CTA are always visible; graceful fallback when `image_url` missing (brand-tinted placeholder w/ initials).
- Horizontal snap-scroll row inside bot bubbles when >1 product.

### 2b. Voice call — dedicated in-widget screen
- Add `view: "home" | "chat" | "faq" | "voice"` state in `EcomChatShell`.
- New `VoiceCallView` component:
  - Full-shell dark screen with pulsing brand-color avatar (logo or initials), business name, status label (`Connecting…`, `Listening…`, `Speaking…`), live timer.
  - Big red circular `End Call` button (single control); small mic-mute toggle + back-to-chat link at bottom.
  - Uses the existing VAPI hook already used by the mic button; call start moves to this view, call end returns to chat with a system message `Voice call ended · 01:23`.
- Chat tab keeps a small mic icon in the composer that switches into the voice view instead of inline waveform.
- Home tab "Start a live call" row triggers the same voice view.

### 2c. FAQ tab from scraped policy pages
- Extend `scrape-ecommerce-products` (or add a small step in `scrape-and-analyze`) to also fetch typical policy URLs: `/pages/shipping`, `/pages/returns`, `/policies/*`, `/faq`, `/shipping`, `/returns`, `/pages/faq`, plus any nav link containing `policy|shipping|return|faq|gift|size`. Store extracted Q/A pairs in `chatbots.widget_config.faqs` as `[{q, a, source_url}]`.
- Default fallback questions (rendered only if scrape returned nothing):
  - What is your return policy?
  - How long does shipping take?
  - Do you offer gift wrapping?
  - What sizes are available?
- FAQ tab UI: search box + accordion (already exists); each answer shows a small `View policy →` link when `source_url` present.

### 2d. Small chat polish
- Bot bubble spacing tightened; consistent 12px radius; message timestamp on hover.
- User bubble uses `var(--brand)` bg / `var(--brand-text)` fg.
- Composer: rounded pill, brand focus ring, send button becomes brand gradient when input has text.

## 3. Admin preview
- `EcomLandingTemplatePanel` preview iframe already renders `EcommerceLandingPage`; no structural change needed — it will pick up the new layout automatically.
- Add a "View mode" toggle for the widget preview: `Home | Chat | Voice | FAQ` so admins can inspect each screen without interacting.

## Files

**Edit**
- `src/components/demo/ecommerce/EcommerceLandingPage.tsx` — full rewrite to koushikflow layout
- `src/components/chatbot/unified/ecom/EcomChatShell.tsx` — add `voice` view, wire FAQ source_url, polish
- `src/components/chatbot/ProductCard.tsx` — dual CTA, dark variant refinements
- `src/components/admin/EcomLandingTemplatePanel.tsx` — widget view-mode toggle
- `supabase/functions/scrape-ecommerce-products/index.ts` — also fetch policy pages → FAQs
- `index.html` — Sora + Inter font links
- `tailwind.config.ts` — `fontFamily.display`, `fontFamily.sans`

**Create**
- `src/components/chatbot/unified/ecom/VoiceCallView.tsx`
- `src/components/demo/ecommerce/StarfieldBackground.tsx` (CSS-only grid + dots)

## Out of scope
- Non-ecom industries, backend DB schema changes, real cart integration, VAPI provisioning, auth.

## Open question
Product "Add to Cart" — for now both buttons deep-link to `product.url` (new tab). Fine, or should the secondary button be hidden until we have a real cart endpoint?
