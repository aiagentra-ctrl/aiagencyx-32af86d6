
-- Trigger fn: on link_events insert (page opens, clicks, voice/chat), mirror to prospect trackers + demo_open_log + hot lead
CREATE OR REPLACE FUNCTION public.on_link_event_track_prospect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prospect record;
  v_open_count int;
  v_now timestamptz := now();
BEGIN
  -- Skip owner/bot traffic
  IF (NEW.metadata->>'is_owner')::boolean IS TRUE THEN RETURN NEW; END IF;

  -- Find prospect via inbox_demos.demo_url containing slug
  SELECT p.* INTO v_prospect
  FROM public.prospects p
  JOIN public.inbox_demos d ON d.prospect_id = p.id
  WHERE d.demo_url ILIKE '%' || NEW.slug || '%'
  ORDER BY d.created_at DESC LIMIT 1;

  IF v_prospect.id IS NULL THEN RETURN NEW; END IF;

  -- Log activity time (UTC)
  INSERT INTO public.prospect_activity_times (prospect_id, day_of_week, hour_of_day, event_type)
  VALUES (
    v_prospect.id,
    EXTRACT(DOW FROM v_now)::smallint,
    EXTRACT(HOUR FROM v_now)::smallint,
    CASE NEW.event_type
      WHEN 'page_view' THEN 'page_open'
      WHEN 'link_click' THEN 'link_click'
      WHEN 'voice_start' THEN 'voice_try'
      WHEN 'chat_start' THEN 'chat_try'
      ELSE NEW.event_type END
  );

  -- On page open: log to demo_open_log + hot lead check
  IF NEW.event_type IN ('page_view','page_open') THEN
    INSERT INTO public.demo_open_log (prospect_id, opened_at) VALUES (v_prospect.id, v_now);

    SELECT COUNT(*) INTO v_open_count
    FROM public.demo_open_log
    WHERE prospect_id = v_prospect.id AND opened_at >= v_now - interval '24 hours';

    UPDATE public.prospects
    SET demo_page_opened_at = COALESCE(demo_page_opened_at, v_now),
        last_activity_at = v_now,
        hot_lead_open_count = v_open_count
    WHERE id = v_prospect.id;

    IF v_open_count >= 3 AND NOT v_prospect.is_hot_lead THEN
      UPDATE public.prospects
      SET is_hot_lead = true, hot_lead_detected_at = v_now
      WHERE id = v_prospect.id;

      UPDATE public.follow_up_enrollments
      SET status = 'paused_hot_lead'
      WHERE prospect_id = v_prospect.id AND status = 'active';

      INSERT INTO public.notifications (type, prospect_id, message)
      VALUES ('hot_lead', v_prospect.id,
        COALESCE(v_prospect.firstname,'Prospect') || ' (' || COALESCE(v_prospect.company,'—') ||
        ') opened their demo ' || v_open_count || 'x in the last 24h');
    END IF;
  END IF;

  IF NEW.event_type = 'link_click' THEN
    UPDATE public.prospects SET demo_link_clicked_at = COALESCE(demo_link_clicked_at, v_now), last_activity_at = v_now WHERE id = v_prospect.id;
  END IF;
  IF NEW.event_type IN ('voice_start','voice_try') THEN
    UPDATE public.prospects SET voice_tried_at = COALESCE(voice_tried_at, v_now), last_activity_at = v_now WHERE id = v_prospect.id;
  END IF;
  IF NEW.event_type IN ('chat_start','chat_try') THEN
    UPDATE public.prospects SET chatbot_tried_at = COALESCE(chatbot_tried_at, v_now), last_activity_at = v_now WHERE id = v_prospect.id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_link_event_prospect ON public.link_events;
CREATE TRIGGER trg_link_event_prospect
AFTER INSERT ON public.link_events
FOR EACH ROW EXECUTE FUNCTION public.on_link_event_track_prospect();

-- Trigger fn: on inbox_messages incoming, log reply activity + mark enrollment replied
CREATE OR REPLACE FUNCTION public.on_incoming_message_track()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_now timestamptz := COALESCE(NEW.created_at, now());
BEGIN
  IF NEW.direction <> 'incoming' THEN RETURN NEW; END IF;

  INSERT INTO public.prospect_activity_times (prospect_id, day_of_week, hour_of_day, event_type)
  VALUES (NEW.prospect_id, EXTRACT(DOW FROM v_now)::smallint, EXTRACT(HOUR FROM v_now)::smallint, 'reply');

  UPDATE public.follow_up_enrollments
  SET replied_at = v_now, status = 'responded', completed_at = v_now
  WHERE prospect_id = NEW.prospect_id
    AND status IN ('active','paused_hot_lead')
    AND replied_at IS NULL;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_incoming_message_track ON public.inbox_messages;
CREATE TRIGGER trg_incoming_message_track
AFTER INSERT ON public.inbox_messages
FOR EACH ROW EXECUTE FUNCTION public.on_incoming_message_track();
