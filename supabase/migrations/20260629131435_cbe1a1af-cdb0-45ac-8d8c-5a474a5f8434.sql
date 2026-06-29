
-- 1. webhook_logs
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  method text DEFAULT 'POST',
  status text NOT NULL CHECK (status IN ('success','failed')),
  status_code integer,
  response_ms integer,
  payload jsonb,
  response jsonb,
  error text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webhook_logs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wl_read_auth" ON public.webhook_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "wl_service_all" ON public.webhook_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX webhook_logs_created_idx ON public.webhook_logs (created_at DESC);

-- 2. pipeline_events
CREATE TABLE public.pipeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.inbox_messages(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE CASCADE,
  step text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','skipped','failed')),
  details jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pipeline_events TO authenticated;
GRANT ALL ON public.pipeline_events TO service_role;
ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pe_read_auth" ON public.pipeline_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "pe_service_all" ON public.pipeline_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX pipeline_events_msg_idx ON public.pipeline_events (message_id, created_at);
CREATE INDEX pipeline_events_prospect_idx ON public.pipeline_events (prospect_id, created_at);

-- 3. error_events
CREATE TABLE public.error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  message_id uuid,
  prospect_id uuid,
  message text NOT NULL,
  stack text,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.error_events TO authenticated;
GRANT ALL ON public.error_events TO service_role;
ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ee_read_auth" ON public.error_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "ee_ack_auth" ON public.error_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ee_service_all" ON public.error_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX error_events_created_idx ON public.error_events (created_at DESC);

-- 4. reply_templates
CREATE TABLE public.reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification text NOT NULL,
  phase text NOT NULL DEFAULT 'pre_demo' CHECK (phase IN ('pre_demo','post_demo')),
  body text NOT NULL,
  locked_vars text[] NOT NULL DEFAULT ARRAY['demo_url']::text[],
  is_default boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classification, phase)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reply_templates TO authenticated;
GRANT ALL ON public.reply_templates TO service_role;
ALTER TABLE public.reply_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rt_read_auth" ON public.reply_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "rt_write_auth" ON public.reply_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rt_service_all" ON public.reply_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER rt_touch BEFORE UPDATE ON public.reply_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_inbox();

-- Seed templates (6 slots)
INSERT INTO public.reply_templates (classification, phase, body, locked_vars) VALUES
('Positive','pre_demo',
'Hi {{firstname}},

Thanks for the quick reply! I built a quick demo for {{company}} so you can see exactly how this would work for your team:

{{demo_url}}

Let me know what you think — happy to jump on a quick call if useful.

Best,
{{sender_name}}',
ARRAY['demo_url','firstname','company','sender_name']),
('Negative','pre_demo',
'Hi {{firstname}},

Totally understand. In case it''s useful later, I put together a 60-second demo for {{company}}:

{{demo_url}}

No pressure — feel free to ignore. Wishing you the best.

{{sender_name}}',
ARRAY['demo_url','firstname','company','sender_name']),
('Objection','pre_demo',
'Hi {{firstname}},

Great question. Here''s a quick demo tailored to {{company}} that should answer most of it:

{{demo_url}}

Happy to clarify anything specific — just reply here.

{{sender_name}}',
ARRAY['demo_url','firstname','company','sender_name']),
('Positive','post_demo',
'Hi {{firstname}},

Awesome — glad it resonated! What''s the best time this week for a 15-min call to walk through next steps for {{company}}?

{{sender_name}}',
ARRAY['firstname','company','sender_name']),
('Negative','post_demo',
'Got it, {{firstname}} — appreciate you taking a look. I''ll close the loop here. If anything changes down the road, you know where to find me.

{{sender_name}}',
ARRAY['firstname','sender_name']),
('Objection','post_demo',
'Hi {{firstname}},

Good question — let me address that directly: [the AI will fill this in based on their specific concern].

Happy to keep going as deep as you want.

{{sender_name}}',
ARRAY['firstname','sender_name']);

-- 5. prospects: add demo_sent_at convenience timestamp
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS demo_sent_at timestamptz;

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.error_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reply_templates;
