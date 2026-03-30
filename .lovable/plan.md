

## Plan: Human-Tone Voice Agent + Chatbot Prompt Upgrade

### Problem
Current system prompts sound robotic/API-like. The voice agent greeting and chatbot responses feel generic and mechanical.

---

### Changes

#### 1. Voice Agent — Natural First Message + System Prompt (`supabase/functions/create-demo/index.ts`)

**First message** — Change from formal "Hi, thank you for calling..." to natural:
```
"Hey, this is {agent_name} from {business_name}. How can I help you today?"
```

Add `agent_name` as a template variable (default: "Alex", configurable via admin setting `default_agent_name`).

**System prompt for VAPI** — Prepend conversational behavior instructions to the system prompt sent to `createVapiAssistant`:
- Speak naturally like a real staff member
- Keep responses short and clear
- No long explanations, no robotic phrasing
- Ask follow-up questions naturally
- Confirm actions before finalizing

#### 2. Chatbot Conversation — Natural Tone (`supabase/functions/chatbot-conversation/index.ts`)

Rewrite the `ROLE & IDENTITY` and `RESPONSE GUIDELINES` sections in `buildSystemPrompt`:

- Replace "You are the AI assistant for..." with: "You are {agent_name}, a friendly staff member at {business_name}. You talk like a real person — warm, casual, helpful."
- Add explicit anti-robotic rules: "Do NOT sound robotic. Do NOT give long explanations. Keep it conversational."
- Make reservation flow language more natural ("What day works for you?" instead of "What date would you like to reserve?")
- Add personality guidelines: use casual language, contractions, brief responses

#### 3. Chatbot Greeting — Warm Welcome (`supabase/functions/create-demo/index.ts`)

Change default greeting from:
```
"Welcome to {business_name}! How can I help you today?"
```
To:
```
"Hey! 👋 Welcome to {business_name}. What can I help you with?"
```

#### 4. Admin Setting: Agent Name (`supabase/functions/create-demo/index.ts`)

Read `default_agent_name` from admin settings (fallback: "Alex"). Inject into all prompts as `{agent_name}`.

---

### Files Summary

| File | Change |
|------|--------|
| `supabase/functions/create-demo/index.ts` | Add agent_name variable, update first message template, update default greeting, inject conversational tone into system prompt |
| `supabase/functions/chatbot-conversation/index.ts` | Rewrite buildSystemPrompt — natural tone, anti-robotic rules, conversational reservation flow |
| `supabase/functions/create-voice-agent/index.ts` | Same natural first message + tone rules |

