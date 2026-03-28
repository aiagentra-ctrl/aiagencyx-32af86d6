
CREATE TABLE public.industry_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  system_prompt_template text NOT NULL DEFAULT '',
  first_message_template text NOT NULL DEFAULT 'Hi, thank you for calling {business_name}! How can I help you?',
  chatbot_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  voice_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  website_template jsonb NOT NULL DEFAULT '{}'::jsonb,
  problem_statements jsonb NOT NULL DEFAULT '[]'::jsonb,
  chatbot_nav_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  floating_bubbles jsonb NOT NULL DEFAULT '[]'::jsonb,
  hero_subtitle_template text DEFAULT NULL,
  status text NOT NULL DEFAULT 'active',
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.industry_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active templates" ON public.industry_templates
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role full access on templates" ON public.industry_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can manage templates" ON public.industry_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed a default template
INSERT INTO public.industry_templates (industry_name, display_name, system_prompt_template, first_message_template, hero_subtitle_template, problem_statements, chatbot_nav_items, floating_bubbles, status)
VALUES
('restaurant', 'Restaurant', 
'You are the AI receptionist for {business_name}. You handle phone calls, take orders, make reservations, and answer questions about the menu, hours, and location. Be warm, professional, and efficient. Always confirm details before ending a call.',
'Hi, thank you for calling {business_name}! How can I help you today?',
'Answers calls, takes orders, and handles bookings — 24/7',
'[{"title":"Missed Calls = Lost Orders","desc":"Every unanswered call is a customer going to your competitor.","stat":"67%","statLabel":"of callers won''t call back"},{"title":"Busy Staff = Missed Bookings","desc":"Your team can''t answer phones while serving customers.","stat":"38%","statLabel":"of calls go unanswered"},{"title":"After-Hours Silence","desc":"Customers call evenings and weekends — and nobody picks up.","stat":"45%","statLabel":"of calls are after hours"},{"title":"Revenue Leak","desc":"Each missed call costs an average of $50–200 in lost orders.","stat":"$2.4K","statLabel":"lost per month avg"}]'::jsonb,
'[{"label":"Menu","value":"Show me the full menu"},{"label":"Order","value":"I want to order food"},{"label":"Reserve","value":"I want to reserve a table"},{"label":"Location","value":"What''s your location and hours?"},{"label":"FAQ","value":"What are your frequently asked questions?"}]'::jsonb,
'["📞 \"Book a table for 4\"","🍕 \"I''d like to order\""]'::jsonb,
'active'),

('default', 'Default / General', 
'You are the AI assistant for {business_name}. Be friendly, professional, and helpful. Answer questions about the business, services, pricing, and availability. Guide customers to take action.',
'Hi, thank you for calling {business_name}! How can I help you?',
NULL,
'[]'::jsonb,
'[{"label":"Services","value":"What services do you offer?"},{"label":"Pricing","value":"What are your prices?"},{"label":"Hours","value":"What are your business hours?"},{"label":"Contact","value":"How can I contact you?"},{"label":"FAQ","value":"Frequently asked questions"}]'::jsonb,
'["📞 \"Tell me about your services\"","💬 \"I need a quote\""]'::jsonb,
'active');
