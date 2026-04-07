

## Plan: Lead Management & Follow-up System

### Summary
Add a new "Leads" tab to the admin dashboard with a full lead management system — independent from the existing analytics table (zero changes to it). Includes a new `leads` database table for follow-up tracking, automated status classification, and a detailed lead view.

---

### 1. Database: New `leads` Table

```sql
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  business_name text NOT NULL,
  status text NOT NULL DEFAULT 'needs_follow_up',
  -- statuses: needs_follow_up, interested, awaiting_response, engaged, call_scheduled, cold_lead
  follow_up_count integer NOT NULL DEFAULT 0,
  last_follow_up_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lead_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  stage text NOT NULL DEFAULT 'reminder', -- reminder, nudge, final
  created_at timestamptz NOT NULL DEFAULT now()
);
```

RLS: Full access for anon/authenticated (matches existing pattern).

---

### 2. New Component: `src/components/admin/LeadsPanel.tsx`

Main leads dashboard with:
- **Auto-sync**: On load, scans `link_events` for unique slugs and upserts into `leads` table
- **Auto-classify status** based on activity from `link_events`:
  - Only page_view → `needs_follow_up`
  - Tried voice agent → `interested`
  - Tried chatbot only → `awaiting_response`
  - Multiple interactions → `engaged`
  - Manual override for `call_scheduled` and `cold_lead`
- **Lead table** with columns: Business, Status (color badge), Follow-ups Sent, Last Follow-up, Next Reminder, Actions
- **Filter tabs**: All | Needs Follow-up | Interested | Engaged | Cold
- **Bulk actions**: Mark as Cold, Schedule Follow-up

---

### 3. New Component: `src/components/admin/LeadDetailView.tsx`

Opens as a Dialog when clicking a lead row. Shows:

**Header**: Business name, status badge, manual status override dropdown

**Sections (tabs or accordion)**:
- **Overview**: First visit, last activity, total sessions, device, location, voice/chatbot usage flags
- **Activity Timeline**: Fetched from `link_events` — chronological feed (reuses pattern from ClientDetailCard)
- **Chat History**: From `chatbot_conversations` — full transcript
- **Follow-up History**: From `lead_follow_ups` — all sent messages with timestamps and stage labels
- **Add Follow-up**: Form with message textarea + stage selector (Reminder/Nudge/Final). On submit, inserts into `lead_follow_ups`, increments `follow_up_count`, updates `last_follow_up_at`
- **Notes**: Editable text field saved to `leads.notes`
- **Next Follow-up**: Date picker for `next_follow_up_at`

---

### 4. Admin Dashboard Integration

Add a new tab "Leads" to `AdminDashboard.tsx`:
```
<TabsTrigger value="leads">
  <UserCheck className="mr-1.5 h-3.5 w-3.5" />
  Leads
</TabsTrigger>
```

---

### 5. Auto-Status Update Logic (in LeadsPanel)

On sync, for each lead:
1. Query `link_events` for that slug
2. Check for `voice_call_started` → `interested`
3. Check for `chatbot_opened`/`chatbot_message` → `awaiting_response`
4. Check totalClicks >= 3 → `engaged`
5. Check if `follow_up_count >= 3` and no recent activity → `cold_lead`
6. Otherwise → `needs_follow_up`
7. Never auto-downgrade manually set statuses (`call_scheduled`)

---

### Files Summary

| File | Change |
|------|--------|
| Migration | Create `leads` + `lead_follow_ups` tables with RLS |
| `src/components/admin/LeadsPanel.tsx` | **New** — lead list, auto-sync, filters, status badges |
| `src/components/admin/LeadDetailView.tsx` | **New** — full lead detail dialog with follow-up management |
| `src/pages/AdminDashboard.tsx` | Add "Leads" tab (no changes to existing tabs) |

