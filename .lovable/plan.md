

## Plan: Advanced Voice Agent with RAG Knowledge Base + Industry-Dynamic Behavior

### Summary
Upgrade the VAPI voice agent system prompt (injected at creation time) to include the full RAG knowledge base, industry-aware conversation rules, smart recommendation logic, natural tone enforcement, and graceful fallback behavior. The voice agent already gets its prompt at creation via `create-demo` and `create-voice-agent` — the upgrade focuses on making that prompt dramatically smarter.

---

### Problem
Currently the voice agent gets a basic system prompt + raw knowledge base text. It lacks:
- Structured recommendation instructions
- Industry-specific conversation flows (it uses restaurant flows for all niches)
- Natural multi-turn conversation handling rules
- Fallback behavior when data is missing

### Changes

#### 1. `supabase/functions/create-demo/index.ts` — Enhanced Voice Agent Prompt

Update `createVapiAssistant` to build a rich, industry-aware system prompt instead of just appending raw KB text.

New prompt structure:
- **Role & Identity**: Natural persona with industry context (not just generic "staff member")
- **Knowledge Base**: Structured items grouped by category with prices, descriptions
- **Recommendation Rules**: When user asks about products/services, suggest 2-3 best matches from KB based on intent, preferences, budget
- **Industry-Specific Flows**: Dynamic conversation paths based on `resolvedIndustry`:
  - Restaurant: ordering flow, dietary preferences, combos
  - E-commerce: product search, comparison, purchase guidance
  - Services (dental/salon/etc.): appointment booking, service explanation
  - Default: general inquiry + booking
- **Multi-Turn Context Rules**: Remember preferences mentioned earlier, build on previous answers
- **Fallback Behavior**: If no matching data, ask clarifying questions or suggest alternatives gracefully
- **Anti-Robotic Rules**: Contractions, short replies, casual tone, no corporate phrases

The `buildKnowledgeBase` function in create-demo already structures data well — enhance it to also produce a "top recommendations" summary for voice.

#### 2. `supabase/functions/create-voice-agent/index.ts` — Same Prompt Upgrade

Apply the same enhanced prompt logic for standalone voice agent creation (used outside of create-demo flow). Add industry-aware prompt building with the same structured KB format and recommendation instructions.

Accept new optional parameters: `industry`, `structured_data` — so the caller can pass extracted business data for richer prompts.

#### 3. `src/components/demo/VoiceAgentSection.tsx` — Dynamic Voice Prompts

Already accepts `voicePrompts` prop from `DemoPage`. No structural change needed, but ensure the prompts displayed match the industry (this is already handled by `dynamic_content.voice_prompts` from the LLM).

---

### Enhanced Voice Agent Prompt Template (injected at creation)

```text
## ROLE
You are {agent_name}, a real staff member at {business_name} ({industry}).
Talk naturally — warm, casual, brief. Use contractions. No corporate phrases.

## KNOWLEDGE BASE
[structured items: name, price, description, category]

## SMART RECOMMENDATIONS
When user asks about products/services/menu:
- Search KB for best 2-3 matches
- Consider: user preferences, budget, dietary needs, occasion
- Present: name, price, brief description
- Ask follow-up: "Want me to add that?" or "Anything else?"

## INDUSTRY FLOWS
[Dynamic based on industry — booking, ordering, service inquiry]

## CONVERSATION RULES
- Keep responses 1-3 sentences
- Remember what user said earlier
- Ask one question at a time
- If no match found: "Let me check... we have [alternatives]"
- Confirm before finalizing any action
```

### Files Summary

| File | Change |
|------|--------|
| `supabase/functions/create-demo/index.ts` | Edit — build industry-aware voice prompt with structured KB, recommendation rules, dynamic conversation flows |
| `supabase/functions/create-voice-agent/index.ts` | Edit — accept `industry` + `structured_data` params, build same enhanced prompt |

