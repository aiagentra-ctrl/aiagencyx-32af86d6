
-- CHATBOT SESSIONS
CREATE TABLE IF NOT EXISTS public.chatbot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES public.chatbots(id) ON DELETE CASCADE,
  demo_page_id uuid REFERENCES public.demo_pages(id) ON DELETE SET NULL,
  business_name text,
  session_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  total_messages int NOT NULL DEFAULT 0,
  user_messages int NOT NULL DEFAULT 0,
  bot_messages int NOT NULL DEFAULT 0,
  interaction_type text NOT NULL DEFAULT 'chat',
  products_shown int NOT NULL DEFAULT 0,
  products_clicked int NOT NULL DEFAULT 0,
  sentiment_score float,
  outcome text NOT NULL DEFAULT 'unknown',
  flagged_for_review boolean NOT NULL DEFAULT false,
  flag_reason text,
  UNIQUE (chatbot_id, session_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_sessions TO authenticated;
GRANT ALL ON public.chatbot_sessions TO service_role;
ALTER TABLE public.chatbot_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read chatbot_sessions" ON public.chatbot_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "service manage chatbot_sessions" ON public.chatbot_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_chatbot ON public.chatbot_sessions(chatbot_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_flagged ON public.chatbot_sessions(flagged_for_review) WHERE flagged_for_review = true;
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_outcome ON public.chatbot_sessions(outcome);

-- CHATBOT MESSAGES
CREATE TABLE IF NOT EXISTS public.chatbot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.chatbot_sessions(id) ON DELETE CASCADE,
  chatbot_id uuid REFERENCES public.chatbots(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  products_shown jsonb,
  query_intent text,
  response_quality_score float,
  was_helpful boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_messages TO authenticated;
GRANT ALL ON public.chatbot_messages TO service_role;
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read chatbot_messages" ON public.chatbot_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "service manage chatbot_messages" ON public.chatbot_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session ON public.chatbot_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_quality ON public.chatbot_messages(response_quality_score) WHERE response_quality_score IS NOT NULL;

-- PROMPT IMPROVEMENT SUGGESTIONS
CREATE TABLE IF NOT EXISTS public.prompt_improvement_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES public.chatbots(id) ON DELETE CASCADE,
  industry text NOT NULL DEFAULT 'ecommerce',
  suggestion_type text NOT NULL,
  current_behavior text,
  suggested_change text NOT NULL,
  evidence jsonb DEFAULT '[]'::jsonb,
  occurrence_count int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_improvement_suggestions TO authenticated;
GRANT ALL ON public.prompt_improvement_suggestions TO service_role;
ALTER TABLE public.prompt_improvement_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage suggestions" ON public.prompt_improvement_suggestions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service manage suggestions" ON public.prompt_improvement_suggestions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- PROMPT VERSIONS
CREATE TABLE IF NOT EXISTS public.prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid REFERENCES public.chatbots(id) ON DELETE CASCADE,
  industry text NOT NULL DEFAULT 'ecommerce',
  version_number int NOT NULL DEFAULT 1,
  system_prompt text NOT NULL,
  change_summary text,
  suggestions_applied uuid[] DEFAULT ARRAY[]::uuid[],
  applied_by text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_versions TO authenticated;
GRANT ALL ON public.prompt_versions TO service_role;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage prompt_versions" ON public.prompt_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service manage prompt_versions" ON public.prompt_versions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_industry ON public.prompt_versions(industry, created_at DESC);

-- HYBRID SEARCH
CREATE INDEX IF NOT EXISTS idx_products_fts ON public.products
USING GIN (to_tsvector('english',
  COALESCE(name,'') || ' ' ||
  COALESCE(description,'') || ' ' ||
  COALESCE(category,'') || ' ' ||
  COALESCE(vendor,'')
));

CREATE OR REPLACE FUNCTION public.match_products_hybrid(
  p_chatbot_id uuid,
  p_query_embedding vector,
  p_query_text text,
  p_match_count int DEFAULT 5,
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  name text,
  price numeric,
  compare_at_price numeric,
  currency text,
  image_url text,
  images text[],
  product_url text,
  sku text,
  category text,
  in_stock boolean,
  vendor text,
  description text,
  variants jsonb,
  options jsonb,
  vector_score float,
  text_score float,
  combined_score float
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.match_products_hybrid(uuid, vector, text, int, jsonb) TO anon, authenticated, service_role;
