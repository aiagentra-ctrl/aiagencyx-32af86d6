CREATE TABLE public.property_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid NOT NULL,
  listing_id text,
  address text,
  city text,
  price numeric,
  status text,
  bedrooms numeric,
  bathrooms numeric,
  sqft numeric,
  lot_size text,
  property_type text,
  description_raw text,
  features text[] DEFAULT '{}',
  hoa_fee numeric,
  listing_agent text,
  photos text[] DEFAULT '{}',
  source_url text,
  last_scraped timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.property_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_listings TO authenticated;
GRANT ALL ON public.property_listings TO service_role;

ALTER TABLE public.property_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_listings public read" ON public.property_listings FOR SELECT USING (true);
CREATE POLICY "property_listings authenticated manage" ON public.property_listings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_property_listings_chatbot ON public.property_listings(chatbot_id);
CREATE INDEX idx_property_listings_fts ON public.property_listings
  USING gin (to_tsvector('english', COALESCE(address,'') || ' ' || COALESCE(city,'') || ' ' || COALESCE(property_type,'') || ' ' || COALESCE(description_raw,'')));

CREATE TRIGGER trg_property_listings_touch
BEFORE UPDATE ON public.property_listings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

CREATE TABLE public.realestate_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid NOT NULL UNIQUE,
  agency_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  business_type text,
  core_job text[] DEFAULT '{}',
  service_area text[] DEFAULT '{}',
  property_types text[] DEFAULT '{}',
  tone_signals text,
  key_differentiators text[] DEFAULT '{}',
  compliance_notes text[] DEFAULT '{}',
  suggested_agent_persona_name text,
  confidence text,
  booking_widget_detected boolean NOT NULL DEFAULT false,
  needs_human_review boolean NOT NULL DEFAULT false,
  generated_prompt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.realestate_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.realestate_profiles TO authenticated;
GRANT ALL ON public.realestate_profiles TO service_role;

ALTER TABLE public.realestate_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "realestate_profiles public read" ON public.realestate_profiles FOR SELECT USING (true);
CREATE POLICY "realestate_profiles authenticated manage" ON public.realestate_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_realestate_profiles_touch
BEFORE UPDATE ON public.realestate_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

CREATE OR REPLACE FUNCTION public.match_listings_hybrid(
  p_chatbot_id uuid,
  p_query_embedding vector,
  p_query_text text,
  p_match_count integer DEFAULT 5,
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  id uuid, listing_id text, address text, city text, price numeric, status text,
  bedrooms numeric, bathrooms numeric, sqft numeric, property_type text,
  description_raw text, features text[], hoa_fee numeric, listing_agent text,
  photos text[], source_url text, last_scraped timestamptz,
  vector_score double precision, text_score double precision, combined_score double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
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