ALTER TABLE public.link_events ADD COLUMN IF NOT EXISTS is_self_traffic boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS link_events_self_traffic_idx ON public.link_events (is_self_traffic, created_at DESC);
CREATE INDEX IF NOT EXISTS link_events_slug_created_idx ON public.link_events (slug, created_at DESC);

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS demo_engagement_seconds numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_tier text NOT NULL DEFAULT 'not_tried',
  ADD COLUMN IF NOT EXISTS engagement_channel text,
  ADD COLUMN IF NOT EXISTS first_interaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS calendly_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS calendly_booked_at timestamptz,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS is_self_traffic boolean NOT NULL DEFAULT false;

ALTER TABLE public.demo_leads
  ADD COLUMN IF NOT EXISTS demo_engagement_seconds numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_tier text NOT NULL DEFAULT 'not_tried',
  ADD COLUMN IF NOT EXISTS engagement_channel text,
  ADD COLUMN IF NOT EXISTS calendly_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS calendly_booked_at timestamptz,
  ADD COLUMN IF NOT EXISTS exit_section text,
  ADD COLUMN IF NOT EXISTS deepest_section text;

ALTER TABLE public.follow_up_steps DROP COLUMN IF EXISTS cta_type;
DROP TYPE IF EXISTS public.cta_type;

ALTER TABLE public.follow_up_sequences_templates
  ADD COLUMN IF NOT EXISTS max_steps integer NOT NULL DEFAULT 3;