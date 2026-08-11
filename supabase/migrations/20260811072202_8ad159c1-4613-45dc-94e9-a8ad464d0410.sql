CREATE TABLE public.webhook_dedupe (
  message_key text PRIMARY KEY,
  prospect_id uuid,
  inbox_message_id uuid,
  seen_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.webhook_dedupe TO service_role;
ALTER TABLE public.webhook_dedupe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only dedupe" ON public.webhook_dedupe FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE public.pipeline_locks (
  lock_key text PRIMARY KEY,
  holder text,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 minutes')
);
GRANT ALL ON public.pipeline_locks TO service_role;
ALTER TABLE public.pipeline_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only locks" ON public.pipeline_locks FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.try_acquire_pipeline_lock(p_key text, p_holder text, p_ttl_seconds integer DEFAULT 180)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ok boolean;
BEGIN
  DELETE FROM public.pipeline_locks WHERE expires_at < now();
  INSERT INTO public.pipeline_locks (lock_key, holder, acquired_at, expires_at)
  VALUES (p_key, p_holder, now(), now() + make_interval(secs => p_ttl_seconds))
  ON CONFLICT (lock_key) DO NOTHING;
  SELECT EXISTS (SELECT 1 FROM public.pipeline_locks WHERE lock_key = p_key AND holder = p_holder) INTO v_ok;
  RETURN v_ok;
END $$;

CREATE OR REPLACE FUNCTION public.release_pipeline_lock(p_key text, p_holder text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ DELETE FROM public.pipeline_locks WHERE lock_key = p_key AND holder = p_holder; $$;