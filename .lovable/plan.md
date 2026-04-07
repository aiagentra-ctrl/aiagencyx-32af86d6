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

#### VAPI Framework Sections (from official guide)
Every prompt follows this structure:
- `[Identity]` — persona, role, background
- `[Style]` — tone, language rules, speech patterns
- `[Response Guidelines]` — formatting, limits, dos/donts
- `[Task]` — step-by-step flows with `<wait for user response>` markers
- `[Error Handling]` — fallbacks, unclear input, off-topic
- `[Knowledge Base]` — injected business data

#### Changes

**A. New Edge Function: `supabase/functions/generate-voice-prompt/index.ts`**

A dedicated prompt generation endpoint that:
1. Accepts: `industry`, `business_name`, `agent_name`, `knowledge_base` (structured data), `custom_instructions`
2. Looks up `industry_templates` for the industry
3. If template exists with `system_prompt_template` → use it with variable injection
4. If no template → use LLM to generate a VAPI-structured prompt following the framework
5. Returns the complete system prompt + first message

The LLM meta-prompt for generation:
```
Generate a VAPI voice agent system prompt for a {industry} business called {business_name}.

Follow this EXACT structure:

[Identity]
- Define agent as {agent_name}, a real staff member
- Include personality traits specific to {industry}

[Style]  
- Conversational, warm tone
- Use contractions always
- Natural fillers appropriate to the industry
- Spell out numbers for voice
- 1-3 sentences max per response

[Response Guidelines]
- One question at a time
- Remember caller context
- Never reveal AI nature
- Confirm before actions

[Task: Primary Flow]
- Step-by-step interaction flow with <wait for user response> markers
- Industry-specific: ordering for restaurants, booking for clinics, product help for e-commerce

[Task: Secondary Flows]
- Additional conversation paths relevant to the industry

[Error Handling]
- Unclear input handling
- Unknown request fallback
- Off-topic redirect

[Knowledge Base]
{inject structured business data here}
```

**B. Update `industry_templates` Table Usage**

Add a new field to the template form in `TemplatesPanel.tsx`:
- `voice_prompt_template` textarea — stores the full VAPI-structured prompt template with `{variables}`
- Display preview of rendered prompt with sample data
- Add industry-specific placeholder suggestions

**C. Update `supabase/functions/create-demo/index.ts`**
- Replace inline `buildVoiceAgentPrompt` with call to the new prompt builder logic (shared function, not HTTP call for performance)
- Use template's `voice_prompt_template` if available, otherwise generate via LLM

**D. Update `supabase/functions/create-voice-agent/index.ts`**  
- Same: use template-driven or LLM-generated VAPI-structured prompts
- Accept `custom_instructions` parameter for per-request overrides

---

### Files Summary

| File | Change |
|------|--------|
| `src/lib/tracking.ts` | Add session start/end tracking, engagement timer, active time detection |
| `src/pages/DemoPage.tsx` | Hook session lifecycle tracking |
| `src/components/admin/AnalyticsPanel.tsx` | Add time metrics cards, duration columns, active session indicator |
| `supabase/functions/track-event/index.ts` | Validate duration metadata |
| `supabase/functions/generate-voice-prompt/index.ts` | **New** — dedicated VAPI prompt builder with template lookup + LLM fallback |
| `supabase/functions/create-demo/index.ts` | Use new prompt builder logic |
| `supabase/functions/create-voice-agent/index.ts` | Use new prompt builder logic |
| `src/components/admin/TemplatesPanel.tsx` | Add voice prompt template field |
| `supabase/config.toml` | Add `generate-voice-prompt` function config |
