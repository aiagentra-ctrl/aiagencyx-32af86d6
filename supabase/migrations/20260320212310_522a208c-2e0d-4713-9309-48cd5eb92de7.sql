
-- Insert default admin config keys if they don't exist
INSERT INTO public.site_settings (key, value) VALUES
  ('vapi_public_key', ''),
  ('vapi_private_key', ''),
  ('default_system_prompt', ''),
  ('voice_provider', 'azure'),
  ('voice_id', 'andrew'),
  ('voice_language', 'en'),
  ('ai_model', 'gpt-4o'),
  ('ai_model_provider', 'openai'),
  ('default_first_message', 'Hi, thank you for calling {business_name}! I can help you place an order, book a table, or answer any questions. What would you like to do?'),
  ('default_end_call_message', 'Thank you for calling {business_name}. Have a great day!'),
  ('chatbot_greeting', 'Welcome to {business_name}! How can I help you today?'),
  ('chatbot_position', 'bottom-right')
ON CONFLICT (key) DO NOTHING;
