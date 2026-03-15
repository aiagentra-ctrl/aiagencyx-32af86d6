
-- API provider configurations
CREATE TABLE public.api_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'openai',
  api_key text NOT NULL,
  endpoint_url text,
  model text,
  priority integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  category text NOT NULL DEFAULT 'llm',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Activity/debug logs
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Full access on api_providers" ON public.api_providers FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Full access on activity_logs" ON public.activity_logs FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
