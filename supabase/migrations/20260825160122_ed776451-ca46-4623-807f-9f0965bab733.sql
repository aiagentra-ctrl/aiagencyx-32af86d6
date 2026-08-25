CREATE TABLE public.manyreach_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_key text,
  use_env_key boolean NOT NULL DEFAULT false,
  webhook_secret text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.manyreach_mailboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT '',
  email text NOT NULL,
  manyreach_account_id uuid REFERENCES public.manyreach_accounts(id) ON DELETE SET NULL,
  uses_default_account boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX manyreach_mailboxes_email_key ON public.manyreach_mailboxes (lower(email));
CREATE UNIQUE INDEX manyreach_accounts_one_default ON public.manyreach_accounts (is_default) WHERE is_default;

GRANT ALL ON public.manyreach_accounts TO service_role;
GRANT ALL ON public.manyreach_mailboxes TO service_role;

ALTER TABLE public.manyreach_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manyreach_mailboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages manyreach accounts" ON public.manyreach_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service role manages manyreach mailboxes" ON public.manyreach_mailboxes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_manyreach_accounts_touch BEFORE UPDATE ON public.manyreach_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();
CREATE TRIGGER trg_manyreach_mailboxes_touch BEFORE UPDATE ON public.manyreach_mailboxes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

INSERT INTO public.manyreach_accounts (name, use_env_key, notes, active, is_default)
VALUES ('Account 1 (legacy env key)', true, 'Uses the MANYREACH_API_KEY environment secret.', true, true);