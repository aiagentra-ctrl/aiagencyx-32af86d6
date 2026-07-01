
-- 1) Extend prospects
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS original_message_id text,
  ADD COLUMN IF NOT EXISTS demo_link_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS demo_page_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS voice_tried_at timestamptz,
  ADD COLUMN IF NOT EXISTS chatbot_tried_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_followup_attempts int NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS followup_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_followup_trigger text;

-- 2) followup_rules
CREATE TABLE IF NOT EXISTS public.followup_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key text UNIQUE NOT NULL,
  label text NOT NULL,
  delay_hours int NOT NULL DEFAULT 24,
  enabled boolean NOT NULL DEFAULT true,
  auto_send boolean NOT NULL DEFAULT false,
  prompt_override text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_rules TO authenticated;
GRANT ALL ON public.followup_rules TO service_role;
ALTER TABLE public.followup_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read followup_rules" ON public.followup_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write followup_rules" ON public.followup_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.followup_rules (trigger_key, label, delay_hours) VALUES
  ('no_click_48h','No click on demo link',48),
  ('clicked_no_open','Clicked but did not open page',24),
  ('opened_no_try','Opened page but did not try agent',24),
  ('tried_voice_only','Tried voice only',48),
  ('tried_chat_only','Tried chat only',48),
  ('tried_both_no_reply','Tried both, no reply',72)
ON CONFLICT (trigger_key) DO NOTHING;

-- 3) followup_events (queue + audit)
CREATE TABLE IF NOT EXISTS public.followup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  trigger_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|sent|skipped|failed|responded|cancelled
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  message_subject text,
  message_body text,
  manyreach_message_id text,
  error text,
  attempt int NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'rule', -- rule|sequence|manual
  sequence_enrollment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS followup_events_prospect_idx ON public.followup_events(prospect_id);
CREATE INDEX IF NOT EXISTS followup_events_status_scheduled_idx ON public.followup_events(status, scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_events TO authenticated;
GRANT ALL ON public.followup_events TO service_role;
ALTER TABLE public.followup_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read followup_events" ON public.followup_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write followup_events" ON public.followup_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) Sequence templates
CREATE TABLE IF NOT EXISTS public.follow_up_sequences_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'custom',
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_up_sequences_templates TO authenticated;
GRANT ALL ON public.follow_up_sequences_templates TO service_role;
ALTER TABLE public.follow_up_sequences_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sequences" ON public.follow_up_sequences_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write sequences" ON public.follow_up_sequences_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5) Sequence steps
CREATE TABLE IF NOT EXISTS public.follow_up_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_template_id uuid NOT NULL REFERENCES public.follow_up_sequences_templates(id) ON DELETE CASCADE,
  step_number int NOT NULL,
  delay_value int NOT NULL DEFAULT 2,
  delay_unit text NOT NULL DEFAULT 'days', -- hours|days|weeks
  message_subject text NOT NULL DEFAULT 'Re: {{firstname}} overview',
  message_body text NOT NULL DEFAULT '',
  include_demo_link boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_template_id, step_number)
);
CREATE INDEX IF NOT EXISTS follow_up_steps_seq_idx ON public.follow_up_steps(sequence_template_id, step_number);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_up_steps TO authenticated;
GRANT ALL ON public.follow_up_steps TO service_role;
ALTER TABLE public.follow_up_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sequence steps" ON public.follow_up_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write sequence steps" ON public.follow_up_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6) Enrollments
CREATE TABLE IF NOT EXISTS public.follow_up_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  sequence_template_id uuid NOT NULL REFERENCES public.follow_up_sequences_templates(id) ON DELETE CASCADE,
  current_step int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active', -- active|completed|cancelled|responded|failed|paused
  started_at timestamptz NOT NULL DEFAULT now(),
  next_step_at timestamptz,
  completed_at timestamptz,
  retry_count int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enrollments_next_idx ON public.follow_up_enrollments(status, next_step_at);
CREATE INDEX IF NOT EXISTS enrollments_prospect_idx ON public.follow_up_enrollments(prospect_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_up_enrollments TO authenticated;
GRANT ALL ON public.follow_up_enrollments TO service_role;
ALTER TABLE public.follow_up_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read enrollments" ON public.follow_up_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write enrollments" ON public.follow_up_enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7) updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at_generic()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_followup_rules ON public.followup_rules;
CREATE TRIGGER trg_touch_followup_rules BEFORE UPDATE ON public.followup_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS trg_touch_followup_events ON public.followup_events;
CREATE TRIGGER trg_touch_followup_events BEFORE UPDATE ON public.followup_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS trg_touch_sequences ON public.follow_up_sequences_templates;
CREATE TRIGGER trg_touch_sequences BEFORE UPDATE ON public.follow_up_sequences_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS trg_touch_steps ON public.follow_up_steps;
CREATE TRIGGER trg_touch_steps BEFORE UPDATE ON public.follow_up_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS trg_touch_enrollments ON public.follow_up_enrollments;
CREATE TRIGGER trg_touch_enrollments BEFORE UPDATE ON public.follow_up_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();
