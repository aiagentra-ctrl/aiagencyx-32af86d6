CREATE TABLE public.webhook_endpoints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  token text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'manyreach',
  active boolean NOT NULL DEFAULT true,
  hit_count integer NOT NULL DEFAULT 0,
  last_used_at timestamp with time zone,
  last_status integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.webhook_endpoints TO service_role;

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages webhook endpoints"
ON public.webhook_endpoints FOR ALL
USING (false) WITH CHECK (false);

CREATE INDEX idx_webhook_endpoints_token ON public.webhook_endpoints (token);

CREATE TRIGGER trg_webhook_endpoints_updated_at
BEFORE UPDATE ON public.webhook_endpoints
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

INSERT INTO public.webhook_endpoints (label, token, provider)
VALUES ('ManyReach — Reply', 'wh_' || encode(gen_random_bytes(9), 'hex'), 'manyreach');