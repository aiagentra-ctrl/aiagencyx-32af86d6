CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value text,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_config TO authenticated;
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read app_config" ON public.app_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage app_config" ON public.app_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access app_config" ON public.app_config FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_app_config_touch BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

INSERT INTO public.app_config (key, value, description) VALUES
  ('site_url', 'https://aiagencyx.lovable.app', 'Canonical Lovable domain used to build demo links'),
  ('timezone_name', 'America/Chicago', 'IANA timezone used for scheduling'),
  ('timezone_city', 'Nashville', 'City spoken by the agent when anchoring times'),
  ('transfer_hours_start', '9:00 AM', 'Start of live transfer window'),
  ('transfer_hours_end', '6:00 PM', 'End of live transfer window'),
  ('transfer_days', 'Monday through Friday', 'Days live transfer is available'),
  ('destination_team_name', 'the office team', 'How the agent refers to the human team'),
  ('max_slots_offered', '2', 'Max appointment options offered at once'),
  ('min_lead_days', '2', 'Minimum days out for a normal appointment'),
  ('far_distance_min_days', '7', 'Minimum days out for isolated far-distance jobs'),
  ('saturday_min_days', '14', 'Minimum days out for a Saturday slot'),
  ('sunday_available', 'false', 'Whether Sunday can ever be booked'),
  ('calendar_id', 'primary', 'Google Calendar used for estimate appointments'),
  ('office_email', '', 'Inbox that receives office notes')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE public.agent_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text UNIQUE NOT NULL,
  chatbot_id uuid,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  email text,
  street_address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip text NOT NULL,
  project_detail text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  slot_label text,
  market text,
  estimator text,
  timezone text,
  calendar_id text,
  calendar_event_id text,
  mode text NOT NULL DEFAULT 'demo',
  email_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_appointments TO authenticated;
GRANT ALL ON public.agent_appointments TO service_role;
ALTER TABLE public.agent_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage appointments" ON public.agent_appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access appointments" ON public.agent_appointments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.agent_office_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid,
  first_name text,
  last_name text,
  phone text,
  email text,
  address text,
  project_detail text,
  reason text,
  next_step text,
  body text,
  delivered boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'demo',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_office_notes TO authenticated;
GRANT ALL ON public.agent_office_notes TO service_role;
ALTER TABLE public.agent_office_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage office notes" ON public.agent_office_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access office notes" ON public.agent_office_notes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.agent_unbooked_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text UNIQUE NOT NULL,
  chatbot_id uuid,
  first_name text,
  last_name text,
  phone text,
  email text,
  address text,
  project_detail text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_unbooked_leads TO authenticated;
GRANT ALL ON public.agent_unbooked_leads TO service_role;
ALTER TABLE public.agent_unbooked_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage unbooked leads" ON public.agent_unbooked_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access unbooked leads" ON public.agent_unbooked_leads FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.agent_tool_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool text NOT NULL,
  mode text NOT NULL DEFAULT 'demo',
  chatbot_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_tool_events TO authenticated;
GRANT ALL ON public.agent_tool_events TO service_role;
ALTER TABLE public.agent_tool_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read tool events" ON public.agent_tool_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access tool events" ON public.agent_tool_events FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.chatbots
  ADD COLUMN IF NOT EXISTS matched_industry text,
  ADD COLUMN IF NOT EXISTS match_confidence text,
  ADD COLUMN IF NOT EXISTS template_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;