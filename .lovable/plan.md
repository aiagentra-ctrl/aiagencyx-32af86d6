

## Plan: Link Tracking & Engagement Analytics Dashboard

### Summary
Build a tracking system that logs every visit and interaction on API-generated links, filters out your own traffic (Nepal), and surfaces all engagement data in a new "Analytics" tab on the admin dashboard.

---

### 1. Database: `link_events` Table

New table to store all tracking events per demo/chatbot link.

```sql
CREATE TABLE public.link_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_page_id uuid REFERENCES demo_pages(id) ON DELETE CASCADE,
  chatbot_id uuid REFERENCES chatbots(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  slug text NOT NULL,
  link_type text NOT NULL DEFAULT 'demo',  -- 'demo' | 'chatbot'
  event_type text NOT NULL,  -- 'page_view' | 'chatbot_opened' | 'chatbot_message' | 'voice_call_started' | 'cta_clicked' | 'booking_started'
  session_id text,
  visitor_ip text,
  country_code text,
  city text,
  user_agent text,
  referrer text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: public insert (anon tracking), admin read
ALTER TABLE public.link_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert events" ON public.link_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read events" ON public.link_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service role full" ON public.link_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for dashboard queries
CREATE INDEX idx_link_events_slug ON public.link_events(slug);
CREATE INDEX idx_link_events_created ON public.link_events(created_at DESC);
```

---

### 2. Edge Function: `track-event`

**New file: `supabase/functions/track-event/index.ts`**

- Accepts: `{ slug, link_type, event_type, session_id, metadata }`
- Extracts visitor IP from request headers
- Uses a free IP geolocation API (e.g., `ip-api.com`) to get `country_code`
- **Filters Nepal traffic**: If `country_code === 'NP'`, still stores the event but marks it with `country_code: 'NP'` so the dashboard can exclude it
- Stores user-agent and referrer from headers
- Returns `{ ok: true }`

---

### 3. Frontend Tracking Integration

**Edit `src/pages/DemoPage.tsx`:**
- On page load, generate a `sessionId` (stored in sessionStorage)
- Fire `page_view` event to `track-event` function
- Remove the old `views` counter increment (replace with real tracking)

**Edit `src/components/chatbot/ChatWidget.tsx`:**
- When chatbot opens → fire `chatbot_opened` event
- When first message sent → fire `chatbot_message` event

**Edit `src/pages/DemoPage.tsx` (voice section):**
- When call starts → fire `voice_call_started` event

**Edit CTA buttons:**
- When "Book Call" clicked → fire `cta_clicked` event
- When booking flow starts → fire `booking_started` event

**Shared tracking utility: `src/lib/tracking.ts`**
```typescript
export const trackEvent = async (slug: string, linkType: string, eventType: string, metadata?: any) => {
  let sessionId = sessionStorage.getItem('tracking_sid');
  if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem('tracking_sid', sessionId); }
  
  await supabase.functions.invoke('track-event', {
    body: { slug, link_type: linkType, event_type: eventType, session_id: sessionId, metadata }
  });
};
```

---

### 4. Admin Dashboard: Analytics Tab

**New component: `src/components/admin/AnalyticsPanel.tsx`**

Add a new "Analytics" tab in `AdminDashboard.tsx` with:

**Summary Cards (top):**
- Total Links Generated
- Total Unique Visitors (excl. Nepal/Asia)
- Chatbot Engagements
- Voice Call Starts
- CTA Clicks

**Filters:**
- Date range (Last 24h, 7 days, 30 days, custom)
- Business/slug filter dropdown
- Country filter (with "Exclude Asia" toggle — ON by default)

**Per-Link Table:**
| Business | Slug | Views | Chatbot Opens | Voice Calls | CTA Clicks | Last Activity | Status |
|----------|------|-------|---------------|-------------|------------|---------------|--------|

Status logic:
- 🟢 **Engaged** — chatbot or voice interaction
- 🟡 **Viewed** — page opened but no interaction
- 🔴 **No Activity** — link never opened
- Each row expandable to show individual events timeline

**Follow-up Helper Section:**
A filtered view showing:
- "Needs Follow-up" — opened link but didn't interact (→ send reminder)
- "Hot Lead" — interacted with chatbot/voice (→ send booking nudge)
- "Cold" — never opened (→ send initial follow-up)

Each row shows the business name, link, country, and suggested action.

---

### 5. Country Filtering (Nepal/Asia Exclusion)

The `track-event` edge function captures `country_code` via IP geolocation. The dashboard queries filter:

```sql
-- Default: exclude Asian countries
WHERE country_code NOT IN ('NP', 'IN', 'BD', 'PK', 'LK', 'MM', 'TH', 'VN', 'PH', 'ID', 'MY', 'CN', 'JP', 'KR', ...)
```

Dashboard toggle: "Show only target markets (NZ, AU, CA)" — filters to those 3 countries only.

---

### Files Summary

| File | Action |
|------|--------|
| Migration SQL | Create `link_events` table |
| `supabase/functions/track-event/index.ts` | Create — event ingestion + geo lookup |
| `supabase/config.toml` | Edit — register track-event |
| `src/lib/tracking.ts` | Create — shared tracking utility |
| `src/pages/DemoPage.tsx` | Edit — fire page_view, voice events |
| `src/components/chatbot/ChatWidget.tsx` | Edit — fire chatbot events |
| `src/components/demo/CTASection.tsx` | Edit — fire cta_clicked |
| `src/components/admin/AnalyticsPanel.tsx` | Create — full analytics dashboard |
| `src/pages/AdminDashboard.tsx` | Edit — add Analytics tab |

