-- ============================================================
-- 03 — DATABASE FUNCTIONS
-- Custom functions only (pgvector/extension functions come from the extension).
-- Generated from the production database (schema-only, no lead data).
-- ============================================================

SET statement_timeout = 0;
SET client_min_messages = warning;
SET search_path = public, extensions;

-- cancel_followups_on_booking()  [FUNCTION]
CREATE FUNCTION public.cancel_followups_on_booking() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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

-- cancel_followups_on_reply()  [FUNCTION]
CREATE FUNCTION public.cancel_followups_on_reply() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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

-- get_best_send_time(uuid)  [FUNCTION]
CREATE FUNCTION public.get_best_send_time(p_prospect_id uuid) RETURNS TABLE(best_day smallint, best_hour smallint, data_points bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH counted AS (
    SELECT day_of_week, hour_of_day, COUNT(*) AS cnt
    FROM public.prospect_activity_times
    WHERE prospect_id = p_prospect_id
    GROUP BY day_of_week, hour_of_day
  ), total AS (
    SELECT COALESCE(SUM(cnt),0) AS total_pts FROM counted
  )
  SELECT c.day_of_week, c.hour_of_day, t.total_pts
  FROM counted c CROSS JOIN total t
  ORDER BY c.cnt DESC
  LIMIT 1;
$$;

-- match_kb_entries(uuid, public.vector, integer)  [FUNCTION]
CREATE FUNCTION public.match_kb_entries(p_chatbot_id uuid, p_query_embedding public.vector, p_match_count integer DEFAULT 5) RETURNS TABLE(id uuid, source_url text, content_type text, title text, content text, structured jsonb, similarity double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    e.id, e.source_url, e.content_type, e.title, e.content, e.structured,
    1 - (e.embedding <=> p_query_embedding) AS similarity
  FROM public.knowledge_base_entries e
  WHERE e.chatbot_id = p_chatbot_id AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;

-- match_listings_hybrid(uuid, public.vector, text, integer, jsonb)  [FUNCTION]
CREATE FUNCTION public.match_listings_hybrid(p_chatbot_id uuid, p_query_embedding public.vector, p_query_text text, p_match_count integer DEFAULT 5, p_filters jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id uuid, listing_id text, address text, city text, price numeric, status text, bedrooms numeric, bathrooms numeric, sqft numeric, property_type text, description_raw text, features text[], hoa_fee numeric, listing_agent text, photos text[], source_url text, last_scraped timestamp with time zone, vector_score double precision, text_score double precision, combined_score double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH scored AS (
    SELECT
      l.id, l.listing_id, l.address, l.city, l.price, l.status,
      l.bedrooms, l.bathrooms, l.sqft, l.property_type, l.description_raw,
      l.features, l.hoa_fee, l.listing_agent, l.photos, l.source_url, l.last_scraped,
      CASE WHEN l.embedding IS NULL OR p_query_embedding IS NULL THEN 0
           ELSE (1 - (l.embedding <=> p_query_embedding))::float END AS vector_score,
      (ts_rank(
        to_tsvector('english',
          COALESCE(l.address,'') || ' ' || COALESCE(l.city,'') || ' ' ||
          COALESCE(l.property_type,'') || ' ' || COALESCE(l.description_raw,'')
        ),
        plainto_tsquery('english', COALESCE(p_query_text, ''))
      ) / 10.0)::float AS text_score
    FROM public.property_listings l
    WHERE l.chatbot_id = p_chatbot_id
      AND ((p_filters->>'max_price') IS NULL OR l.price IS NULL OR l.price <= (p_filters->>'max_price')::numeric)
      AND ((p_filters->>'min_price') IS NULL OR l.price IS NULL OR l.price >= (p_filters->>'min_price')::numeric)
      AND ((p_filters->>'min_bedrooms') IS NULL OR l.bedrooms IS NULL OR l.bedrooms >= (p_filters->>'min_bedrooms')::numeric)
      AND ((p_filters->>'city') IS NULL OR l.city ILIKE '%' || (p_filters->>'city') || '%')
      AND ((p_filters->>'property_type') IS NULL OR l.property_type ILIKE '%' || (p_filters->>'property_type') || '%')
      AND ((p_filters->>'status') IS NULL OR l.status ILIKE (p_filters->>'status'))
  )
  SELECT
    id, listing_id, address, city, price, status, bedrooms, bathrooms, sqft,
    property_type, description_raw, features, hoa_fee, listing_agent, photos,
    source_url, last_scraped, vector_score, text_score,
    ((vector_score * 0.7) + (text_score * 0.3))::float
  FROM scored
  ORDER BY ((vector_score * 0.7) + (text_score * 0.3)) DESC
  LIMIT p_match_count;
$$;

-- match_products(uuid, public.vector, integer)  [FUNCTION]
CREATE FUNCTION public.match_products(p_chatbot_id uuid, p_query_embedding public.vector, p_match_count integer DEFAULT 5) RETURNS TABLE(id uuid, name text, description text, price numeric, currency text, image_url text, product_url text, sku text, category text, similarity double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT p.id, p.name, p.description, p.price, p.currency,
         p.image_url, p.product_url, p.sku, p.category,
         1 - (p.embedding <=> p_query_embedding) AS similarity
  FROM public.products p
  WHERE p.chatbot_id = p_chatbot_id AND p.embedding IS NOT NULL
  ORDER BY p.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;

-- match_products_hybrid(uuid, public.vector, text, integer, jsonb)  [FUNCTION]
CREATE FUNCTION public.match_products_hybrid(p_chatbot_id uuid, p_query_embedding public.vector, p_query_text text, p_match_count integer DEFAULT 5, p_filters jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(id uuid, name text, price numeric, compare_at_price numeric, currency text, image_url text, images text[], product_url text, sku text, category text, in_stock boolean, vendor text, description text, variants jsonb, options jsonb, vector_score double precision, text_score double precision, combined_score double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH scored AS (
    SELECT
      p.id, p.name, p.price, p.compare_at_price, p.currency,
      p.image_url, p.images, p.product_url, p.sku, p.category,
      p.in_stock, p.vendor, p.description, p.variants, p.options,
      (1 - (p.embedding <=> p_query_embedding))::float AS vector_score,
      (ts_rank(
        to_tsvector('english',
          COALESCE(p.name,'') || ' ' ||
          COALESCE(p.description,'') || ' ' ||
          COALESCE(p.category,'') || ' ' ||
          COALESCE(p.vendor,'')
        ),
        plainto_tsquery('english', COALESCE(p_query_text, ''))
      ) / 10.0)::float AS text_score
    FROM public.products p
    WHERE p.chatbot_id = p_chatbot_id
      AND p.embedding IS NOT NULL
      AND ((p_filters->>'max_price') IS NULL OR p.price IS NULL OR p.price <= (p_filters->>'max_price')::numeric)
      AND ((p_filters->>'min_price') IS NULL OR p.price IS NULL OR p.price >= (p_filters->>'min_price')::numeric)
      AND ((p_filters->>'category') IS NULL OR p.category ILIKE '%' || (p_filters->>'category') || '%')
      AND ((p_filters->>'vendor') IS NULL OR p.vendor ILIKE '%' || (p_filters->>'vendor') || '%')
      AND ((p_filters->>'in_stock') IS NULL OR (p_filters->>'in_stock')::boolean = false OR p.in_stock = true)
  )
  SELECT
    id, name, price, compare_at_price, currency, image_url, images,
    product_url, sku, category, in_stock, vendor, description, variants, options,
    vector_score, text_score,
    ((vector_score * 0.7) + (text_score * 0.3))::float
  FROM scored
  ORDER BY ((vector_score * 0.7) + (text_score * 0.3)) DESC
  LIMIT p_match_count;
$$;

-- mirror_demo_lead_to_prospect()  [FUNCTION]
CREATE FUNCTION public.mirror_demo_lead_to_prospect() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

-- on_incoming_message_track()  [FUNCTION]
CREATE FUNCTION public.on_incoming_message_track() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

-- on_link_event_track_prospect()  [FUNCTION]
CREATE FUNCTION public.on_link_event_track_prospect() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
END $$;

-- release_pipeline_lock(text, text)  [FUNCTION]
CREATE FUNCTION public.release_pipeline_lock(p_key text, p_holder text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ DELETE FROM public.pipeline_locks WHERE lock_key = p_key AND holder = p_holder; $$;

-- touch_demo_leads_updated_at()  [FUNCTION]
CREATE FUNCTION public.touch_demo_leads_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- touch_updated_at_generic()  [FUNCTION]
CREATE FUNCTION public.touch_updated_at_generic() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- touch_updated_at_inbox()  [FUNCTION]
CREATE FUNCTION public.touch_updated_at_inbox() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- try_acquire_pipeline_lock(text, text, integer)  [FUNCTION]
CREATE FUNCTION public.try_acquire_pipeline_lock(p_key text, p_holder text, p_ttl_seconds integer DEFAULT 180) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_ok boolean;
BEGIN
  DELETE FROM public.pipeline_locks WHERE expires_at < now();
  INSERT INTO public.pipeline_locks (lock_key, holder, acquired_at, expires_at)
  VALUES (p_key, p_holder, now(), now() + make_interval(secs => p_ttl_seconds))
  ON CONFLICT (lock_key) DO NOTHING;
  SELECT EXISTS (SELECT 1 FROM public.pipeline_locks WHERE lock_key = p_key AND holder = p_holder) INTO v_ok;
  RETURN v_ok;
END $$;

-- update_leads_updated_at()  [FUNCTION]
CREATE FUNCTION public.update_leads_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;
