CREATE TABLE public.link_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_page_id uuid REFERENCES public.demo_pages(id) ON DELETE CASCADE,
  chatbot_id uuid REFERENCES public.chatbots(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  slug text NOT NULL,
  link_type text NOT NULL DEFAULT 'demo',
  event_type text NOT NULL,
  session_id text,
  visitor_ip text,
  country_code text,
  city text,
  user_agent text,
  referrer text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.link_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert events" ON public.link_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read events" ON public.link_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service role full" ON public.link_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_link_events_slug ON public.link_events(slug);
CREATE INDEX idx_link_events_created ON public.link_events(created_at DESC);