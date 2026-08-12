CREATE TABLE public.demo_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  email text,
  business_name text,
  website_url text,
  status text NOT NULL DEFAULT 'pending',
  attempt integer NOT NULL DEFAULT 1,
  last_error text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_jobs TO authenticated;
GRANT ALL ON public.demo_jobs TO service_role;
ALTER TABLE public.demo_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage demo_jobs" ON public.demo_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service manage demo_jobs" ON public.demo_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.demo_job_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.demo_jobs(id) ON DELETE CASCADE,
  step text NOT NULL,
  step_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  output jsonb,
  error text,
  duration_ms integer,
  attempt integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, step)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_job_steps TO authenticated;
GRANT ALL ON public.demo_job_steps TO service_role;
ALTER TABLE public.demo_job_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage demo_job_steps" ON public.demo_job_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service manage demo_job_steps" ON public.demo_job_steps FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_demo_jobs_status ON public.demo_jobs (status, created_at DESC);
CREATE INDEX idx_demo_job_steps_job ON public.demo_job_steps (job_id, step_order);

CREATE TRIGGER trg_demo_jobs_touch BEFORE UPDATE ON public.demo_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();
CREATE TRIGGER trg_demo_job_steps_touch BEFORE UPDATE ON public.demo_job_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();