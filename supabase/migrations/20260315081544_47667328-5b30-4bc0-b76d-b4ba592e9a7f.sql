
-- Create chatbots table
CREATE TABLE public.chatbots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  website_url text,
  slug text NOT NULL UNIQUE,
  system_prompt text NOT NULL DEFAULT '',
  ai_provider text NOT NULL DEFAULT 'lovable',
  ai_model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  api_key_encrypted text,
  research_data jsonb,
  brand_tone text,
  industry text,
  services jsonb DEFAULT '[]'::jsonb,
  faq_topics jsonb DEFAULT '[]'::jsonb,
  widget_config jsonb DEFAULT '{"position": "bottom-right", "greeting": "Hi! How can I help you?"}'::jsonb,
  demo_page_id uuid REFERENCES public.demo_pages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create chatbot_conversations table
CREATE TABLE public.chatbot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id uuid NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;

-- Chatbots RLS: public read, service_role full access
CREATE POLICY "Anyone can read chatbots" ON public.chatbots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service role full access on chatbots" ON public.chatbots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Anon can insert chatbots" ON public.chatbots FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anon can update chatbots" ON public.chatbots FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Conversations RLS: public read/write
CREATE POLICY "Anyone can read conversations" ON public.chatbot_conversations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert conversations" ON public.chatbot_conversations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update conversations" ON public.chatbot_conversations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on conversations" ON public.chatbot_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Enable realtime for conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.chatbot_conversations;
