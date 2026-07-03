# E-Commerce Chatbot UI Rebuild (PLIX-style)

Scope: E-commerce industry only. Rebuild the floating chat widget from scratch to match the reference screenshots exactly. Landing page and other industries untouched. All colors auto-derive from `chatbots.widget_config.brand_color` (already implemented via `brandCssVars`).

## New widget structure (replaces current `UnifiedChatWindow` body inside `EcomFloatingChatWidget`)

Three screens + bottom tab nav, all inside the existing floating panel (390×640).

### 1. Home tab (default open view)

- Brand-color header block (~140px): business logo top-left (28px), then large white heading `Hi {{firstname}} 👋` + subline `What are you shopping for today?`
- Primary CTA card (dark #1e1e1e, full width, chevron right): `💬 Ask about products` → switches to Chat tab
- Quick chip grid 2×2:  `Bestsellers`,  `Gifts`,  `Under $100`,  `Track order` (chips = brand color at 80% opacity, white text). Click sends message + switches to Chat tab.
- Recent Conversation card (if any prior session in localStorage): shows first user message + relative time → reopens Chat tab with restored messages
- Voice CTA card: `🎙 Talk to AI — Start Call` → triggers VAPI start
- Featured Products horizontal scroll (2–4 products from `products` table for this chatbot): image + name + price, tap → sends "Tell me about {product}" and switches to Chat

### 2. Chat tab

- Sticky sub-header: back arrow (returns to Home) + `{{company}} AI` + `Your assistant`
- Dark background (#0f0f0f)
- Empty state: centered brand-color logo circle + business name + `I know {{N}} products. Ask me anything.` + 2×2 chip cards (same as Home quick chips)
- Active messages:
  - Bot: brand-color avatar circle (logo/initials) on left + dark gray (#1e1e1e) bubble, white text
  - User: brand-color bubble, right-aligned, `--brand-text` color, no avatar
  - Chips as part of bot message: rendered below the bubble, click sends chip text as user message
  - Product recommendations: horizontal-scroll row of `ProductCard` (image, name, brand-color price, Order Now button) rendered below the bot bubble
  - Debug/KB snippets: collapsible expandable card (chevron), closed by default
- Input bar (dark, brand-color focus ring): text input + mic button + refresh (new conversation) + send (brand-color circular)

### 3. FAQ tab

- Search input at top
- List of expandable Q/A cards pulled from `chatbots.widget_config.faqs` (fallback to defaults: return policy, shipping, sizes, gift wrap)
- Footer buttons:  `Ask the AI` (→ Chat tab) and  `Talk to AI` (→ voice)

### Bottom nav (persistent, 56px)

-  Home,  Chats,  FAQ — active tab underlined in brand color
- `Powered by Aiagentra` micro-text below

## Files to create

- `src/components/chatbot/unified/ecom/EcomChatShell.tsx` — tab controller, bottom nav, header switching
- `src/components/chatbot/unified/ecom/HomeTab.tsx`
- `src/components/chatbot/unified/ecom/ChatTab.tsx` — reuses streaming logic from existing `UnifiedChatWindow`
- `src/components/chatbot/unified/ecom/FaqTab.tsx`
- `src/components/chatbot/unified/ecom/ChatsTab.tsx` — localStorage session list (last 5)
- `src/components/chatbot/unified/ecom/MessageBubble.tsx` — bot/user variants, avatar, chip row, product row, debug accordion
- `src/components/chatbot/unified/ecom/ChatInput.tsx` — dark input + mic + refresh + send
- `src/components/chatbot/unified/ecom/ProductStrip.tsx` — horizontal scroll wrapper for `ProductCard`

## Files to edit

- `src/components/chatbot/unified/EcomFloatingChatWidget.tsx` — swap `UnifiedChatWindow` body for `<EcomChatShell />`; pass `products`, `faqs`, `visitorFirstName`
- `src/components/chatbot/ProductCard.tsx` — add dark-theme variant (`variant="dark"`) so it reads on #0f0f0f
- `src/components/admin/EcomLandingTemplatePanel.tsx` — the preview already renders `EcommerceLandingPage` which mounts the widget; add a "Preview widget on Home / Chat / FAQ" tab selector above the preview frame so admin can inspect each screen without clicking through
- `src/components/demo/ecommerce/EcommerceLandingPage.tsx` — pass `visitorName` first-name and top featured products to the widget

## Data & state

- Conversation history + recent sessions: `localStorage` keyed by `chatbotId` (no DB migration needed)
- Featured products: existing `products` table, top 4 by created_at for the chatbot
- FAQs: read `chatbots.widget_config.faqs` array, fall back to hardcoded e-commerce defaults
- Streaming, RAG, voice: reuse the existing `chatbot-conversation` edge function + VAPI hook from current `UnifiedChatWindow` — no backend changes

## Theming (auto per business)

Already available via `brandCssVars` on the widget root. New components consume:

- `var(--brand)` — header, user bubble, avatar, send button, active tab underline, product price
- `var(--brand-dark)` — chip background
- `var(--brand-text)` — text on brand surfaces
- Fixed dark tokens: bg `#0f0f0f`, cards `#1a1a1a`, bot bubble `#1e1e1e`, borders `white/8`

## Out of scope

- Landing page layout (unchanged)
- Other industries (dental, real estate)
- Backend / edge functions / DB schema
- Voice VAPI provisioning logic
- Order tracking integration (chip sends message only; real tracking is future work)

## Admin preview

The existing live-preview panel already renders the real widget via `LandingTemplateOverrideCtx`. After this rebuild, admin will see the new 3-tab UI live. Adding a small tab selector lets admin jump directly to Home / Chat / FAQ inside the scaled preview.