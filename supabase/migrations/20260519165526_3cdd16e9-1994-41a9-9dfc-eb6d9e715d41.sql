ALTER TABLE public.chatbots
  ADD COLUMN IF NOT EXISTS kb_chatbot_md text,
  ADD COLUMN IF NOT EXISTS kb_voice_text text,
  ADD COLUMN IF NOT EXISTS prompt_core jsonb;