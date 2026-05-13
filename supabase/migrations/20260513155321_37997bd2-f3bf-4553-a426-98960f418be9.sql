
-- Extend demo_leads with new tracking columns
ALTER TABLE public.demo_leads
  ADD COLUMN IF NOT EXISTS fingerprint text,
  ADD COLUMN IF NOT EXISTS tried_voice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tried_chat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_first_at timestamptz,
  ADD COLUMN IF NOT EXISTS chat_first_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_case1_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_case2_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_link_clicked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_link_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_link_visit_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_demo_leads_fingerprint ON public.demo_leads(fingerprint);

-- Email queue
CREATE TABLE IF NOT EXISTS public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('case1','case2')),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled','failed')),
  cancelled_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled
  ON public.email_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_lead ON public.email_queue(lead_id);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read email_queue" ON public.email_queue
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can update email_queue" ON public.email_queue
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full email_queue" ON public.email_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Followup settings (key/value)
CREATE TABLE IF NOT EXISTS public.followup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone read followup_settings" ON public.followup_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone update followup_settings" ON public.followup_settings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone insert followup_settings" ON public.followup_settings
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Service role full followup_settings" ON public.followup_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.followup_settings (key, value) VALUES
  ('case1_delay_hours','24'),
  ('case2_delay_hours','1'),
  ('from_name','AI Agent'),
  ('from_email','')
ON CONFLICT (key) DO NOTHING;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.demo_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_queue;
