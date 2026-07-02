
-- Enable extensions for scheduled jobs and HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Trigger fn: mirror demo_leads behavior onto matching prospects via inbox_demos.demo_url matching slug
CREATE OR REPLACE FUNCTION public.mirror_demo_lead_to_prospect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prospect_id uuid;
BEGIN
  -- Locate a prospect whose stored demo_url contains this demo's slug
  SELECT prospect_id INTO v_prospect_id
  FROM public.inbox_demos
  WHERE demo_url ILIKE '%' || NEW.slug || '%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_prospect_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.prospects
  SET
    demo_page_opened_at = COALESCE(demo_page_opened_at, NEW.last_visit_at),
    voice_tried_at      = COALESCE(voice_tried_at, NEW.voice_first_at),
    chatbot_tried_at    = COALESCE(chatbot_tried_at, NEW.chat_first_at),
    demo_link_clicked_at = COALESCE(demo_link_clicked_at, NEW.last_visit_at),
    last_activity_at    = GREATEST(COALESCE(last_activity_at, 'epoch'::timestamptz), COALESCE(NEW.last_visit_at, 'epoch'::timestamptz))
  WHERE id = v_prospect_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_demo_lead_to_prospect ON public.demo_leads;
CREATE TRIGGER trg_mirror_demo_lead_to_prospect
AFTER INSERT OR UPDATE ON public.demo_leads
FOR EACH ROW EXECUTE FUNCTION public.mirror_demo_lead_to_prospect();
