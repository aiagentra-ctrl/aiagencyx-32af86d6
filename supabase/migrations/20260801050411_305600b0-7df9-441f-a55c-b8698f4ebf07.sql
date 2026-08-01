CREATE OR REPLACE FUNCTION public.on_link_event_track_prospect()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prospect record;
  v_open_count int;
  v_now timestamptz := now();
  v_kind text;
BEGIN
  IF (NEW.metadata->>'is_owner')::boolean IS TRUE OR NEW.is_self_traffic IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT p.* INTO v_prospect
  FROM public.prospects p
  JOIN public.inbox_demos d ON d.prospect_id = p.id
  WHERE d.demo_url ILIKE '%' || NEW.slug || '%'
  ORDER BY d.created_at DESC LIMIT 1;

  IF v_prospect.id IS NULL THEN RETURN NEW; END IF;

  v_kind := CASE
    WHEN NEW.event_type IN ('page_view','page_open','session_start','return_visit') THEN 'page_open'
    WHEN NEW.event_type IN ('link_click') THEN 'link_click'
    WHEN NEW.event_type IN ('voice_start','voice_try','voice_call_started','voice_call_ended') THEN 'voice_try'
    WHEN NEW.event_type IN ('chat_start','chat_try','chatbot_opened','chatbot_message') THEN 'chat_try'
    ELSE NULL END;

  IF v_kind IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.prospect_activity_times (prospect_id, day_of_week, hour_of_day, event_type)
  VALUES (v_prospect.id, EXTRACT(DOW FROM v_now)::smallint, EXTRACT(HOUR FROM v_now)::smallint, v_kind);

  IF v_kind = 'page_open' THEN
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
  ELSIF v_kind = 'link_click' THEN
    UPDATE public.prospects SET demo_link_clicked_at = COALESCE(demo_link_clicked_at, v_now), last_activity_at = v_now WHERE id = v_prospect.id;
  ELSIF v_kind = 'voice_try' THEN
    UPDATE public.prospects
    SET voice_tried_at = COALESCE(voice_tried_at, v_now),
        demo_page_opened_at = COALESCE(demo_page_opened_at, v_now),
        engagement_channel = COALESCE(engagement_channel, 'voice'),
        first_interaction_at = COALESCE(first_interaction_at, v_now),
        last_interaction_at = v_now,
        last_activity_at = v_now
    WHERE id = v_prospect.id;
  ELSIF v_kind = 'chat_try' THEN
    UPDATE public.prospects
    SET chatbot_tried_at = COALESCE(chatbot_tried_at, v_now),
        demo_page_opened_at = COALESCE(demo_page_opened_at, v_now),
        engagement_channel = COALESCE(engagement_channel, 'chat'),
        first_interaction_at = COALESCE(first_interaction_at, v_now),
        last_interaction_at = v_now,
        last_activity_at = v_now
    WHERE id = v_prospect.id;
  END IF;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_link_event_prospect ON public.link_events;
CREATE TRIGGER trg_link_event_prospect
AFTER INSERT ON public.link_events
FOR EACH ROW EXECUTE FUNCTION public.on_link_event_track_prospect();