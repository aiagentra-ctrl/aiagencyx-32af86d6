
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge base entries
CREATE TABLE IF NOT EXISTS public.knowledge_base_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid NOT NULL,
  source_url text,
  content_type text NOT NULL DEFAULT 'page',
  title text,
  content text NOT NULL,
  structured jsonb DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_entries_chatbot ON public.knowledge_base_entries(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_kb_entries_type ON public.knowledge_base_entries(content_type);
CREATE INDEX IF NOT EXISTS idx_kb_entries_embedding
  ON public.knowledge_base_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.knowledge_base_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read kb entries"
  ON public.knowledge_base_entries FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role full access kb entries"
  ON public.knowledge_base_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Knowledge base jobs
CREATE TABLE IF NOT EXISTS public.knowledge_base_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid NOT NULL,
  website_url text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  pages_scraped integer NOT NULL DEFAULT 0,
  entries_created integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_kb_jobs_chatbot ON public.knowledge_base_jobs(chatbot_id);

ALTER TABLE public.knowledge_base_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read kb jobs"
  ON public.knowledge_base_jobs FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role full access kb jobs"
  ON public.knowledge_base_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Vector search function
CREATE OR REPLACE FUNCTION public.match_kb_entries(
  p_chatbot_id uuid,
  p_query_embedding vector(1536),
  p_match_count integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  source_url text,
  content_type text,
  title text,
  content text,
  structured jsonb,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    e.id, e.source_url, e.content_type, e.title, e.content, e.structured,
    1 - (e.embedding <=> p_query_embedding) AS similarity
  FROM public.knowledge_base_entries e
  WHERE e.chatbot_id = p_chatbot_id AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;

-- Seed Real Estate template
INSERT INTO public.industry_templates (
  industry_name, display_name, system_prompt_template, first_message_template,
  hero_subtitle_template, problem_statements, chatbot_nav_items, floating_bubbles,
  chatbot_config, voice_config, website_template, status, priority
) VALUES (
  'real_estate',
  'Real Estate',
  E'You are {agent_name}, a voice assistant for {business_name}.\n\nPERSONA:\n- Speak like a warm, confident human — never robotic\n- Short sentences. Natural pauses. Conversational tone.\n- Never say "As an AI" or "I''m a bot"\n\nBUSINESS INFO:\n- Company: {business_name}\n- Location: {city}\n- Services: {services}\n- Speciality: {speciality}\n- Working hours: {hours}\n- Contact: {phone} / {email}\n\nKNOWLEDGE BASE ACCESS:\n- You have a `search_knowledge_base` tool with all property listings, prices, locations, agents and FAQs.\n- ALWAYS call it before answering questions about specific properties, pricing, availability or policies.\n- NEVER guess facts. If the tool returns nothing, say: "Let me have our team confirm that for you."\n\nBEHAVIOR RULES:\n- Greet with: "Hi, I''m {agent_name} from {business_name}. How can I help you today?"\n- Ask one question at a time\n- If budget mentioned → call search_knowledge_base with the budget → match listings\n- If not available → offer alternatives via the tool, never say "we don''t have it"\n- Always end with a next step: book a visit, send details, or connect to a human\n- Out of scope → "Let me connect you with our team for that"\n\nTONE: Friendly, professional, brief. No jargon. Speak like a helpful friend who knows real estate.',
  'Hi, I''m {agent_name} from {business_name}. Looking to buy, rent, or sell today?',
  'Your 24/7 AI agent for {business_name} — books tours, qualifies buyers, answers listing questions instantly.',
  '["Missed buyer calls after hours","Slow follow-up loses hot leads","Repetitive listing questions eat agent time","Tour scheduling back-and-forth"]'::jsonb,
  '[{"label":"Browse Listings","value":"Show me your featured properties"},{"label":"Book a Tour","value":"I want to book a property tour"},{"label":"Talk to Agent","value":"Connect me with a human agent"},{"label":"Pricing & Areas","value":"What areas and price ranges do you cover?"}]'::jsonb,
  '["3BR available downtown","Tour booked in 30s","New listing under $500K","Waterfront condo just listed"]'::jsonb,
  '{"greeting":"Hi! Looking for your next home? I can show listings, book tours, or connect you with an agent.","position":"bottom-right","theme":"premium"}'::jsonb,
  '{"voice":"jennifer","speed":1.0}'::jsonb,
  '{"layout":"realestate_premium"}'::jsonb,
  'active',
  10
)
ON CONFLICT (industry_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  system_prompt_template = EXCLUDED.system_prompt_template,
  first_message_template = EXCLUDED.first_message_template,
  hero_subtitle_template = EXCLUDED.hero_subtitle_template,
  problem_statements = EXCLUDED.problem_statements,
  chatbot_nav_items = EXCLUDED.chatbot_nav_items,
  floating_bubbles = EXCLUDED.floating_bubbles,
  chatbot_config = EXCLUDED.chatbot_config,
  voice_config = EXCLUDED.voice_config,
  website_template = EXCLUDED.website_template,
  updated_at = now();
