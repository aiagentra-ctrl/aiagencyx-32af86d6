
-- ============ Prospect activity times (for smart send + heatmap) ============
CREATE TABLE IF NOT EXISTS public.prospect_activity_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  hour_of_day smallint NOT NULL,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pat_prospect ON public.prospect_activity_times(prospect_id);
CREATE INDEX IF NOT EXISTS idx_pat_event ON public.prospect_activity_times(event_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_activity_times TO authenticated;
GRANT ALL ON public.prospect_activity_times TO service_role;
ALTER TABLE public.prospect_activity_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pat" ON public.prospect_activity_times FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write pat" ON public.prospect_activity_times FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ Demo open log (hot lead counting) ============
CREATE TABLE IF NOT EXISTS public.demo_open_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  demo_id uuid,
  opened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dol_prospect_time ON public.demo_open_log(prospect_id, opened_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_open_log TO authenticated;
GRANT ALL ON public.demo_open_log TO service_role;
ALTER TABLE public.demo_open_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read dol" ON public.demo_open_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write dol" ON public.demo_open_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ Notifications ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE CASCADE,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON public.notifications(read, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read notif" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write notif" ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============ Variable fallbacks ============
CREATE TABLE IF NOT EXISTS public.variable_fallbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_key text NOT NULL UNIQUE,
  fallback_value text NOT NULL DEFAULT '',
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.variable_fallbacks TO authenticated;
GRANT ALL ON public.variable_fallbacks TO service_role;
ALTER TABLE public.variable_fallbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read vf" ON public.variable_fallbacks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write vf" ON public.variable_fallbacks FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.variable_fallbacks (variable_key, fallback_value, description) VALUES
  ('firstname','there','Prospect first name'),
  ('lastname','','Prospect last name'),
  ('company','your team','Prospect company'),
  ('website','','Prospect website'),
  ('demo_url','','Personalized demo URL'),
  ('sender_name','the team','Your sender first name'),
  ('sender_email','','Sender email address'),
  ('campaign_name','our outreach','Campaign name'),
  ('days_since_demo','a few days','Days since demo sent'),
  ('days_since_click','recently','Days since prospect clicked'),
  ('days_since_open','recently','Days since prospect opened')
ON CONFLICT (variable_key) DO NOTHING;

-- ============ Prospects hot-lead columns ============
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS is_hot_lead boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hot_lead_detected_at timestamptz,
  ADD COLUMN IF NOT EXISTS hot_lead_open_count int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_prospects_hot ON public.prospects(is_hot_lead, hot_lead_detected_at DESC);

-- ============ Enrollments extra columns ============
ALTER TABLE public.follow_up_enrollments
  ADD COLUMN IF NOT EXISTS assigned_variant text NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_classification text,
  ADD COLUMN IF NOT EXISTS best_send_hour smallint,
  ADD COLUMN IF NOT EXISTS best_send_day smallint;

-- ============ Templates + steps A/B ============
ALTER TABLE public.follow_up_sequences_templates
  ADD COLUMN IF NOT EXISTS ab_test_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.follow_up_steps
  ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'A';

-- ============ Best send time helper ============
CREATE OR REPLACE FUNCTION public.get_best_send_time(p_prospect_id uuid)
RETURNS TABLE(best_day smallint, best_hour smallint, data_points bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH counted AS (
    SELECT day_of_week, hour_of_day, COUNT(*) AS cnt
    FROM public.prospect_activity_times
    WHERE prospect_id = p_prospect_id
    GROUP BY day_of_week, hour_of_day
  ), total AS (
    SELECT COALESCE(SUM(cnt),0) AS total_pts FROM counted
  )
  SELECT c.day_of_week, c.hour_of_day, t.total_pts
  FROM counted c CROSS JOIN total t
  ORDER BY c.cnt DESC
  LIMIT 1;
$$;
