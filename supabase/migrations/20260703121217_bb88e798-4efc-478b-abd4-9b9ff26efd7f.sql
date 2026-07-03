
CREATE TABLE public.ecommerce_landing_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  hero_headline text NOT NULL DEFAULT 'Turn every visitor into a customer with {{company}}''s AI',
  hero_sub text NOT NULL DEFAULT 'A voice + chat agent that knows every product in your store — and sells for you 24/7.',
  hero_cta_primary text NOT NULL DEFAULT '💬 Try the AI now',
  hero_cta_secondary text NOT NULL DEFAULT '🎙 Or start a voice call',
  intro_greeting text NOT NULL DEFAULT 'Hey {{visitor_name}},',
  intro_body text NOT NULL DEFAULT 'I built a tool that captures leads while you''re off the clock.

It''s a robot that talks to your customers on your site, answers questions, and helps them get exactly what they want while you focus on running {{company}}.

Try it out 💬

A smooth chat will begin in the bottom-right corner.

Capture sales the moment buyers are ready by responding instantly.',
  image_headline text NOT NULL DEFAULT 'Turn conversations into conversions',
  image_sub text NOT NULL DEFAULT 'Book a call and see how AI Agents can sell, support, and generate leads for {{company}} 24/7.',
  image_cta text NOT NULL DEFAULT 'Book Your Call Now',
  hero_image_url text NOT NULL DEFAULT '',
  urgency_line text NOT NULL DEFAULT 'Don''t wait until it''s too late. The early adopters always win.',
  proof_headline text NOT NULL DEFAULT 'The proof? My clients can''t stop talking about it',
  youtube_embed_url text NOT NULL DEFAULT 'https://www.youtube.com/embed/eOAyie0kWGQ',
  demo_headline text NOT NULL DEFAULT 'Talk to {{company}}''s AI — chat or voice, one window',
  demo_sub text NOT NULL DEFAULT 'Type a question or tap the mic. The same AI answers both ways — and knows every one of your products.',
  cta_headline text NOT NULL DEFAULT 'Ready to grow {{company}} with AI?',
  cta_sub text NOT NULL DEFAULT 'Book a 15-min call and see it live on your store.',
  cta_button text NOT NULL DEFAULT 'Book Your Call Now',
  footer_note text NOT NULL DEFAULT 'Built for {{company}} with ❤️ by AI Agents',
  suggestion_chips jsonb NOT NULL DEFAULT '["🏆 Show bestsellers","🎁 Gift ideas","💰 Under $100","📦 Shipping info"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ecommerce_landing_template TO anon, authenticated;
GRANT ALL ON public.ecommerce_landing_template TO service_role;

ALTER TABLE public.ecommerce_landing_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view landing template"
  ON public.ecommerce_landing_template FOR SELECT
  USING (true);

CREATE POLICY "Service role manages landing template"
  ON public.ecommerce_landing_template FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER touch_ecom_landing_updated_at
  BEFORE UPDATE ON public.ecommerce_landing_template
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

INSERT INTO public.ecommerce_landing_template (singleton) VALUES (true) ON CONFLICT DO NOTHING;
