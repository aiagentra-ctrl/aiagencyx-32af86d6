# Fix: negative replies classified as positive

## What I confirmed from the live data

Both leads' real message bodies are in the database, and I reproduced the misfire against the actual keyword matcher.

**Barry Pound** — his reply is stored as `Not​ ​interested​ ​.........thanks​ ​you`, where the spaces are invisible zero-width characters (U+200B) inserted by the sending client. The negative rule looks for the literal phrase `not interested`, which no longer matches once those characters are in the middle of it. The positive rule then matched the bare word `interested` and won.

**Dan Higginson** — his actual sentence ("then it is a 'no'") matches no negative keyword at all, because a plain "no" is not in the negative list. Meanwhile his email footer contains the standard legal disclaimer "Please **do not copy** it or use it for any purpose", and the positive rule matched the fragment `please do` inside it. The matcher reads the entire raw email — signature block, phone numbers and legal boilerplate included — not just what the person actually wrote.

**Templates are being used.** The "Great to hear…" message is the stored Positive template rendered verbatim. Nothing was freestyled by the AI. The keyword step decided "Positive" and the locked template path fired.

**Demo link.** Dan had a demo built and received a working link. Barry had no demo record and no website on file, so his template rendered with an empty link — he received a message with the link line blank.

**History.** The reply generator does load the last 20 messages of the thread and passes them to the AI, but the keyword step that actually decides which locked template to send runs *only* on the latest message text, so history has no influence on the outcome today.

## The fix

### 1. Clean the reply before reading it

Strip zero-width and invisible characters, normalise unicode punctuation and whitespace, then cut the message down to what the person actually typed: drop quoted history (`On … wrote:`, `>` lines), signature blocks (`--`, name/title/phone/address footers) and legal disclaimer boilerplate. Sentiment is judged only on that remaining reply text.

### 2. Rewrite the sentiment rules

- Negative wins on any hit, and the negative list expands to cover short refusals: standalone "no", "no." / "no thanks" / "not for me" / "not now", "please remove", "unsubscribe", plus tolerance for the misspellings and punctuation runs people actually send.
- Positive keywords must match as whole words with a negation guard — "interested" preceded by not/never/isn't does not count as positive, and phrase fragments like "please do" are removed from the list entirely.
- If neither side is clearly matched, do **not** guess: route to the objection/manual path rather than defaulting to Positive.

### 3. History gate before anything is sent

After classification, and before any template is sent, the system checks the full thread for that lead:

- if any earlier reply from that lead was negative or an opt-out, the lead is treated as negative regardless of what the latest line looks like;
- if the same template was already sent to that lead, it is not sent again;
- if the thread contains explicit opt-out language at any point, nothing further is sent and the lead is paused.

Classification becomes step one; the history check confirms or overrides it, and can veto sending altogether.

### 4. Demo link guaranteed before either template goes out

Both templates carry the demo link, so the send is held until a demo page exists for that lead. If the demo build fails or there is no website on file (Barry's case), the message is not sent with an empty link — the lead is flagged for review in the Inbox instead.

### 5. Template text updated to your exact copy

- Negative: `{DemoLandingPageLink}, but... this is done specially for you.` — nothing before or after.
- Positive: `Here you go: {DemoLandingPageLink}` then `Let me know what you think about it.` — nothing else.

Both stored as locked defaults, sent character-for-character with only the link substituted.

### 6. Inbox history visibility

Every lead gets a thread view showing each message sent and received in order, with the classification that fired, which template was used, and whether a demo link was attached. This is where you audit a lead instead of hearing about it from a forwarded reply.

### 7. Verification before it touches more leads

A replay check runs the corrected logic against every reply already in the database — including Dan's and Barry's exact stored bodies — and reports what each one *would* classify as now. You see that list before anything is live. Both cases must come out Negative.

## Technical notes

- New sanitiser in `supabase/functions/_shared/sentiment.ts` (or a sibling `email-clean.ts`) handling zero-width stripping, quote/signature/disclaimer removal.
- Rewritten `keywordSentiment` with word-boundary matching, negation lookbehind, and a `null` (unclear) outcome that never falls through to Positive.
- History gate implemented in `inbox-generate-reply` and enforced in `inbox-process-incoming`, using the already-fetched `inbox_messages` thread plus `prospect_memory`.
- Demo-readiness guard in `inbox-process-incoming`: send only when an `inbox_demos` row exists; otherwise mark the message for review.
- `reply_templates` rows re-seeded with the exact new bodies.
- Separately to verify while in there: the incoming rows for both leads have a NULL `classification` column even though the prospect was marked Positive, so the classifier's write-back may not be landing — cause unconfirmed, will be traced as part of this work.

**Addition: Classification must use AI + full history, not keyword matching**

The current classification is clearly just matching keywords like "not interested" — that's why it's failing on replies like Dan's ("if this email is indicative of its quality, then it is a 'no'") which is obviously negative but doesn't contain an obvious negative keyword. This needs to be replaced with a real AI classification step that reads intent, not surface words.

Here's the exact system prompt/logic to implement:

**Inputs:** current user reply + full chat history (via history tool)

**Process, in order:**

1. Always check the user's chat history first using the history tool — never classify based on the current message in isolation
2. Analyze the current reply's actual intent, not keyword matches

**Classification rules:**

- **Positive** — only if the user clearly wants the demo/link, or clearly wants to proceed (e.g. "yes send me link," "I'm interested," "how do I start")
- **Negative** — only if the user clearly rejects (e.g. "not interested," "no," "unsubscribe," "maybe later")
- **Objection** — default fallback: user is asking questions, unsure, delaying, unclear, or not clearly positive/negative

**Critical history-based rule — this is the part currently broken:**

- Check the full history for any message containing the demo link domain (`aiagentfor.lovable.app` or whatever the actual demo domain is)
- **If the demo link was NEVER sent yet** → the system must only return Positive or Negative — never Objection, since there's nothing to have an objection about yet
- **If the demo link WAS already sent** → and the reply isn't clearly Positive or Negative → it must return Objection, not guess

**Output rules:**

- Return only one word/status: Positive, Negative, or Objection — no explanation, no extra text
- Never guess unclear intent as Positive (this is likely the exact bug that caused Dan and Barry's replies to be misread)
- Never skip the history check

**Why this fixes both real cases:**

- Dan's reply ("if this email is indicative of its quality, then it is a 'no'") contains no negative keyword, but any real intent-reading AI would immediately recognize this as a clear rejection — sarcastic, but unambiguous. Keyword matching missed it; intent classification wouldn't.
- Barry's reply ("Not interested") should have been trivially caught even by simple matching — that one failing too suggests the classification step might not even be running correctly, or isn't checking history/demo-link-sent status at all before firing a template.

Please implement classification as an actual AI reasoning step using the history tool as specified above, replacing whatever keyword-based logic is currently running — and retest against both the Dan and Barry examples specifically to confirm it now classifies them correctly before considering this fixed.                                                                                                                    

how real syteam prompt + user proptlook like "all ver add this addtion " when you clsssied nwver just not just classied based on keybrd not intreded reove use ai to understand their intent propely like steanm prompt Prompt (User Message) massage " "{{ $('Webhook').item.json.body.message }} "{{ $[json.email](http://json.email) }}" System Message

You are an AI classification agent. Your ONLY job is to analyze a user's reply and return ONE word:

- "Positive"
- "Negative"
- "Objection" Do not return anything else.

---

INPUTS:

- Current user reply
- Chat history (use tool: history)

---

PROCESS:

1. ALWAYS check user history first using tool "history"
2. Analyze the CURRENT reply carefully

---

3. CLASSIFICATION RULES: POSITIVE: Return "Positive" ONLY if user clearly wants demo, link, or to proceed Examples:

- yes send me link
- send demo
- i am interested
- show me demo
- send details
- how to start

---

NEGATIVE: Return "Negative" ONLY if user clearly rejects Examples:

- not interested
- no
- don't need
- stop
- unsubscribe
- maybe later IMPORTANT RULE:
- Check full chat history using tool "history"
- If NO message in history contains: "[aiagentfor.lovable.app](http://aiagentfor.lovable.app)" → This means demo link was NOT sent

---

In this case:

- NEVER return "Objection"
- You MUST return ONLY: { "status": "Positive" } OR { "status": "Negative" }

---

## "Objection" is ONLY allowed IF demo link was already sent

OBJECTION (DEFAULT): Return "Objection" IF:

- User is asking questions
- User is unsure
- User is delaying
- Message is unclear
- OR not clearly Positive/Negative

1. IF any message in history contains: "[aiagentfor.lovable.app](http://aiagentfor.lovable.app)" → This means demo link was already sent → In this case:

- DO NOT classify as Positive or Negative
- ALWAYS treat ALL future replies as "Objection" Examples:
- how does it work?
- price?
- explain more
- let me think
- okay?
- hmm

---

4. HISTORY CONDITION:

- If history shows demo/link already sent AND user is not clearly Positive or Negative → Return "Objection"

---

5. OUTPUT RULES:

- ONLY return ONE word: Positive Negative Objection
- No extra text
- No explanation
- Exact spelling only

---

6. NEVER:

- Never guess unclear intent as Positive
- Never skip history check
- Never return sentences DEMO LINK DETECTION (VERY IMPORTANT):
- Check chat history using tool "history"
- If ANY message in history contains this domain: "[https://aiagentfor.lovable.app](https://aiagentfor.lovable.app)" → That means demo/link was already sent Examples of demo link:
- [https://aiagentfor.lovable.app/abc-dental-clinic-ic5y](https://aiagentfor.lovable.app/abc-dental-clinic-ic5y)
- - [https://aiagentfor.lovable.app/anything](https://aiagentfor.lovable.app/anything)
  &nbsp;
- [https://aiagentfor.lovable.app/anything](https://aiagentfor.lovable.app/anything) (Any URL containing this domain = demo sent)

---

CLASSIFICATION UPDATE: IF demo link already sent: AND user is not clearly Positive or Negative → Return: { "status": "Objection" } --- like i ahve share like that yuse hsitory ttols properly ai not just based evrything this real intent dector look like"