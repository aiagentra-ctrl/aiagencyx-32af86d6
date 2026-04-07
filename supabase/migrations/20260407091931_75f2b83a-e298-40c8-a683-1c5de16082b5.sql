
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  business_name text NOT NULL,
  status text NOT NULL DEFAULT 'needs_follow_up',
  follow_up_count integer NOT NULL DEFAULT 0,
  last_follow_up_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Full access on leads" ON public.leads FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE public.lead_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  stage text NOT NULL DEFAULT 'reminder',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Full access on lead_follow_ups" ON public.lead_follow_ups FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_leads_updated_at();

CREATE UNIQUE INDEX idx_leads_slug ON public.leads(slug);
