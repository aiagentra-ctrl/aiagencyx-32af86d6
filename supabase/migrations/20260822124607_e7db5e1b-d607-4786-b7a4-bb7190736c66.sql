INSERT INTO public.app_config (key, value)
VALUES ('office_email', 'aiagentron@gmail.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;