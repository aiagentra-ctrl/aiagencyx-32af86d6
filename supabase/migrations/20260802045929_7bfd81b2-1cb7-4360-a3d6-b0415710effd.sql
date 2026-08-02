-- 1) Seed the "any agent tried" rule (voice OR chat)
INSERT INTO public.followup_rules (trigger_key, label, delay_hours, enabled, auto_send)
VALUES ('tried_any_agent', 'Any Agent Tried (voice or chat)', 48, true, true)
ON CONFLICT DO NOTHING;

-- 2) Hard stop: any incoming reply cancels every future follow-up for that lead
CREATE OR REPLACE FUNCTION public.cancel_followups_on_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_now timestamptz := COALESCE(NEW.created_at, now());
BEGIN
  IF NEW.direction <> 'incoming' THEN RETURN NEW; END IF;

  UPDATE public.follow_up_enrollments
  SET status = 'responded', replied_at = COALESCE(replied_at, v_now),
      completed_at = COALESCE(completed_at, v_now), next_step_at = NULL
  WHERE prospect_id = NEW.prospect_id
    AND status IN ('active', 'sending', 'paused_hot_lead', 'scheduled');

  UPDATE public.followup_events
  SET status = 'cancelled', updated_at = v_now
  WHERE prospect_id = NEW.prospect_id AND status = 'pending';

  UPDATE public.prospects
  SET followup_status = 'responded', next_followup_at = NULL, next_followup_trigger = NULL
  WHERE id = NEW.prospect_id;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cancel_followups_on_reply ON public.inbox_messages;
CREATE TRIGGER trg_cancel_followups_on_reply
AFTER INSERT ON public.inbox_messages
FOR EACH ROW EXECUTE FUNCTION public.cancel_followups_on_reply();

-- 3) Hard stop: a Calendly booking cancels every future follow-up
CREATE OR REPLACE FUNCTION public.cancel_followups_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.calendly_booked_at IS NULL OR OLD.calendly_booked_at IS NOT NULL THEN RETURN NEW; END IF;

  UPDATE public.follow_up_enrollments
  SET status = 'booked', completed_at = now(), next_step_at = NULL
  WHERE prospect_id = NEW.id AND status IN ('active', 'sending', 'paused_hot_lead', 'scheduled');

  UPDATE public.followup_events
  SET status = 'cancelled', updated_at = now()
  WHERE prospect_id = NEW.id AND status = 'pending';

  NEW.followup_status := 'booked';
  NEW.next_followup_at := NULL;
  NEW.next_followup_trigger := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cancel_followups_on_booking ON public.prospects;
CREATE TRIGGER trg_cancel_followups_on_booking
BEFORE UPDATE OF calendly_booked_at ON public.prospects
FOR EACH ROW EXECUTE FUNCTION public.cancel_followups_on_booking();

-- 4) Backfill: stop anything still scheduled for leads who already replied or booked
UPDATE public.follow_up_enrollments e
SET status = 'responded', completed_at = now(), next_step_at = NULL
WHERE e.status IN ('active', 'sending', 'paused_hot_lead', 'scheduled')
  AND EXISTS (SELECT 1 FROM public.inbox_messages m WHERE m.prospect_id = e.prospect_id AND m.direction = 'incoming');

UPDATE public.followup_events ev
SET status = 'cancelled', updated_at = now()
WHERE ev.status = 'pending'
  AND EXISTS (SELECT 1 FROM public.inbox_messages m WHERE m.prospect_id = ev.prospect_id AND m.direction = 'incoming');

UPDATE public.prospects p
SET followup_status = 'responded', next_followup_at = NULL, next_followup_trigger = NULL
WHERE p.followup_status NOT IN ('responded', 'booked')
  AND EXISTS (SELECT 1 FROM public.inbox_messages m WHERE m.prospect_id = p.id AND m.direction = 'incoming');