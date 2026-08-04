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
