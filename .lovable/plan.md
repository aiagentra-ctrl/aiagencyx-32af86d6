

## Plan: Advanced Dental Voice Agent + Firecrawl KB Integration + Smarter Booking Flow

### Summary
Upgrade the dental clinic voice agent and chatbot system prompts to be production-grade: add a dedicated `buildDentalVoicePrompt` function (like the restaurant one), integrate Firecrawl scraped data as the primary knowledge source with strict response rules, and redesign the chatbot booking flow for dental appointments to be smoother and higher-converting.

---

### 1. `supabase/functions/create-demo/index.ts` — Add Dedicated Dental Voice Prompt

Add `buildDentalVoicePrompt()` alongside the existing `buildRestaurantVoicePrompt()`. This is a full VAPI-structured prompt with:

- **[Identity]**: Real receptionist persona at the dental clinic, knows all services/treatments
- **[Style]**: Warm, reassuring tone (patients may be nervous), uses dental-appropriate language
- **[Task: Appointment Booking]**: Step-by-step flow (service needed → preferred date → preferred time → name → phone → insurance → confirmation) with `<wait for user response>` markers
- **[Task: Service Questions]**: Pulls from scraped KB data to answer about treatments, pricing, insurance
- **[Task: Emergency Handling]**: Recognizes dental emergencies, prioritizes urgent scheduling
- **[Task: Insurance & Pricing]**: Answers from KB, gracefully handles unknowns ("Let me have our billing team confirm that for you")
- **[Task: Patient Recall]**: Proactively suggests follow-ups for returning patients
- **[KB Usage Rules]**: Strict — never guess services/pricing, never mention scraping, answer from verified data only, fallback: "I'll have our team confirm that for you"

Update the dispatcher `getVoicePrompt()` to detect dental industry and route to this new function:
```
if (isDentalIndustry(industry)) return buildDentalVoicePrompt(...);
if (isRestaurantIndustry(industry)) return buildRestaurantVoicePrompt(...);
return buildGenericVoicePrompt(...);
```

Add `isDentalIndustry()` helper matching: dental, dentist, clinic, orthodont, oral, healthcare, medical, doctor.

---

### 2. `supabase/functions/create-voice-agent/index.ts` — Same Dental Prompt

Mirror the same `buildDentalVoicePrompt()` and `isDentalIndustry()` in the standalone voice agent creation function. Update its dispatcher to use the dental prompt when applicable.

---

### 3. `supabase/functions/chatbot-conversation/index.ts` — Smarter Dental Booking Flow + KB Rules

Upgrade `buildSystemPrompt()` to detect dental industry and inject:

**A. Enhanced Appointment Booking Flow (replaces generic reservation flow for dental):**
- Step 1: "What brings you in? Routine cleaning, a specific concern, or something else?"
- Step 2: Suggest relevant services from KB with pricing (if available)
- Step 3: "Do you have a preferred day?" (show Today/Tomorrow/This Week/Next Week buttons)
- Step 4: "Morning or afternoon?" (show time-range buttons instead of exact times)
- Step 5: "Can I get your name?"
- Step 6: "Best phone number to reach you?"
- Step 7: "Do you have dental insurance? If so, which provider?"
- Step 8: Confirmation summary with edit option
- Each step uses action buttons for common choices to reduce typing

**B. Firecrawl KB Integration Rules (added to system prompt for all industries but emphasized for dental):**
- Prioritize scraped website content over assumptions
- Never guess services or pricing — only state what's in KB
- Never mention "scraped data" or "Firecrawl" — present naturally
- If data is available → answer directly
- If partially available → answer + clarify
- If missing → "I'll have our team confirm that for you"
- Guide toward booking when answering service questions

**C. Dental-Specific Response Intelligence:**
- Recognize urgency keywords (pain, emergency, broken tooth, bleeding) → fast-track to booking
- For treatment questions → pull from KB, describe simply, suggest consultation
- For cost questions → give KB price if available, else suggest calling for exact quote
- For insurance → check KB, offer to verify coverage

---

### 4. `supabase/functions/generate-voice-prompt/index.ts` — Dental Meta-Prompt Enhancement

Update the `VAPI_META_PROMPT` to include dental-specific instructions so when auto-generating prompts for dental businesses, the LLM produces the right appointment booking flow, emergency handling, and insurance/pricing patterns.

---

### Files Summary

| File | Change |
|------|--------|
| `supabase/functions/create-demo/index.ts` | Add `buildDentalVoicePrompt()`, `isDentalIndustry()`, update dispatcher |
| `supabase/functions/create-voice-agent/index.ts` | Same dental prompt builder + dispatcher update |
| `supabase/functions/chatbot-conversation/index.ts` | Dental-specific booking flow, KB response rules, urgency detection |
| `supabase/functions/generate-voice-prompt/index.ts` | Dental-aware meta-prompt for auto-generation |

