

## Plan: Advanced Time Tracking + VAPI Prompt Builder System

### Two Workstreams

---

### Workstream 1: Advanced Time Tracking

**Problem**: Current tracking only records event timestamps. No session duration, time-on-page, start/end times, or real-time engagement metrics.

#### Changes

**A. `src/lib/tracking.ts` — Session Timer + Duration Tracking**
- Add `trackSessionStart()` — records page load time, sends `session_start` event
- Add `trackSessionEnd()` — fires on `beforeunload`/`visibilitychange`, sends `session_end` with duration
- Add `trackEngagementTime(slug, section)` — tracks time spent on specific sections (chatbot, voice agent)
- Store `session_start_time` in sessionStorage for duration calculation
- Send metadata: `{ start_time, end_time, duration_seconds, active_time_seconds }`
- Track idle vs active time using `mousemove`/`keydown`/`scroll` listeners with 30s idle threshold

**B. `src/pages/DemoPage.tsx` — Hook Session Tracking**
- Call `trackSessionStart()` on mount
- Call `trackSessionEnd()` on unmount and visibility change
- Track section-level engagement (time on chatbot, time on voice section)

**C. `src/components/admin/AnalyticsPanel.tsx` — Display Time Metrics**
- Add new summary cards: "Avg Session Duration", "Avg Active Time"
- Add time columns to client table: "First Visit", "Last Visit", "Total Time", "Sessions"
- Calculate per-client: total duration, average session length, time between first and last visit
- Add real-time indicator showing active sessions (sessions with start but no end in last 5 min)
- Format durations as human-readable (e.g., "2m 34s", "1h 12m")

**D. `supabase/functions/track-event/index.ts` — Process Duration Data**
- Accept new fields in metadata: `start_time`, `end_time`, `duration_seconds`, `active_time_seconds`
- Validate duration (reject negative or >24h values)
- No schema change needed — all stored in existing `metadata` JSONB column

---

### Workstream 2: VAPI Prompt Builder System

**Problem**: Current prompt building is hardcoded in edge functions. Need a reusable, template-driven system based on the VAPI Prompting Guide framework.

#### VAPI Framework (from official guide)
Every prompt follows this structure:
- `[Identity]` — persona, role, background
- `[Style]` — tone, language rules, speech patterns
- `[Response Guidelines]` — formatting, limits, dos/donts
- `[Task]` — step-by-step flows with `<wait for user response>` markers
- `[Error Handling]` — fallbacks, unclear input, off-topic
- `[Knowledge Base]` — injected business data

#### Changes

**A. New Edge Function: `supabase/functions/generate-voice-prompt/index.ts`**

Dedicated prompt generation endpoint:
1. Accepts: `industry`, `business_name`, `agent_name`, `knowledge_base`, `custom_instructions`
2. Looks up `industry_templates` for the industry
3. If template has `system_prompt_template` -> use with variable injection
4. If no template -> use LLM to generate a VAPI-structured prompt
5. Auto-saves generated prompts back to `industry_templates` for reuse
6. Returns complete system prompt + first message

The LLM meta-prompt enforces the VAPI structure:
```text
Generate a voice agent prompt for a {industry} business.
MUST follow this structure:
[Identity] — agent persona as {agent_name} at {business_name}
[Style] — conversational, contractions, fillers, spell out numbers
[Response Guidelines] — one question at a time, remember context
[Task: Primary Flow] — step-by-step with <wait for user response>
[Task: Secondary Flows] — additional paths
[Error Handling] — fallbacks
[Knowledge Base] — {structured data}
```

**B. Update `create-demo/index.ts` and `create-voice-agent/index.ts`**
- Replace inline prompt builders with shared prompt builder logic
- Use template's prompt if available, generate via LLM if not

**C. Update `TemplatesPanel.tsx`**
- Add `voice_prompt_template` textarea for full VAPI-structured prompt editing
- Preview rendered prompt with sample data

---

### Files Summary

| File | Change |
|------|--------|
| `src/lib/tracking.ts` | Add session start/end, engagement timer, active time detection |
| `src/pages/DemoPage.tsx` | Hook session lifecycle tracking |
| `src/components/admin/AnalyticsPanel.tsx` | Add time metrics, duration columns, active sessions |
| `supabase/functions/track-event/index.ts` | Validate duration metadata |
| `supabase/functions/generate-voice-prompt/index.ts` | **New** — VAPI prompt builder with template + LLM fallback |
| `supabase/functions/create-demo/index.ts` | Use new prompt builder |
| `supabase/functions/create-voice-agent/index.ts` | Use new prompt builder |
| `src/components/admin/TemplatesPanel.tsx` | Add voice prompt template field |
| `supabase/config.toml` | Add generate-voice-prompt config |

