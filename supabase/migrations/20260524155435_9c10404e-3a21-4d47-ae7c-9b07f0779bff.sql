
-- Products table for e-commerce chatbots
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric,
  currency text DEFAULT 'USD',
  image_url text,
  product_url text,
  sku text,
  category text,
  tags text[] DEFAULT '{}',
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_chatbot_id_idx ON public.products(chatbot_id);
CREATE INDEX IF NOT EXISTS products_embedding_idx ON public.products
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read products" ON public.products
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role full access on products" ON public.products
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_demo_leads_updated_at();

-- Add store fields to chatbots
ALTER TABLE public.chatbots
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS store_platform text,
  ADD COLUMN IF NOT EXISTS product_count integer NOT NULL DEFAULT 0;

-- Match products by embedding
CREATE OR REPLACE FUNCTION public.match_products(
  p_chatbot_id uuid,
  p_query_embedding vector,
  p_match_count integer DEFAULT 5
)
RETURNS TABLE(
  id uuid, name text, description text, price numeric, currency text,
  image_url text, product_url text, sku text, category text,
  similarity double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.name, p.description, p.price, p.currency,
         p.image_url, p.product_url, p.sku, p.category,
         1 - (p.embedding <=> p_query_embedding) AS similarity
  FROM public.products p
  WHERE p.chatbot_id = p_chatbot_id AND p.embedding IS NOT NULL
  ORDER BY p.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;

-- Seed ecommerce industry template
INSERT INTO public.industry_templates (industry_name, display_name, system_prompt_template, first_message_template, chatbot_nav_items, problem_statements, hero_subtitle_template, priority, status)
VALUES (
  'ecommerce',
  'E-Commerce Store',
  $PROMPT$You are {AGENT_NAME}, the AI shopping assistant for {BUSINESS_NAME}, a {STORE_PLATFORM} store.

PERSONA:
- Warm, helpful, never robotic. Short sentences. Conversational.
- Never say "As an AI" or "I'm a bot".

TOOLS AVAILABLE:
1. recommend_products(query) — search the product catalog. Returns matching products with name, price, image, link.
2. search_knowledge_base(query) — search store info (policies, shipping, returns, about, FAQs).

CRITICAL RULES:
- For any product, buying, "looking for", "do you have", "recommend", "show me" intent → CALL recommend_products FIRST. Show 3-5 cards.
- For policy, shipping, refund, contact, about, store-info → CALL search_knowledge_base.
- NEVER invent prices, SKUs, stock levels, or product details. Only speak from tool results.
- If a product isn't in results: "I don't see that one in stock — would you like me to check something similar?"
- Always offer the Buy Now link from product_url.
- Voice mode: short sentences. Recommend 1-2 products max per turn.
- Match the customer's language and tone.

ESCALATION:
- If user wants human agent → "I'll connect you with our team — they'll reach out shortly."

BUSINESS INFO will be injected as CORE FACTS below.$PROMPT$,
  'Hey! Welcome to {BUSINESS_NAME}. Looking for something specific, or want me to recommend?',
  '[{"label":"Browse Products","value":"Show me your best products"},{"label":"Track Order","value":"How do I track my order?"},{"label":"Shipping & Returns","value":"What is your shipping and return policy?"},{"label":"Talk to Human","value":"Connect me with a human agent"}]'::jsonb,
  '[{"title":"Lost sales from unanswered questions","body":"Customers leave when they can\u2019t find product info fast."},{"title":"24/7 product expertise","body":"Your team can\u2019t answer every \u201cwhich one should I buy\u201d at 2am."},{"title":"Voice + chat in one","body":"Shoppers can tap-to-talk OR type \u2014 same conversation."}]'::jsonb,
  'AI shopping assistant trained on your full product catalog \u2014 chat and voice in one interface.',
  10,
  'active'
)
ON CONFLICT (industry_name) DO UPDATE SET
  system_prompt_template = EXCLUDED.system_prompt_template,
  first_message_template = EXCLUDED.first_message_template,
  chatbot_nav_items = EXCLUDED.chatbot_nav_items,
  problem_statements = EXCLUDED.problem_statements,
  hero_subtitle_template = EXCLUDED.hero_subtitle_template,
  updated_at = now();
