
-- Broaden follow-up tables so the admin panel (uses publishable/anon key) can access them.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'follow_up_sequences_templates',
    'follow_up_steps',
    'follow_up_enrollments',
    'followup_events',
    'followup_rules'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);

    EXECUTE format('DROP POLICY IF EXISTS "Anyone read %1$I" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Anyone read %1$I" ON public.%1$I FOR SELECT TO anon, authenticated USING (true)', t);

    EXECUTE format('DROP POLICY IF EXISTS "Anyone write %1$I" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Anyone write %1$I" ON public.%1$I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
