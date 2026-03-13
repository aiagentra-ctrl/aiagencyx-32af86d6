-- Create demo_pages table
CREATE TABLE public.demo_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  assistant_id TEXT NOT NULL,
  business_name TEXT NOT NULL,
  description TEXT,
  vapi_key TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demo_pages ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read demo pages"
  ON public.demo_pages
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated write access
CREATE POLICY "Authenticated users can insert demo pages"
  ON public.demo_pages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow public update for view count increment
CREATE POLICY "Anyone can update views"
  ON public.demo_pages
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Service role full access (for edge functions)
CREATE POLICY "Service role full access"
  ON public.demo_pages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);