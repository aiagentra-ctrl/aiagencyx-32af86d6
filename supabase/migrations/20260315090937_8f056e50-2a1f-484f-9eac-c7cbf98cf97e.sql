
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site_settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert site_settings" ON public.site_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update site_settings" ON public.site_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access site_settings" ON public.site_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed default settings
INSERT INTO public.site_settings (key, value) VALUES 
  ('calendar_url', ''),
  ('default_cta_text', 'Book a Call'),
  ('site_name', 'AI Agency');
