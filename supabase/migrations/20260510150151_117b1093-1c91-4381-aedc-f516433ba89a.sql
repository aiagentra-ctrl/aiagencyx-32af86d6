
CREATE TABLE IF NOT EXISTS public.demo_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  demo_page_id uuid,
  slug text NOT NULL,
  first_name text,
  company text,
  campaign_name text,
  industry text,
  campaign_id text,
  lead_source text,
  sender_email text,
  message_thread_id text,
  cc_emails jsonb DEFAULT '[]'::jsonb,
  bcc_emails jsonb DEFAULT '[]'::jsonb,
  is_complete boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  lead_score integer NOT NULL DEFAULT 0,
  score_tier text DEFAULT 'low',
  country_code text,
  visitor_session_id text,
  demo_tried boolean NOT NULL DEFAULT false,
  demo_type_tried text,
  last_visit_at timestamptz,
  follow_up_sent_at timestamptz,
  follow_up_message_id text,
  engagement jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_demo_leads_slug ON public.demo_leads(slug);
CREATE INDEX IF NOT EXISTS idx_demo_leads_status ON public.demo_leads(status);

ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on demo_leads"
  ON public.demo_leads FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.manyreach_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  lead_id uuid,
  slug text,
  campaign_id text,
  thread_id text,
  status text NOT NULL,
  lead_score integer,
  request_payload jsonb,
  response_payload jsonb,
  error_message text
);
CREATE INDEX IF NOT EXISTS idx_manyreach_logs_lead ON public.manyreach_logs(lead_id);

ALTER TABLE public.manyreach_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on manyreach_logs"
  ON public.manyreach_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_demo_leads_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_demo_leads_updated_at ON public.demo_leads;
CREATE TRIGGER trg_demo_leads_updated_at
  BEFORE UPDATE ON public.demo_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_demo_leads_updated_at();

INSERT INTO public.site_settings (key, value)
VALUES
  ('country_allowlist', 'US,CA,GB,AU,AE,DE,FR,NL,SE,NO,DK,FI,IE,ES,IT,BE,CH,AT,NZ,SG'),
  ('country_blocklist', 'NP,IN,BD,PK,LK,MM')
ON CONFLICT DO NOTHING;
