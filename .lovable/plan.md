

## Plan: Unified Production-Grade Prompt Architecture (Voice + Chatbot)

### Summary
Restructure both the **chatbot system prompt** (`chatbot-conversation/index.ts`) and **voice agent prompts** (`create-voice-agent/index.ts`, `generate-voice-prompt/index.ts`) to follow the structured "Emma-style" format with clear sections: Identity, Core Context, Style Guardrails, Intro Flow, Appointment Booking Flow, FAQ Flow, Call Transfer Flow, Memory, and Strict Rules. Make prompts industry-aware with dental as the primary template.

---

### 1. `chatbot-conversation/index.ts` — Rebuild `buildSystemPrompt()`

Replace the current flat prompt with the structured format:

```
[IDENTITY]
You are {agent_name}, an AI voice agent and AI chatbot for {business_name}.
You handle incoming calls and chat messages with a friendly, efficient, professional tone.
Your job is to: help with booking, questions, clinic info. Guide toward booking. Use KB for accuracy. Escalate when necessary.

[CORE CONTEXT (PAIN → OUTCOME → SOLUTION)]
Missed calls = lost patients = lost revenue. Capture every opportunity → convert to booking.

[STYLE GUARDRAILS]
- Concise, varied, proactive
- One question at a time
- Confirm important details
- Use KB—never guess
- Escalate if upset or asks for human

[INTRO FLOW]
Greet → identify intent → route (booking / FAQ / transfer)
⚠️ Do NOT solve here. Only identify and route.

[APPOINTMENT BOOKING FLOW] (dental/clinic)
Step-by-step: dental issue → preferred time → name → email → insurance → check availability → confirm + book → log → confirmation message

[FAQ FLOW]
Answer from KB + scraped data. Short answers. If unsure → pass to team.

[CALL TRANSFER FLOW]
Trigger: upset user, asks for human, complex issue.

[MEMORY + CONTEXT]
Remember returning patients. Don't re-ask known info.

[STRICT RULES]
Never guess. Never overwhelm. Never break character. Always move toward booking.
```

**Industry branching**: When `industry` matches dental/clinic/medical, use the full appointment booking flow. For restaurant, use ordering + reservation flow. For other industries, use a generic inquiry flow. The structure stays the same — only the task flows change.

**Firecrawl KB integration**: Add explicit instruction block:
```
[KNOWLEDGE BASE — SCRAPED DATA]
Always prioritize scraped website content over assumptions.
Answer using only verified data. Keep answers short, clear, relevant.
```

---

### 2. `create-voice-agent/index.ts` — Rebuild `buildRestaurantVoicePrompt()` + `buildGenericVoicePrompt()`

Apply the same structured format for voice agents. Key difference: voice uses `<wait for user response>` markers and phonetic price formatting.

**Dental/clinic branch** gets a dedicated `buildDentalVoicePrompt()`:
- Identity as clinic receptionist
- Appointment booking flow with tool calls (Get_availability, create_appointment, log_patient_details)
- Time rule (configurable timezone)
- FAQ from KB
- Call transfer for upset patients

**Restaurant branch** keeps existing `buildRestaurantVoicePrompt()` but reformatted to match the new structure.

**Generic branch** follows same structure with industry-detected flows.

---

### 3. `generate-voice-prompt/index.ts` — Update Meta-Prompt

Update `VAPI_META_PROMPT` to instruct the LLM to generate prompts in the new structured format with:
- `[IDENTITY]`, `[CORE CONTEXT]`, `[STYLE GUARDRAILS]`, `[INTRO FLOW]`
- Industry-specific `[TASK]` sections with `<wait for user response>`
- `[FAQ FLOW]`, `[CALL TRANSFER FLOW]`, `[MEMORY]`, `[STRICT RULES]`

---

### 4. Chatbot Response Quality Improvements

In the chatbot system prompt, add:
- **Smarter routing**: detect intent keywords (book, appointment, schedule → booking flow; price, cost, how much → KB lookup; angry, frustrated, human → escalation)
- **Conversion-focused CTAs**: every response should include a next-step action button guiding toward booking
- **Natural recovery**: if user goes off-topic, gently redirect: "Good question! By the way, would you like to schedule a visit?"

---

### Files Summary

| File | Change |
|------|--------|
| `supabase/functions/chatbot-conversation/index.ts` | Rewrite `buildSystemPrompt()` with structured section format, industry-aware flows, KB integration instructions |
| `supabase/functions/create-voice-agent/index.ts` | Add `buildDentalVoicePrompt()`, restructure all prompt builders to match unified format |
| `supabase/functions/generate-voice-prompt/index.ts` | Update `VAPI_META_PROMPT` to use new structured format |

