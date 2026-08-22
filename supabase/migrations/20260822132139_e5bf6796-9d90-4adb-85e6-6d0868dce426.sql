ALTER TABLE public.agent_appointments
  ALTER COLUMN street_address DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN state DROP NOT NULL,
  ALTER COLUMN zip DROP NOT NULL,
  ALTER COLUMN last_name DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'estimate',
  ADD COLUMN IF NOT EXISTS party_size integer;

INSERT INTO public.app_config (key, value, description) VALUES
  ('restaurant_service_hours', '11,12,13,17,18,19,20,21', 'Hours (24h, comma separated) the restaurant seats tables'),
  ('reservation_duration_min', '90', 'How long a table is held, in minutes'),
  ('concurrent_tables', '6', 'How many reservations can overlap before a slot is full'),
  ('max_party_size', '12', 'Party size above which the team is notified instead of auto-booking'),
  ('pickup_eta_min', '20', 'Typical pickup prep time in minutes'),
  ('delivery_eta_min', '45', 'Typical delivery time in minutes')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.industry_templates (
  industry_name, display_name, system_prompt_template, first_message_template,
  hero_subtitle_template, chatbot_config, voice_config, problem_statements,
  chatbot_nav_items, floating_bubbles, status, priority
) VALUES (
  'restaurant',
  'Restaurant',
  '',
  'Thanks for calling {business_name}! This is {agent_name} — what can I do for you?',
  'Answers every call, books tables and takes orders — 24/7',
  '{"capabilities":{"reservations":null,"orders":null,"delivery":null,"pickup":null,"catering":null},"auto_detect_capabilities":true}'::jsonb,
  '{"voice_prompt_template":"","auto_detect_capabilities":true}'::jsonb,
  '[{"title":"Missed calls at the dinner rush","desc":"Nobody can answer the phone while the room is full, so bookings and orders walk away.","stat":"62%","statLabel":"of restaurant calls go unanswered at peak"},{"title":"Orders taken wrong","desc":"Rushed phone orders mean wrong items, remakes and refunds.","stat":"1 in 8","statLabel":"phone orders need fixing"},{"title":"No-shows and empty tables","desc":"Reservations taken on paper get lost and tables sit empty.","stat":"20%","statLabel":"average no-show rate"}]'::jsonb,
  '[{"label":"Menu","value":"What is on the menu?"},{"label":"Book a table","value":"I would like to book a table"},{"label":"Order food","value":"I want to place an order"},{"label":"Hours","value":"What time are you open today?"}]'::jsonb,
  '["\ud83d\udcde \"Book a table for four\"","\ud83c\udf55 \"I would like to order a large pizza\"","\ud83d\udd52 \"Are you open tonight?\""]'::jsonb,
  'active',
  15
)
ON CONFLICT (industry_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  hero_subtitle_template = COALESCE(NULLIF(public.industry_templates.hero_subtitle_template, ''), EXCLUDED.hero_subtitle_template),
  updated_at = now();