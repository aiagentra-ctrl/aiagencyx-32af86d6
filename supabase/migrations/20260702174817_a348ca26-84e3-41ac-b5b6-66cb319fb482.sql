
-- =========================================================
-- Phase 1: AI Memory + Intelligence layer
-- =========================================================

-- prospect_memory: per-lead AI brain
CREATE TABLE IF NOT EXISTS public.prospect_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL UNIQUE REFERENCES public.prospects(id) ON DELETE CASCADE,
  demo_link_sent boolean NOT NULL DEFAULT false,
  demo_link_sent_at timestamptz,
  demo_link_sent_in_message_id uuid,
  reply_times jsonb NOT NULL DEFAULT '[]'::jsonb,
  optimal_send_window jsonb NOT NULL DEFAULT '{}'::jsonb,
  conversation_stage text NOT NULL DEFAULT 'pre_demo',
  total_replies_received int NOT NULL DEFAULT 0,
  last_reply_at timestamptz,
  classification_history text[] NOT NULL DEFAULT '{}',
  demo_behavior jsonb NOT NULL DEFAULT '{}'::jsonb,
  sequence_memory jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_memory TO authenticated;
GRANT ALL ON public.prospect_memory TO service_role;
ALTER TABLE public.prospect_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read prospect_memory" ON public.prospect_memory FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write prospect_memory" ON public.prospect_memory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_prospect_memory_prospect ON public.prospect_memory(prospect_id);
CREATE TRIGGER trg_prospect_memory_updated BEFORE UPDATE ON public.prospect_memory
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- node_prompts: editable AI system prompts
CREATE TABLE IF NOT EXISTS public.node_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_name text NOT NULL UNIQUE,
  system_prompt text NOT NULL,
  user_prompt_template text,
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.node_prompts TO authenticated;
GRANT ALL ON public.node_prompts TO service_role;
ALTER TABLE public.node_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read node_prompts" ON public.node_prompts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write node_prompts" ON public.node_prompts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_node_prompts_updated BEFORE UPDATE ON public.node_prompts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  actor text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

-- unsubscribed_prospects
CREATE TABLE IF NOT EXISTS public.unsubscribed_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid UNIQUE REFERENCES public.prospects(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  reason text,
  unsubscribed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unsubscribed_prospects TO authenticated;
GRANT ALL ON public.unsubscribed_prospects TO service_role;
ALTER TABLE public.unsubscribed_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage unsubs" ON public.unsubscribed_prospects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sequence_analytics_cache
CREATE TABLE IF NOT EXISTS public.sequence_analytics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_template_id uuid NOT NULL UNIQUE REFERENCES public.follow_up_sequences_templates(id) ON DELETE CASCADE,
  total_enrolled int NOT NULL DEFAULT 0,
  total_active int NOT NULL DEFAULT 0,
  total_completed int NOT NULL DEFAULT 0,
  total_responded int NOT NULL DEFAULT 0,
  response_rate float NOT NULL DEFAULT 0,
  avg_step_to_reply float,
  step_funnel_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  reply_quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  variant_a_stats jsonb,
  variant_b_stats jsonb,
  last_computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sequence_analytics_cache TO authenticated;
GRANT ALL ON public.sequence_analytics_cache TO service_role;
ALTER TABLE public.sequence_analytics_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage analytics cache" ON public.sequence_analytics_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ab_test_results
CREATE TABLE IF NOT EXISTS public.ab_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_template_id uuid NOT NULL REFERENCES public.follow_up_sequences_templates(id) ON DELETE CASCADE,
  variant text NOT NULL,
  enrollments int NOT NULL DEFAULT 0,
  responses int NOT NULL DEFAULT 0,
  response_rate float NOT NULL DEFAULT 0,
  winner_declared boolean NOT NULL DEFAULT false,
  winner_variant text,
  declared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ab_test_results TO authenticated;
GRANT ALL ON public.ab_test_results TO service_role;
ALTER TABLE public.ab_test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage ab_test" ON public.ab_test_results FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed node_prompts (idempotent)
INSERT INTO public.node_prompts (node_name, system_prompt) VALUES
  ('classify', 'You are a strict email intent classifier. Read the incoming reply and return ONLY one word: Positive, Negative, or Objection. Positive = interested, wants to talk, wants demo, asking about pricing/next steps. Negative = not interested, unsubscribe, wrong person, stop contacting. Objection = interested-but-hesitant, has concerns, asks skeptical questions, needs more info. Output only the single word.'),
  ('positive_reply', 'You are an AI sales assistant. Your goal is to reply to a POSITIVE response to a cold outbound email. Be warm, concise, and move the conversation toward a concrete next step (call, demo, or specific question). Do not repeat the demo link if it was already sent. Sign off with the sender name. Keep under 90 words.'),
  ('negative_reply', 'You are an AI sales assistant. Your goal is to reply gracefully to a NEGATIVE response. Acknowledge, thank them, offer to stay in touch if timing changes. No pressure. Under 50 words. Sign off with the sender name.'),
  ('objection_reply', 'You are an AI sales assistant. Your goal is to reply to an OBJECTION. Acknowledge the concern specifically, address it briefly with evidence or reframing, and invite a short conversation to explore fit. Do not oversell. Under 90 words. Sign off with the sender name.'),
  ('followup_no_click', 'Write a short, friendly follow-up to a prospect who received a demo link but has not clicked it. Reference the value in one sentence, ask if the timing is off, and invite a reply. Under 70 words.'),
  ('followup_clicked_no_open', 'Write a follow-up to a prospect who clicked the demo link but did not open the demo page. Ask if something went wrong loading the page, offer a quick alternative (screenshare or short call). Under 70 words.'),
  ('followup_opened_no_try', 'Write a follow-up to a prospect who opened the demo page but did not try the voice agent or chatbot. Nudge them to try the interactive demo (30 seconds), highlight one specific capability. Under 70 words.'),
  ('followup_tried_voice', 'Write a follow-up to a prospect who tried the voice agent only. Ask what they thought, invite them to try the chatbot too, and offer a short call. Under 70 words.'),
  ('followup_tried_chat', 'Write a follow-up to a prospect who tried the chatbot only. Ask what they thought, invite them to try the voice agent, offer a call. Under 70 words.'),
  ('followup_full_engage', 'Write a follow-up to a prospect who fully engaged (link clicked, page opened, tried both voice and chatbot) but has not replied. They are warm. Ask a direct question about fit, propose a specific time for a 15-min call. Under 80 words.')
ON CONFLICT (node_name) DO NOTHING;
