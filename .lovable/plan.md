## Plan: Personalized Landing Pages, Dynamic Calendar Links, Chatbot Booking Flow, and Domain Handling

### Summary

Four workstreams: (1) Use researched data to enrich landing pages, (2) Add per-client `calendarUrl` field to APIs and wire it everywhere, (3) Build in-chat step-by-step booking flow, (4) Redirect bare base domain to `aiagentra.cloud` and strip paths from API URLs.

---

### 1. Domain Redirect Logic

**File: `src/App.tsx**`

Add a top-level redirect component that runs on mount:

- If `window.location.origin` is `https://aiagentfor.lovable.app` AND `window.location.pathname` is exactly `/` or `/admin`, redirect to `https://aiagentra.cloud/`
- All other paths (`/abc`, `/chatbot/xyz`, `/api-docs`) work normally

This keeps the base domain clean while allowing client pages to load.

---

### 2. Dynamic Per-Client Calendar Link

**API changes (`create-ai-agent`, `create-voice-agent`, `scrape-and-analyze`):**

- Accept new optional field `calendarUrl` in request body
- Store it on `demo_pages.calendly_url` (voice agent) and `chatbots.widget_config.calendarUrl` (chatbot)
- Return it in the API response

**API docs (`ApiDocsPage.tsx`):**

- Add `calendarUrl` as a documented field in all API examples with a note that it's used for all "Book a Call" / "Book Demo" buttons

**Frontend usage:**

- `DemoPage.tsx` — already uses `page.calendly_url`, works as-is
- `ChatbotPage.tsx` — read `calendarUrl` from `chatbot.widget_config.calendarUrl` as priority, then fall back to global `site_settings` calendar_url
- Pass `calendarUrl` into `ChatWidget` as a new prop
- `ChatWidget` → `ChatWindow` → pass it down so the chatbot conversation system prompt can reference it

**Chatbot conversation edge function:**

- Include the calendar link in the system prompt so the AI can use it in booking confirmation messages

---

### 3. Enriched Landing Pages 

Improve the landing page UI to a world-class, premium level.

Focus on clean layout, strong visual hierarchy, modern typography, and smooth spacing. Make the design feel high-end, minimal, and conversion-focused.

Upgrade all sections:

- Hero section with bold headline, clear value, and strong CTA
- Add smooth animations, hover effects, and micro-interactions
- Use consistent colors, gradients, and modern design system
- Improve responsiveness for mobile and tablet

Enhance trust and clarity:

- Add testimonials, use cases, and clear benefits
- Make sections easy to scan and visually appealing

Ensure everything feels fast, polished, and professional like a top SaaS product.

&nbsp;

---

### 4. In-Chat Table Reservation Flow

**File: `chatbot-conversation/index.ts` (system prompt)**

Update `buildSystemPrompt` to instruct the AI to handle "Reserve a Table" as a step-by-step conversation flow:

1. Ask date → show button options ("Today", "Tomorrow", "This Weekend")
2. Ask time → show time slot buttons
3. Ask number of guests → show buttons ("2", "3-4", "5-6", "7+")
4. Ask name
5. Ask phone/contact
6. Show confirmation with all details + "Confirm" / "Edit" buttons
7. On confirm → show success message with calendar link if available

This is purely a prompt engineering change — the AI already supports `<!--actions:[...]-->` format for buttons.

---

### 5. URL Sanitization in API Responses

**Files: `create-ai-agent/index.ts`, `scrape-and-analyze/index.ts**`

- When building the `baseUrl` from `origin`, extract only the origin (protocol + host), stripping any path
- Use `new URL(origin).origin` to safely extract the base domain
- This ensures returned URLs are always `https://domain.com/slug` not `https://domain.com/some/path/slug`

---

### Files to Edit


| File                                               | Changes                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `src/App.tsx`                                      | Add base domain redirect to aiagentra.cloud                           |
| `src/pages/ChatbotPage.tsx`                        | Enrich with research data (menu, hours, contact), per-client calendar |
| &nbsp;                                             | &nbsp;                                                                |
| `src/pages/ApiDocsPage.tsx`                        | Add `calendarUrl` to API docs                                         |
| `src/components/chatbot/ChatWidget.tsx`            | Accept & pass calendarUrl prop                                        |
| `src/components/chatbot/ChatWindow.tsx`            | Pass calendarUrl to system context                                    |
| `supabase/functions/create-ai-agent/index.ts`      | Accept calendarUrl, sanitize origin URL                               |
| `supabase/functions/create-voice-agent/index.ts`   | Accept calendarUrl                                                    |
| `supabase/functions/scrape-and-analyze/index.ts`   | Accept calendarUrl, sanitize origin URL                               |
| `supabase/functions/chatbot-conversation/index.ts` | Enhanced booking flow prompt, include calendarUrl                     |
