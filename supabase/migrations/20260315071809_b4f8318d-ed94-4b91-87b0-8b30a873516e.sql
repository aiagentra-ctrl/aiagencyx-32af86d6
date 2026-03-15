
ALTER TABLE public.demo_pages
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS hero_title text,
  ADD COLUMN IF NOT EXISTS hero_subtitle text,
  ADD COLUMN IF NOT EXISTS calendly_url text,
  ADD COLUMN IF NOT EXISTS cta_text text DEFAULT 'Book a Call',
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS custom_subdomain text,
  ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS benefits jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS social_proof jsonb DEFAULT '[]'::jsonb;
