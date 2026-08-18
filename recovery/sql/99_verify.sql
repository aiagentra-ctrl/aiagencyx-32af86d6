-- ============================================================
-- 99 — POST-RESTORE VERIFICATION
-- Run LAST. Raises an exception if the restore is incomplete.
-- ============================================================

DO $$
DECLARE
  v_tables   int;
  v_funcs    int;
  v_triggers int;
  v_policies int;
  v_norls    text;
  v_nogrant  text;
  v_seed     int;
BEGIN
  SELECT count(*) INTO v_tables FROM pg_tables WHERE schemaname = 'public';

  SELECT count(*) INTO v_funcs
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prolang <> (SELECT oid FROM pg_language WHERE lanname = 'c');

  SELECT count(*) INTO v_triggers
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal;

  SELECT count(*) INTO v_policies FROM pg_policies WHERE schemaname = 'public';

  RAISE NOTICE 'tables=%  functions=%  triggers=%  policies=%',
    v_tables, v_funcs, v_triggers, v_policies;

  -- Expected baseline captured from the source project.
  IF v_tables   < 55  THEN RAISE EXCEPTION 'MISSING TABLES: expected >= 55, found %', v_tables; END IF;
  IF v_funcs    < 16  THEN RAISE EXCEPTION 'MISSING FUNCTIONS: expected >= 16, found %', v_funcs; END IF;
  IF v_triggers < 25  THEN RAISE EXCEPTION 'MISSING TRIGGERS: expected >= 25, found %', v_triggers; END IF;
  IF v_policies < 126 THEN RAISE EXCEPTION 'MISSING POLICIES: expected >= 126, found %', v_policies; END IF;

  -- Every public table must have RLS enabled.
  SELECT string_agg(c.relname, ', ') INTO v_norls
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
  IF v_norls IS NOT NULL THEN RAISE EXCEPTION 'RLS NOT ENABLED ON: %', v_norls; END IF;

  -- Every public table must be reachable by service_role (edge functions).
  SELECT string_agg(c.relname, ', ') INTO v_nogrant
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND NOT has_table_privilege('service_role', c.oid, 'SELECT');
  IF v_nogrant IS NOT NULL THEN RAISE EXCEPTION 'MISSING service_role GRANT ON: %', v_nogrant; END IF;

  -- Config seed must be present, otherwise the reply/follow-up engine is dead.
  SELECT (SELECT count(*) FROM public.reply_templates)
       + (SELECT count(*) FROM public.inbox_prompts)
       + (SELECT count(*) FROM public.followup_rules)
       + (SELECT count(*) FROM public.node_prompts)
    INTO v_seed;
  IF v_seed = 0 THEN RAISE EXCEPTION 'CONFIG SEED MISSING: run 07_seed_config.sql'; END IF;

  RAISE NOTICE 'RESTORE VERIFIED OK (seed rows in core config tables: %)', v_seed;
END $$;
