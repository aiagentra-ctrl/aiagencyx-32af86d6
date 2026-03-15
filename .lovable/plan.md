

# Fix Chatbot + Advanced UI + Landing Page Integration

## Root Cause: Chatbot Not Working

The edge function logs show `Lovable AI: 402` — the AI gateway is returning "Payment Required" (credits exhausted). Since no backup API providers are configured in the `api_providers` table, every chat request fails silently. The scrape-and-analyze function has the same issue — it falls back to a generic prompt instead of real AI analysis.

**Fix**: Surface the 402 error clearly to the user, and ensure the failover chain works when providers are added.

## Implementation Plan

### 1. Fix Chatbot Conversation Edge Function
- Improve error messages: when all providers return 402, return a clear message ("AI credits exhausted — add an API provider in the admin panel or top up credits")
- Fix the streaming response to properly handle partial failures
- Ensure conversation history is correctly loaded and sent to the AI

### 2. Upgrade ChatbotPage with Advanced UI
Replace the basic chatbot page with a modern layout:
- **Side panel** with business info, services, FAQ topics, contact info (pulled from `chatbots` table `research_data`, `services`, `faq_topics`)
- **Chatbot header** showing business name, industry, brand tone, and logo (if extracted)
- **Quick suggestion buttons** based on `faq_topics` and `services`
- **Typing animation** with animated dots
- **Mobile responsive**: side panel collapses to a drawer on mobile

### 3. Logo Extraction in Scrape-and-Analyze
- Add `branding` to Firecrawl scrape formats to extract logo URL
- Store logo URL in `widget_config.logo` on the chatbot record
- Display logo in chatbot header and landing page

### 4. Improve ChatWidget (Floating Widget)
- Show business logo in widget header
- Add quick reply suggestion chips
- Better mobile layout (full-screen on mobile)

### 5. Landing Page Chat Integration
- Already works via `demo_page_id` linkage
- Add UI in admin to link/unlink chatbots to demo pages
- Show chatbot widget with business branding on demo pages

### 6. API Documentation Page
- New route `/api-docs` with a clean documentation page
- Document three endpoints:
  - `POST /functions/v1/create-demo-page` (Voice Agent)
  - `POST /functions/v1/scrape-and-analyze` (Chatbot)
  - Combined usage example
- Include copyable cURL examples and response schemas

### Database Changes
- Add `logo_url` column to `chatbots` table (text, nullable)

### Files to Create/Edit
- `supabase/functions/chatbot-conversation/index.ts` — better error handling
- `supabase/functions/scrape-and-analyze/index.ts` — add branding/logo extraction
- `src/pages/ChatbotPage.tsx` — complete redesign with side panel
- `src/components/chatbot/ChatWindow.tsx` — quick replies, better UX
- `src/components/chatbot/ChatMessage.tsx` — typing animation
- `src/components/chatbot/ChatWidget.tsx` — logo, mobile fullscreen
- `src/pages/ApiDocsPage.tsx` — new API documentation page
- `src/App.tsx` — add `/api-docs` route
- Migration for `logo_url` column

### Implementation Order
1. Database migration (add `logo_url`)
2. Fix edge functions (error handling + logo extraction)
3. Upgrade ChatbotPage with side panel and advanced UI
4. Upgrade ChatWidget
5. Create API docs page
6. Update routing

