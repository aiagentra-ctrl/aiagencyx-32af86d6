

# AI Chatbot Builder System — Implementation Plan

## Overview

Build a complete AI chatbot creation and hosting system alongside the existing voice agent demo pages. The system will: scrape a client's website using Firecrawl, analyze it with Lovable AI to auto-generate a chatbot system prompt, and deploy a hosted chatbot page with a shareable URL.

## Architecture

```text
Admin Panel                Edge Functions              Database
┌─────────────┐     ┌──────────────────────┐    ┌──────────────┐
│ Create       │────▶│ scrape-website       │───▶│ chatbots     │
│ Chatbot Form │     │ (Firecrawl + AI)     │    │ table        │
│              │     ├──────────────────────┤    ├──────────────┤
│ Manage       │────▶│ chatbot-conversation │    │ chatbot_     │
│ Chatbots     │     │ (Lovable AI gateway) │    │ conversations│
│              │     └──────────────────────┘    │ table        │
│ View Convos  │                                 └──────────────┘
└─────────────┘
        │
        ▼
  /:slug/chatbot  ←── Hosted chatbot page
  Chat widget on demo pages
```

## Connector Required

**Firecrawl** — needed for website scraping. Will use `standard_connectors--connect` to set up.

## Database Changes (Migration)

### Table: `chatbots`
- `id` uuid PK
- `business_name` text NOT NULL
- `website_url` text
- `slug` text NOT NULL UNIQUE
- `system_prompt` text NOT NULL
- `ai_provider` text DEFAULT 'lovable' (lovable | openai | openrouter | claude | gemini | custom)
- `ai_model` text DEFAULT 'google/gemini-3-flash-preview'
- `api_key_encrypted` text (for custom API keys — stored per chatbot)
- `research_data` jsonb (scraped business analysis)
- `brand_tone` text
- `industry` text
- `services` jsonb DEFAULT '[]'
- `faq_topics` jsonb DEFAULT '[]'
- `widget_config` jsonb (colors, position, greeting message)
- `demo_page_id` uuid FK → demo_pages(id) (optional link)
- `status` text DEFAULT 'active'
- `created_at` timestamptz DEFAULT now()

RLS: Public read by slug, service_role full access, anon can insert conversations.

### Table: `chatbot_conversations`
- `id` uuid PK
- `chatbot_id` uuid FK → chatbots(id) ON DELETE CASCADE
- `session_id` text NOT NULL
- `messages` jsonb DEFAULT '[]'
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

RLS: Public read/write by session_id.

## Edge Functions

### 1. `scrape-and-analyze` (new)
- Accepts `{ businessName, websiteUrl }`
- Uses Firecrawl API to scrape website (markdown + branding formats)
- Sends scraped content to Lovable AI (`google/gemini-3-flash-preview`) with a structured extraction prompt
- Returns: industry, services, brand tone, FAQ topics, auto-generated system prompt
- Saves chatbot record to database

### 2. `chatbot-conversation` (new)
- Accepts `{ chatbotId, sessionId, message }`
- Loads chatbot config (system prompt, AI provider/model)
- Loads conversation history from `chatbot_conversations`
- Routes to appropriate AI provider:
  - `lovable` → Lovable AI Gateway (default, no extra key needed)
  - `custom` → user-provided API key from `api_key_encrypted`
- Streams response back via SSE
- Saves updated conversation

## Frontend Components

### Admin Panel Additions
- **Chatbot tab/section** in AdminDashboard with:
  - "Create Chatbot" button → multi-step dialog (business name → website URL → review AI analysis → confirm)
  - Chatbots table (name, industry, slug, status, conversations count, actions)
  - Edit chatbot dialog (prompt, AI provider, model, API key, widget config)
  - Conversations viewer per chatbot

### Chatbot Pages
- **Route: `/:slug/chatbot`** — full-page hosted chatbot UI
- **ChatWidget component** — floating bubble + chat window, embedded on demo pages
- Modern chat UI: typing indicator, message bubbles, quick replies, mobile responsive

### New Files
- `src/pages/ChatbotPage.tsx` — hosted chatbot page
- `src/components/chatbot/ChatWidget.tsx` — floating chat widget
- `src/components/chatbot/ChatWindow.tsx` — chat interface
- `src/components/chatbot/ChatMessage.tsx` — message bubble
- `src/components/admin/CreateChatbotDialog.tsx` — creation wizard
- `src/components/admin/EditChatbotDialog.tsx` — edit settings
- `src/components/admin/ChatbotConversations.tsx` — conversation viewer
- `supabase/functions/scrape-and-analyze/index.ts`
- `supabase/functions/chatbot-conversation/index.ts`

### Routing Update (App.tsx)
- Add `/:slug/chatbot` route → ChatbotPage
- ChatWidget auto-embedded on DemoPage when `demo_page_id` is linked

## Implementation Order

1. Connect Firecrawl connector
2. Create database tables (migration)
3. Build `scrape-and-analyze` edge function
4. Build `chatbot-conversation` edge function (streaming)
5. Build admin UI (create/manage chatbots)
6. Build hosted chatbot page + chat widget
7. Integrate chat widget into existing demo pages

## Technical Notes

- **AI Provider**: Defaults to Lovable AI (no extra API key). Custom providers store encrypted keys per chatbot.
- **Streaming**: chatbot-conversation uses SSE streaming for real-time responses.
- **Firecrawl**: Uses `markdown` + `branding` formats to extract content and brand identity.
- **No auth required**: Matches existing pattern — admin panel is open, chatbot pages are public.

