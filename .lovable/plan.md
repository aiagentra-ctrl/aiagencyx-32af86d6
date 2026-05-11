## Plan: Follow-Up Templates Admin Module + Template-Driven Sends

Purely additive. No existing admin tab, API field, or edge function behavior changes.

---

### 1. Database (additive migration)

**New table `follow_up_templates`:**
- `id` uuid PK
- `condition` text UNIQUE — one of `not_tried`, `tried_voice_agent`, `tried_chatbot`
- `subject` text
- `body` text (HTML)
- `updated_at` timestamptz default now()
- `created_at` timestamptz default now()

RLS: service_role full; anon/authenticated read + update (admin panel uses anon key like other settings tables — matches existing pattern in `site_settings`).

Seed three rows (one per condition) with sensible defaults so the editor is never empty.

No changes to `demo_leads`, `manyreach_logs`, `create-demo`, or `track-visitor` schema.

---

### 2. Admin UI — new `FollowUpTemplatesPanel.tsx`

Added as a new tab in `AdminDashboard` (alongside Templates, Leads, etc). Existing tabs untouched.

Layout:
```text
[ Did Not Try Demo ] [ Tried Voice Agent ] [ Tried AI Chatbot ]
─────────────────────────────────────────────
Subject:  [ ___________________________ ]

Variables:  [{FirstName}] [{Company}] [{CampaignName}]
            [{Industry}] [{LeadSource}] [{DemoURL}] [{VisitorCountry}]

┌─ Message Body ─────────┐  ┌─ Live Preview ─────────┐
│ <textarea>             │  │ Subject: ...           │
│                        │  │ ───────────────        │
│                        │  │ <rendered HTML>        │
└────────────────────────┘  └────────────────────────┘

[ Save Template ]
```

Behavior:
- Three Tabs (shadcn `Tabs`), each loads/saves its own row by `condition`.
- Variable chips are buttons; clicking inserts the token at the textarea cursor (track `selectionStart` via ref).
- Live preview: `dangerouslySetInnerHTML` of body with all `{Var}` tokens replaced by the dummy map (John / Acme Corp / Q3 Outreach / Real Estate / cold-email / demo URL / United States). Subject preview rendered as plain text above the body.
- Unknown tokens stay as raw `{Foo}` so typos are visible.
- Save button writes only the active tab's row (upsert by `condition`).

Files: `src/components/admin/FollowUpTemplatesPanel.tsx` (new) + one line added to `AdminDashboard.tsx` to register the tab.

---

### 3. `trigger-follow-up` edge function — switch to DB templates

Currently uses hardcoded FEEDBACK_BODY / REENGAGE_BODY. Change to:

1. Determine condition:
   - `demo_type_tried === 'voice'` → `tried_voice_agent`
   - `demo_type_tried === 'chatbot'` → `tried_chatbot`
   - else → `not_tried`
2. Fetch `follow_up_templates` row for that condition.
3. Build variable map from `demo_leads` row:
   - FirstName, Company, CampaignName, Industry, LeadSource, VisitorCountry, DemoURL (`${SITE_URL}/${slug}`)
4. Replace tokens in subject + body, send via ManyReach (existing payload shape preserved), log to `manyreach_logs` (unchanged).

Fallback: if template row missing or empty, use current hardcoded copy so nothing breaks.

No change to the function's trigger conditions, country gate, or response shape.

---

### 4. `create-demo` — confirm payload shape, return `followUpReady`

The function already accepts the optional fields and inserts `demo_leads`. Two small additive tweaks:

- Add `followUpReady: <bool>` to response (mirrors `is_complete`). Existing keys preserved.
- Make sure system-managed fields (`country`, `demoUrl`, `visitorSessionId`, `demoTried`, `device`, `browser`, `utmParams`) are never read from the request body — they aren't today; just confirm and document.

No removals, no renames.

---

### 5. API docs page (`src/pages/ApiDocsPage.tsx`)

Update the `create-demo` section only:
- Required: `firstName`, `campaignName`, `campaignId`, `messageThreadId`, `senderEmail` (+ existing `agentId`/`chatbotId`).
- Optional: `company`, `industry`, `leadSource`, `ccEmails`, `bccEmails`.
- New "Handled Automatically — Do Not Send" callout listing the 7 system-managed fields.
- Show updated response example with `demoUrl`, `leadId`, `followUpReady`.

No other doc sections touched.

---

### 6. Files

| File | Change |
|------|--------|
| `supabase/migrations/<new>.sql` | new `follow_up_templates` table + RLS + seed rows |
| `src/components/admin/FollowUpTemplatesPanel.tsx` | NEW — tabs/editor/preview |
| `src/pages/AdminDashboard.tsx` | add one tab entry |
| `supabase/functions/trigger-follow-up/index.ts` | fetch template by condition + render variables |
| `supabase/functions/create-demo/index.ts` | add `followUpReady` to response (additive) |
| `src/pages/ApiDocsPage.tsx` | update required/optional/auto sections |

---

### Guarantees
- No existing admin tab, table, RLS policy, or edge endpoint is altered destructively.
- ManyReach send path remains the same; only the message source changes from hardcoded to DB.
- If admin never opens the new panel, seeded defaults keep current behavior intact.
- API caller surface is reduced to lead identity + campaign data; everything else stays server-side.

Approve and I'll implement, starting with the migration.
