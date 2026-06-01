
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS options jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS compare_at_price numeric,
  ADD COLUMN IF NOT EXISTS in_stock boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS products_chatbot_handle_unique
  ON public.products (chatbot_id, handle) WHERE handle IS NOT NULL;
