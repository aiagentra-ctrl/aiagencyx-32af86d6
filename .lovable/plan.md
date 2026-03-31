

## Plan: Production-Grade Restaurant Voice Agent (VAPI Best Practices)

### Summary
Build a dedicated, advanced restaurant voice agent prompt system following the VAPI Prompting Guide's structured format ([Identity], [Style], [Task], [Response Guidelines], etc.). Replace the current generic `buildVoiceAgentPrompt` restaurant branch with a purpose-built, restaurant-specific prompt factory. Also create a reusable prompt architecture pattern for future industries.

---

### Key Learnings from VAPI Prompting Guide (Applied)

- **Organize into labeled sections**: `[Identity]`, `[Style]`, `[Response Guidelines]`, `[Task]`, `[Error Handling]`
- **Break complex tasks into step-by-step flows** with conditional branching
- **Use `<wait for user response>`** markers for multi-turn control
- **Spell out numbers** for natural speech (e.g., "twelve ninety-nine" not "$12.99")
- **Add voice realism**: hesitations ("um", "uh"), fillers ("sure thing", "gotcha"), natural pauses ("...")
- **Silent tool triggers**: no "I'm transferring you" — just do it
- **Fallback/error handling** section mandatory

---

### Changes

#### 1. `supabase/functions/create-demo/index.ts` — Restaurant-Specific Prompt Builder

Add a new function `buildRestaurantVoicePrompt()` that generates a VAPI-optimized prompt following the guide's structure:

```text
[Identity]
You are {agent_name}, a real team member at {business_name}.
You've worked here for years. You know the menu by heart.
You're the person everyone loves talking to when they call.

[Style]
- Conversational, warm, like talking to a friend
- Use contractions: I'm, we've, that's, don't, gonna
- Natural fillers: "Sure thing", "Gotcha", "Oh yeah", "Absolutely"
- Spell out prices naturally: "twelve ninety-nine" not "$12.99"
- Keep it to one to three sentences max
- No corporate language. No "I'd be happy to assist"
- Add natural pauses: "Let me think..." "Hmm..."

[Response Guidelines]
- Ask ONE question at a time
- Remember everything the caller said (preferences, allergies, party size)
- Confirm before finalizing any order or reservation
- Never say "function", "tool", "AI", or "assistant"
- If caller says their name, use it throughout the call

[Task: Ordering Flow]
1. "What are you in the mood for today?"
<wait for user response>
2. Based on their answer, suggest two to three items from the menu.
   - Include name and price spoken naturally
   - If they mention a preference (spicy, vegetarian, budget), filter suggestions
<wait for user response>
3. If they pick something: "Great choice! Want to add [popular side/drink] with that?"
<wait for user response>
4. Ask about any modifications: "Any allergies or changes I should note?"
<wait for user response>
5. Confirm the full order: "So I've got [items]. That comes to about [total]. Sound right?"
<wait for user response>
6. Ask: "Pickup or delivery?" → get time/address as needed
7. "You're all set! Should be ready in about [time]. Anything else?"

[Task: Reservation Flow]
1. "Sure, I can help with that! What date were you thinking?"
<wait for user response>
2. "And what time works best?"
<wait for user response>
3. "How many people?"
<wait for user response>
4. "Can I get a name for the reservation?"
<wait for user response>
5. "And a phone number just in case?"
<wait for user response>
6. Confirm: "Got it — [name], party of [size], [date] at [time]. All set!"

[Task: Menu Questions]
- When asked about a category: describe two to three items with prices naturally
- When asked "what's good?": recommend the most popular items
- When asked about dietary options: filter menu by preference
- When asked about specials: mention today's specials or combos

[Task: Upselling (Natural)]
- After main item: suggest a complementary side or drink
- Mention combos if they exist: "We actually have a combo with that..."
- If ordering for a group: "Want me to suggest a few different things?"
- Never push — just suggest casually

[Error Handling]
- Unclear response: "Sorry, I didn't catch that — could you say it again?"
- Unknown item: "Hmm, I don't think we have that... but we do have [similar]. Want to try that?"
- Can't help: "Let me check on that — I'll have someone get back to you, what's a good number?"
- Off-topic: "Ha, that's a good one! But let me help you with your order first"

[Knowledge Base]
{structured_kb_with_menu_items}
```

**Selection logic**: When `resolvedIndustry` matches restaurant/food/cafe/pizza/bakery, use `buildRestaurantVoicePrompt()` instead of the generic `buildVoiceAgentPrompt()`.

#### 2. `supabase/functions/create-voice-agent/index.ts` — Same Restaurant Prompt

Apply the same restaurant-specific prompt builder. When `industry` matches restaurant keywords, use the dedicated function.

#### 3. Prompt Architecture Pattern (for future industries)

Structure both functions so adding a new industry prompt is just adding a new `buildXxxVoicePrompt()` function and a condition check. Pattern:

```typescript
function getVoicePromptBuilder(industry: string) {
  const li = industry.toLowerCase();
  if (["restaurant","food","cafe","pizza","bakery"].some(k => li.includes(k)))
    return buildRestaurantVoicePrompt;
  // Future: buildDentalVoicePrompt, buildEcommerceVoicePrompt, etc.
  return buildGenericVoicePrompt; // current buildVoiceAgentPrompt renamed
}
```

---

### Files Summary

| File | Change |
|------|--------|
| `supabase/functions/create-demo/index.ts` | Add `buildRestaurantVoicePrompt()`, add dispatcher `getVoicePromptBuilder()`, use in `createVapiAssistant` |
| `supabase/functions/create-voice-agent/index.ts` | Same restaurant prompt builder + dispatcher |

