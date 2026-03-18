CREATE TABLE public.scraped_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_url text NOT NULL UNIQUE,
  raw_content text,
  structured_data jsonb DEFAULT '{}'::jsonb,
  logo_url text,
  scraped_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days')
);
ALTER TABLE public.scraped_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.scraped_data FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public read" ON public.scraped_data FOR SELECT TO anon, authenticated USING (true);