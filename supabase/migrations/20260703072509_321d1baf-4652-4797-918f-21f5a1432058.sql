ALTER TABLE public.chatbot_sessions
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS analysis jsonb,
  ADD COLUMN IF NOT EXISTS topics text[],
  ADD COLUMN IF NOT EXISTS sentiment text;

CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_ended
  ON public.chatbot_sessions(ended_at DESC) WHERE ended_at IS NOT NULL;

ALTER TABLE public.prompt_improvement_suggestions
  ADD COLUMN IF NOT EXISTS sessions_analyzed int,
  ADD COLUMN IF NOT EXISTS outcomes jsonb,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS suggestions jsonb;

ALTER TABLE public.prompt_improvement_suggestions
  ALTER COLUMN suggestion_type DROP NOT NULL,
  ALTER COLUMN suggested_change DROP NOT NULL;