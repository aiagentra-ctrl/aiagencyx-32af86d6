
-- PROSPECTS
CREATE TABLE public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  firstname text,
  company text,
  website_url text,
  campaign_id text,
  campaign_name text,
  sender_email text,
  reply_to_email text,
  automation_paused boolean NOT NULL DEFAULT false,
  last_message_at timestamptz,
  last_classification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO authenticated;
GRANT ALL ON public.prospects TO service_role;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read prospects" ON public.prospects FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write prospects" ON public.prospects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- INBOX MESSAGES
CREATE TABLE public.inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  manyreach_message_id text,
  direction text NOT NULL CHECK (direction IN ('incoming','outgoing')),
  source text NOT NULL DEFAULT 'email',
  subject text,
  body text NOT NULL,
  classification text CHECK (classification IN ('Positive','Negative','Objection')),
  classified_by text CHECK (classified_by IN ('ai','human')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inbox_messages_prospect ON public.inbox_messages(prospect_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_messages TO authenticated;
GRANT ALL ON public.inbox_messages TO service_role;
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read inbox_messages" ON public.inbox_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write inbox_messages" ON public.inbox_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- INBOX DEMOS
CREATE TABLE public.inbox_demos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  demo_url text NOT NULL,
  business_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inbox_demos_prospect ON public.inbox_demos(prospect_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_demos TO authenticated;
GRANT ALL ON public.inbox_demos TO service_role;
ALTER TABLE public.inbox_demos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read inbox_demos" ON public.inbox_demos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write inbox_demos" ON public.inbox_demos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- INBOX PROMPTS (editable templates)
CREATE TABLE public.inbox_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification text NOT NULL UNIQUE CHECK (classification IN ('Positive','Negative','Objection','Classifier')),
  system_prompt text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_prompts TO authenticated;
GRANT ALL ON public.inbox_prompts TO service_role;
ALTER TABLE public.inbox_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read inbox_prompts" ON public.inbox_prompts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write inbox_prompts" ON public.inbox_prompts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at triggers (reuse existing function if present)
CREATE OR REPLACE FUNCTION public.touch_updated_at_inbox()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_prospects_updated BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_inbox();
CREATE TRIGGER trg_inbox_prompts_updated BEFORE UPDATE ON public.inbox_prompts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_inbox();

-- Seed prompts
INSERT INTO public.inbox_prompts (classification, system_prompt) VALUES
('Classifier', 'You are an intent classifier for B2B cold-email replies. Read the full thread, then the latest incoming message, and return EXACTLY one word: "Positive", "Negative", or "Objection".

- Positive: shows interest, asks for more info, wants to see/try the demo, agrees to a call, asks pricing in a positive tone, or says "yes/sure/interested/send it".
- Negative: clear rejection, unsubscribe, "not interested", "stop emailing", hostility, or wrong contact.
- Objection: not a clear yes or no — has a question, concern, hesitation, asks about price/timing/fit, needs more info before deciding, or says "maybe later".

Output ONLY the single word. No punctuation, no explanation.'),
('Positive', 'You are an SDR replying to a positive prospect. Tone: friendly, concise, confident. Use their firstname. If a demo_url is provided, include it naturally with a short line like "Here''s a live demo built for {company}: {demo_url}". Ask one soft next-step question (a quick call or their reaction to the demo). Keep it under 90 words. No subject line, body only. No markdown.'),
('Negative', 'You are an SDR replying to a negative prospect. Tone: polite, brief, no pressure. Thank them, acknowledge, offer to remove them from the list, and leave the door open ("if anything changes, I''m here"). Under 50 words. No demo link. Body only, no markdown.'),
('Objection', 'You are an SDR replying to a prospect who has a question, concern, or hesitation. Tone: helpful, non-pushy, consultative. Address their specific objection directly and briefly. If a demo_url is provided, you MAY include it once if it helps answer their question, but do not push. End with a soft, low-friction next step (e.g. "happy to answer anything else"). Under 100 words. Body only, no markdown.');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prospects;
