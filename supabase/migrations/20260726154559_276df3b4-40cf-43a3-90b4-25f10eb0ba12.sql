DO $$ BEGIN
  CREATE TYPE public.cta_type AS ENUM ('link_only','demo_only','both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.follow_up_steps
  ADD COLUMN IF NOT EXISTS cta_type public.cta_type NOT NULL DEFAULT 'both';

UPDATE public.follow_up_steps
  SET cta_type = CASE WHEN include_demo_link THEN 'both'::public.cta_type ELSE 'link_only'::public.cta_type END;

ALTER TABLE public.prospect_memory
  ADD COLUMN IF NOT EXISTS lead_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS last_classification text,
  ADD COLUMN IF NOT EXISTS pitch_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.follow_up_enrollments
  ADD COLUMN IF NOT EXISTS scheduling_debug jsonb NOT NULL DEFAULT '{}'::jsonb;