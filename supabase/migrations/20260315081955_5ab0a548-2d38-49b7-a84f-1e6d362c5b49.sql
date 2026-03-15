
CREATE POLICY "Anyone can delete chatbots" ON public.chatbots FOR DELETE TO anon, authenticated USING (true);
