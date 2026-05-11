
CREATE TABLE public.follow_up_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condition text NOT NULL UNIQUE,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follow_up_templates_condition_check CHECK (condition IN ('not_tried','tried_voice_agent','tried_chatbot'))
);

ALTER TABLE public.follow_up_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read follow_up_templates"
  ON public.follow_up_templates FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert follow_up_templates"
  ON public.follow_up_templates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can update follow_up_templates"
  ON public.follow_up_templates FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access follow_up_templates"
  ON public.follow_up_templates FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER touch_follow_up_templates_updated_at
  BEFORE UPDATE ON public.follow_up_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_demo_leads_updated_at();

INSERT INTO public.follow_up_templates (condition, subject, body) VALUES
('not_tried',
 'Quick question about {Company}, {FirstName}',
 '<p>Hi {FirstName},</p><p>I noticed you opened the demo I built for {Company} but didn''t get a chance to try the AI agent. No worries — it takes 30 seconds.</p><p><a href="{DemoURL}">Click here to try it now →</a></p><p>Curious what you think.</p>'),
('tried_voice_agent',
 'Thoughts on the AI voice agent, {FirstName}?',
 '<p>Hi {FirstName},</p><p>Saw you tested the voice agent on the demo for {Company}. What did you think?</p><p>Happy to tweak the script, voice, or flow for {Industry} specifically — just hit reply.</p><p><a href="{DemoURL}">Demo link if you want another go →</a></p>'),
('tried_chatbot',
 'How did the chatbot feel for {Company}?',
 '<p>Hi {FirstName},</p><p>Thanks for trying the AI chatbot on your {Company} demo. Curious — did it answer the way you''d want it to for your customers?</p><p>I can fine-tune it for {Industry} workflows if you reply with what felt off.</p><p><a href="{DemoURL}">Open the demo again →</a></p>');
