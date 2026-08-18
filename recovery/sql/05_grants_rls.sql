-- ============================================================
-- 05 — GRANTS, ROW LEVEL SECURITY, POLICIES
-- Data API grants, RLS enablement and every policy. Required: without GRANTs the API returns permission errors.
-- Generated from the production database (schema-only, no lead data).
-- ============================================================

SET statement_timeout = 0;
SET client_min_messages = warning;
SET search_path = public, extensions;

-- chatbots Anon can insert chatbots  [POLICY]
CREATE POLICY "Anon can insert chatbots" ON public.chatbots FOR INSERT TO authenticated, anon WITH CHECK (true);

-- chatbots Anon can update chatbots  [POLICY]
CREATE POLICY "Anon can update chatbots" ON public.chatbots FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

-- chatbots Anyone can delete chatbots  [POLICY]
CREATE POLICY "Anyone can delete chatbots" ON public.chatbots FOR DELETE TO authenticated, anon USING (true);

-- chatbot_conversations Anyone can insert conversations  [POLICY]
CREATE POLICY "Anyone can insert conversations" ON public.chatbot_conversations FOR INSERT TO authenticated, anon WITH CHECK (true);

-- link_events Anyone can insert events  [POLICY]
CREATE POLICY "Anyone can insert events" ON public.link_events FOR INSERT TO authenticated, anon WITH CHECK (true);

-- follow_up_templates Anyone can insert follow_up_templates  [POLICY]
CREATE POLICY "Anyone can insert follow_up_templates" ON public.follow_up_templates FOR INSERT TO authenticated, anon WITH CHECK (true);

-- site_settings Anyone can insert site_settings  [POLICY]
CREATE POLICY "Anyone can insert site_settings" ON public.site_settings FOR INSERT TO authenticated, anon WITH CHECK (true);

-- industry_templates Anyone can read active templates  [POLICY]
CREATE POLICY "Anyone can read active templates" ON public.industry_templates FOR SELECT TO authenticated, anon USING (true);

-- chatbots Anyone can read chatbots  [POLICY]
CREATE POLICY "Anyone can read chatbots" ON public.chatbots FOR SELECT TO authenticated, anon USING (true);

-- chatbot_conversations Anyone can read conversations  [POLICY]
CREATE POLICY "Anyone can read conversations" ON public.chatbot_conversations FOR SELECT TO authenticated, anon USING (true);

-- demo_pages Anyone can read demo pages  [POLICY]
CREATE POLICY "Anyone can read demo pages" ON public.demo_pages FOR SELECT TO authenticated, anon USING (true);

-- email_queue Anyone can read email_queue  [POLICY]
CREATE POLICY "Anyone can read email_queue" ON public.email_queue FOR SELECT TO authenticated, anon USING (true);

-- link_events Anyone can read events  [POLICY]
CREATE POLICY "Anyone can read events" ON public.link_events FOR SELECT TO authenticated, anon USING (true);

-- follow_up_templates Anyone can read follow_up_templates  [POLICY]
CREATE POLICY "Anyone can read follow_up_templates" ON public.follow_up_templates FOR SELECT TO authenticated, anon USING (true);

-- knowledge_base_entries Anyone can read kb entries  [POLICY]
CREATE POLICY "Anyone can read kb entries" ON public.knowledge_base_entries FOR SELECT TO authenticated, anon USING (true);

-- knowledge_base_jobs Anyone can read kb jobs  [POLICY]
CREATE POLICY "Anyone can read kb jobs" ON public.knowledge_base_jobs FOR SELECT TO authenticated, anon USING (true);

-- products Anyone can read products  [POLICY]
CREATE POLICY "Anyone can read products" ON public.products FOR SELECT TO authenticated, anon USING (true);

-- site_settings Anyone can read site_settings  [POLICY]
CREATE POLICY "Anyone can read site_settings" ON public.site_settings FOR SELECT TO authenticated, anon USING (true);

-- chatbot_conversations Anyone can update conversations  [POLICY]
CREATE POLICY "Anyone can update conversations" ON public.chatbot_conversations FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

-- email_queue Anyone can update email_queue  [POLICY]
CREATE POLICY "Anyone can update email_queue" ON public.email_queue FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

-- follow_up_templates Anyone can update follow_up_templates  [POLICY]
CREATE POLICY "Anyone can update follow_up_templates" ON public.follow_up_templates FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

-- site_settings Anyone can update site_settings  [POLICY]
CREATE POLICY "Anyone can update site_settings" ON public.site_settings FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

-- demo_pages Anyone can update views  [POLICY]
CREATE POLICY "Anyone can update views" ON public.demo_pages FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

-- ecommerce_landing_template Anyone can view landing template  [POLICY]
CREATE POLICY "Anyone can view landing template" ON public.ecommerce_landing_template FOR SELECT USING (true);

-- followup_settings Anyone insert followup_settings  [POLICY]
CREATE POLICY "Anyone insert followup_settings" ON public.followup_settings FOR INSERT TO authenticated, anon WITH CHECK (true);

-- follow_up_enrollments Anyone read follow_up_enrollments  [POLICY]
CREATE POLICY "Anyone read follow_up_enrollments" ON public.follow_up_enrollments FOR SELECT TO authenticated, anon USING (true);

-- follow_up_sequences_templates Anyone read follow_up_sequences_templates  [POLICY]
CREATE POLICY "Anyone read follow_up_sequences_templates" ON public.follow_up_sequences_templates FOR SELECT TO authenticated, anon USING (true);

-- follow_up_steps Anyone read follow_up_steps  [POLICY]
CREATE POLICY "Anyone read follow_up_steps" ON public.follow_up_steps FOR SELECT TO authenticated, anon USING (true);

-- followup_events Anyone read followup_events  [POLICY]
CREATE POLICY "Anyone read followup_events" ON public.followup_events FOR SELECT TO authenticated, anon USING (true);

-- followup_rules Anyone read followup_rules  [POLICY]
CREATE POLICY "Anyone read followup_rules" ON public.followup_rules FOR SELECT TO authenticated, anon USING (true);

-- followup_settings Anyone read followup_settings  [POLICY]
CREATE POLICY "Anyone read followup_settings" ON public.followup_settings FOR SELECT TO authenticated, anon USING (true);

-- followup_settings Anyone update followup_settings  [POLICY]
CREATE POLICY "Anyone update followup_settings" ON public.followup_settings FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

-- follow_up_enrollments Anyone write follow_up_enrollments  [POLICY]
CREATE POLICY "Anyone write follow_up_enrollments" ON public.follow_up_enrollments TO authenticated, anon USING (true) WITH CHECK (true);

-- follow_up_sequences_templates Anyone write follow_up_sequences_templates  [POLICY]
CREATE POLICY "Anyone write follow_up_sequences_templates" ON public.follow_up_sequences_templates TO authenticated, anon USING (true) WITH CHECK (true);

-- follow_up_steps Anyone write follow_up_steps  [POLICY]
CREATE POLICY "Anyone write follow_up_steps" ON public.follow_up_steps TO authenticated, anon USING (true) WITH CHECK (true);

-- followup_events Anyone write followup_events  [POLICY]
CREATE POLICY "Anyone write followup_events" ON public.followup_events TO authenticated, anon USING (true) WITH CHECK (true);

-- followup_rules Anyone write followup_rules  [POLICY]
CREATE POLICY "Anyone write followup_rules" ON public.followup_rules TO authenticated, anon USING (true) WITH CHECK (true);

-- industry_templates Authenticated can manage templates  [POLICY]
CREATE POLICY "Authenticated can manage templates" ON public.industry_templates TO authenticated USING (true) WITH CHECK (true);

-- demo_pages Authenticated users can insert demo pages  [POLICY]
CREATE POLICY "Authenticated users can insert demo pages" ON public.demo_pages FOR INSERT TO authenticated WITH CHECK (true);

-- activity_logs Full access on activity_logs  [POLICY]
CREATE POLICY "Full access on activity_logs" ON public.activity_logs TO authenticated, anon, service_role USING (true) WITH CHECK (true);

-- api_providers Full access on api_providers  [POLICY]
CREATE POLICY "Full access on api_providers" ON public.api_providers TO authenticated, anon, service_role USING (true) WITH CHECK (true);

-- lead_follow_ups Full access on lead_follow_ups  [POLICY]
CREATE POLICY "Full access on lead_follow_ups" ON public.lead_follow_ups TO authenticated, anon, service_role USING (true) WITH CHECK (true);

-- leads Full access on leads  [POLICY]
CREATE POLICY "Full access on leads" ON public.leads TO authenticated, anon, service_role USING (true) WITH CHECK (true);

-- scraped_data Public read  [POLICY]
CREATE POLICY "Public read" ON public.scraped_data FOR SELECT TO authenticated, anon USING (true);

-- link_events Service role full  [POLICY]
CREATE POLICY "Service role full" ON public.link_events TO service_role USING (true) WITH CHECK (true);

-- demo_pages Service role full access  [POLICY]
CREATE POLICY "Service role full access" ON public.demo_pages TO service_role USING (true) WITH CHECK (true);

-- scraped_data Service role full access  [POLICY]
CREATE POLICY "Service role full access" ON public.scraped_data TO service_role USING (true) WITH CHECK (true);

-- follow_up_templates Service role full access follow_up_templates  [POLICY]
CREATE POLICY "Service role full access follow_up_templates" ON public.follow_up_templates TO service_role USING (true) WITH CHECK (true);

-- knowledge_base_entries Service role full access kb entries  [POLICY]
CREATE POLICY "Service role full access kb entries" ON public.knowledge_base_entries TO service_role USING (true) WITH CHECK (true);

-- knowledge_base_jobs Service role full access kb jobs  [POLICY]
CREATE POLICY "Service role full access kb jobs" ON public.knowledge_base_jobs TO service_role USING (true) WITH CHECK (true);

-- chatbots Service role full access on chatbots  [POLICY]
CREATE POLICY "Service role full access on chatbots" ON public.chatbots TO service_role USING (true) WITH CHECK (true);

-- chatbot_conversations Service role full access on conversations  [POLICY]
CREATE POLICY "Service role full access on conversations" ON public.chatbot_conversations TO service_role USING (true) WITH CHECK (true);

-- demo_leads Service role full access on demo_leads  [POLICY]
CREATE POLICY "Service role full access on demo_leads" ON public.demo_leads TO service_role USING (true) WITH CHECK (true);

-- manyreach_logs Service role full access on manyreach_logs  [POLICY]
CREATE POLICY "Service role full access on manyreach_logs" ON public.manyreach_logs TO service_role USING (true) WITH CHECK (true);

-- products Service role full access on products  [POLICY]
CREATE POLICY "Service role full access on products" ON public.products TO service_role USING (true) WITH CHECK (true);

-- industry_templates Service role full access on templates  [POLICY]
CREATE POLICY "Service role full access on templates" ON public.industry_templates TO service_role USING (true) WITH CHECK (true);

-- site_settings Service role full access site_settings  [POLICY]
CREATE POLICY "Service role full access site_settings" ON public.site_settings TO service_role USING (true) WITH CHECK (true);

-- email_queue Service role full email_queue  [POLICY]
CREATE POLICY "Service role full email_queue" ON public.email_queue TO service_role USING (true) WITH CHECK (true);

-- followup_settings Service role full followup_settings  [POLICY]
CREATE POLICY "Service role full followup_settings" ON public.followup_settings TO service_role USING (true) WITH CHECK (true);

-- ecommerce_landing_template Service role manages landing template  [POLICY]
CREATE POLICY "Service role manages landing template" ON public.ecommerce_landing_template USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));

-- ab_test_results  [ROW SECURITY]
ALTER TABLE public.ab_test_results ENABLE ROW LEVEL SECURITY;

-- activity_logs  [ROW SECURITY]
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- api_providers  [ROW SECURITY]
ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;

-- audit_log  [ROW SECURITY]
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- audit_log auth insert audit_log  [POLICY]
CREATE POLICY "auth insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- system_health_checks auth insert health  [POLICY]
CREATE POLICY "auth insert health" ON public.system_health_checks FOR INSERT TO authenticated WITH CHECK (true);

-- ab_test_results auth manage ab_test  [POLICY]
CREATE POLICY "auth manage ab_test" ON public.ab_test_results TO authenticated USING (true) WITH CHECK (true);

-- sequence_analytics_cache auth manage analytics cache  [POLICY]
CREATE POLICY "auth manage analytics cache" ON public.sequence_analytics_cache TO authenticated USING (true) WITH CHECK (true);

-- demo_job_steps auth manage demo_job_steps  [POLICY]
CREATE POLICY "auth manage demo_job_steps" ON public.demo_job_steps TO authenticated USING (true) WITH CHECK (true);

-- demo_jobs auth manage demo_jobs  [POLICY]
CREATE POLICY "auth manage demo_jobs" ON public.demo_jobs TO authenticated USING (true) WITH CHECK (true);

-- prompt_versions auth manage prompt_versions  [POLICY]
CREATE POLICY "auth manage prompt_versions" ON public.prompt_versions TO authenticated USING (true) WITH CHECK (true);

-- prompt_improvement_suggestions auth manage suggestions  [POLICY]
CREATE POLICY "auth manage suggestions" ON public.prompt_improvement_suggestions TO authenticated USING (true) WITH CHECK (true);

-- unsubscribed_prospects auth manage unsubs  [POLICY]
CREATE POLICY "auth manage unsubs" ON public.unsubscribed_prospects TO authenticated USING (true) WITH CHECK (true);

-- audit_log auth read audit_log  [POLICY]
CREATE POLICY "auth read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (true);

-- chatbot_messages auth read chatbot_messages  [POLICY]
CREATE POLICY "auth read chatbot_messages" ON public.chatbot_messages FOR SELECT TO authenticated USING (true);

-- chatbot_sessions auth read chatbot_sessions  [POLICY]
CREATE POLICY "auth read chatbot_sessions" ON public.chatbot_sessions FOR SELECT TO authenticated USING (true);

-- demo_open_log auth read dol  [POLICY]
CREATE POLICY "auth read dol" ON public.demo_open_log FOR SELECT TO authenticated USING (true);

-- follow_up_enrollments auth read enrollments  [POLICY]
CREATE POLICY "auth read enrollments" ON public.follow_up_enrollments FOR SELECT TO authenticated USING (true);

-- followup_events auth read followup_events  [POLICY]
CREATE POLICY "auth read followup_events" ON public.followup_events FOR SELECT TO authenticated USING (true);

-- followup_rules auth read followup_rules  [POLICY]
CREATE POLICY "auth read followup_rules" ON public.followup_rules FOR SELECT TO authenticated USING (true);

-- system_health_checks auth read health  [POLICY]
CREATE POLICY "auth read health" ON public.system_health_checks FOR SELECT TO authenticated USING (true);

-- inbox_demos auth read inbox_demos  [POLICY]
CREATE POLICY "auth read inbox_demos" ON public.inbox_demos FOR SELECT TO authenticated USING (true);

-- inbox_messages auth read inbox_messages  [POLICY]
CREATE POLICY "auth read inbox_messages" ON public.inbox_messages FOR SELECT TO authenticated USING (true);

-- inbox_prompts auth read inbox_prompts  [POLICY]
CREATE POLICY "auth read inbox_prompts" ON public.inbox_prompts FOR SELECT TO authenticated USING (true);

-- node_prompts auth read node_prompts  [POLICY]
CREATE POLICY "auth read node_prompts" ON public.node_prompts FOR SELECT TO authenticated USING (true);

-- notifications auth read notif  [POLICY]
CREATE POLICY "auth read notif" ON public.notifications FOR SELECT TO authenticated USING (true);

-- prospect_activity_times auth read pat  [POLICY]
CREATE POLICY "auth read pat" ON public.prospect_activity_times FOR SELECT TO authenticated USING (true);

-- prospect_memory auth read prospect_memory  [POLICY]
CREATE POLICY "auth read prospect_memory" ON public.prospect_memory FOR SELECT TO authenticated USING (true);

-- prospects auth read prospects  [POLICY]
CREATE POLICY "auth read prospects" ON public.prospects FOR SELECT TO authenticated USING (true);

-- follow_up_steps auth read sequence steps  [POLICY]
CREATE POLICY "auth read sequence steps" ON public.follow_up_steps FOR SELECT TO authenticated USING (true);

-- follow_up_sequences_templates auth read sequences  [POLICY]
CREATE POLICY "auth read sequences" ON public.follow_up_sequences_templates FOR SELECT TO authenticated USING (true);

-- variable_fallbacks auth read vf  [POLICY]
CREATE POLICY "auth read vf" ON public.variable_fallbacks FOR SELECT TO authenticated USING (true);

-- demo_open_log auth write dol  [POLICY]
CREATE POLICY "auth write dol" ON public.demo_open_log TO authenticated USING (true) WITH CHECK (true);

-- follow_up_enrollments auth write enrollments  [POLICY]
CREATE POLICY "auth write enrollments" ON public.follow_up_enrollments TO authenticated USING (true) WITH CHECK (true);

-- followup_events auth write followup_events  [POLICY]
CREATE POLICY "auth write followup_events" ON public.followup_events TO authenticated USING (true) WITH CHECK (true);

-- followup_rules auth write followup_rules  [POLICY]
CREATE POLICY "auth write followup_rules" ON public.followup_rules TO authenticated USING (true) WITH CHECK (true);

-- inbox_demos auth write inbox_demos  [POLICY]
CREATE POLICY "auth write inbox_demos" ON public.inbox_demos TO authenticated USING (true) WITH CHECK (true);

-- inbox_messages auth write inbox_messages  [POLICY]
CREATE POLICY "auth write inbox_messages" ON public.inbox_messages TO authenticated USING (true) WITH CHECK (true);

-- inbox_prompts auth write inbox_prompts  [POLICY]
CREATE POLICY "auth write inbox_prompts" ON public.inbox_prompts TO authenticated USING (true) WITH CHECK (true);

-- node_prompts auth write node_prompts  [POLICY]
CREATE POLICY "auth write node_prompts" ON public.node_prompts TO authenticated USING (true) WITH CHECK (true);

-- notifications auth write notif  [POLICY]
CREATE POLICY "auth write notif" ON public.notifications TO authenticated USING (true) WITH CHECK (true);

-- prospect_activity_times auth write pat  [POLICY]
CREATE POLICY "auth write pat" ON public.prospect_activity_times TO authenticated USING (true) WITH CHECK (true);

-- prospect_memory auth write prospect_memory  [POLICY]
CREATE POLICY "auth write prospect_memory" ON public.prospect_memory TO authenticated USING (true) WITH CHECK (true);

-- prospects auth write prospects  [POLICY]
CREATE POLICY "auth write prospects" ON public.prospects TO authenticated USING (true) WITH CHECK (true);

-- follow_up_steps auth write sequence steps  [POLICY]
CREATE POLICY "auth write sequence steps" ON public.follow_up_steps TO authenticated USING (true) WITH CHECK (true);

-- follow_up_sequences_templates auth write sequences  [POLICY]
CREATE POLICY "auth write sequences" ON public.follow_up_sequences_templates TO authenticated USING (true) WITH CHECK (true);

-- variable_fallbacks auth write vf  [POLICY]
CREATE POLICY "auth write vf" ON public.variable_fallbacks TO authenticated USING (true) WITH CHECK (true);

-- chatbot_conversations  [ROW SECURITY]
ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;

-- chatbot_messages  [ROW SECURITY]
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;

-- chatbot_sessions  [ROW SECURITY]
ALTER TABLE public.chatbot_sessions ENABLE ROW LEVEL SECURITY;

-- chatbots  [ROW SECURITY]
ALTER TABLE public.chatbots ENABLE ROW LEVEL SECURITY;

-- demo_job_steps  [ROW SECURITY]
ALTER TABLE public.demo_job_steps ENABLE ROW LEVEL SECURITY;

-- demo_jobs  [ROW SECURITY]
ALTER TABLE public.demo_jobs ENABLE ROW LEVEL SECURITY;

-- demo_leads  [ROW SECURITY]
ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;

-- demo_open_log  [ROW SECURITY]
ALTER TABLE public.demo_open_log ENABLE ROW LEVEL SECURITY;

-- demo_pages  [ROW SECURITY]
ALTER TABLE public.demo_pages ENABLE ROW LEVEL SECURITY;

-- ecommerce_landing_template  [ROW SECURITY]
ALTER TABLE public.ecommerce_landing_template ENABLE ROW LEVEL SECURITY;

-- error_events ee_ack_auth  [POLICY]
CREATE POLICY ee_ack_auth ON public.error_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- error_events ee_read_auth  [POLICY]
CREATE POLICY ee_read_auth ON public.error_events FOR SELECT TO authenticated USING (true);

-- error_events ee_service_all  [POLICY]
CREATE POLICY ee_service_all ON public.error_events TO service_role USING (true) WITH CHECK (true);

-- email_queue  [ROW SECURITY]
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- error_events  [ROW SECURITY]
ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;

-- follow_up_enrollments  [ROW SECURITY]
ALTER TABLE public.follow_up_enrollments ENABLE ROW LEVEL SECURITY;

-- follow_up_sequences_templates  [ROW SECURITY]
ALTER TABLE public.follow_up_sequences_templates ENABLE ROW LEVEL SECURITY;

-- follow_up_steps  [ROW SECURITY]
ALTER TABLE public.follow_up_steps ENABLE ROW LEVEL SECURITY;

-- follow_up_templates  [ROW SECURITY]
ALTER TABLE public.follow_up_templates ENABLE ROW LEVEL SECURITY;

-- followup_events  [ROW SECURITY]
ALTER TABLE public.followup_events ENABLE ROW LEVEL SECURITY;

-- followup_rules  [ROW SECURITY]
ALTER TABLE public.followup_rules ENABLE ROW LEVEL SECURITY;

-- followup_settings  [ROW SECURITY]
ALTER TABLE public.followup_settings ENABLE ROW LEVEL SECURITY;

-- inbox_demos  [ROW SECURITY]
ALTER TABLE public.inbox_demos ENABLE ROW LEVEL SECURITY;

-- inbox_messages  [ROW SECURITY]
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

-- inbox_prompts  [ROW SECURITY]
ALTER TABLE public.inbox_prompts ENABLE ROW LEVEL SECURITY;

-- industry_templates  [ROW SECURITY]
ALTER TABLE public.industry_templates ENABLE ROW LEVEL SECURITY;

-- knowledge_base_entries  [ROW SECURITY]
ALTER TABLE public.knowledge_base_entries ENABLE ROW LEVEL SECURITY;

-- knowledge_base_jobs  [ROW SECURITY]
ALTER TABLE public.knowledge_base_jobs ENABLE ROW LEVEL SECURITY;

-- lead_follow_ups  [ROW SECURITY]
ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;

-- leads  [ROW SECURITY]
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- link_events  [ROW SECURITY]
ALTER TABLE public.link_events ENABLE ROW LEVEL SECURITY;

-- manyreach_logs  [ROW SECURITY]
ALTER TABLE public.manyreach_logs ENABLE ROW LEVEL SECURITY;

-- node_prompts  [ROW SECURITY]
ALTER TABLE public.node_prompts ENABLE ROW LEVEL SECURITY;

-- notifications  [ROW SECURITY]
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- pipeline_events pe_read_auth  [POLICY]
CREATE POLICY pe_read_auth ON public.pipeline_events FOR SELECT TO authenticated USING (true);

-- pipeline_events pe_service_all  [POLICY]
CREATE POLICY pe_service_all ON public.pipeline_events TO service_role USING (true) WITH CHECK (true);

-- pipeline_events  [ROW SECURITY]
ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;

-- pipeline_locks  [ROW SECURITY]
ALTER TABLE public.pipeline_locks ENABLE ROW LEVEL SECURITY;

-- products  [ROW SECURITY]
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- prompt_improvement_suggestions  [ROW SECURITY]
ALTER TABLE public.prompt_improvement_suggestions ENABLE ROW LEVEL SECURITY;

-- prompt_versions  [ROW SECURITY]
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;

-- property_listings  [ROW SECURITY]
ALTER TABLE public.property_listings ENABLE ROW LEVEL SECURITY;

-- property_listings property_listings authenticated manage  [POLICY]
CREATE POLICY "property_listings authenticated manage" ON public.property_listings TO authenticated USING (true) WITH CHECK (true);

-- property_listings property_listings public read  [POLICY]
CREATE POLICY "property_listings public read" ON public.property_listings FOR SELECT USING (true);

-- prospect_activity_times  [ROW SECURITY]
ALTER TABLE public.prospect_activity_times ENABLE ROW LEVEL SECURITY;

-- prospect_memory  [ROW SECURITY]
ALTER TABLE public.prospect_memory ENABLE ROW LEVEL SECURITY;

-- prospects  [ROW SECURITY]
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

-- realestate_profiles  [ROW SECURITY]
ALTER TABLE public.realestate_profiles ENABLE ROW LEVEL SECURITY;

-- realestate_profiles realestate_profiles authenticated manage  [POLICY]
CREATE POLICY "realestate_profiles authenticated manage" ON public.realestate_profiles TO authenticated USING (true) WITH CHECK (true);

-- realestate_profiles realestate_profiles public read  [POLICY]
CREATE POLICY "realestate_profiles public read" ON public.realestate_profiles FOR SELECT USING (true);

-- reply_templates  [ROW SECURITY]
ALTER TABLE public.reply_templates ENABLE ROW LEVEL SECURITY;

-- reply_templates rt_read_auth  [POLICY]
CREATE POLICY rt_read_auth ON public.reply_templates FOR SELECT TO authenticated USING (true);

-- reply_templates rt_service_all  [POLICY]
CREATE POLICY rt_service_all ON public.reply_templates TO service_role USING (true) WITH CHECK (true);

-- reply_templates rt_write_auth  [POLICY]
CREATE POLICY rt_write_auth ON public.reply_templates TO authenticated USING (true) WITH CHECK (true);

-- scraped_data  [ROW SECURITY]
ALTER TABLE public.scraped_data ENABLE ROW LEVEL SECURITY;

-- sequence_analytics_cache  [ROW SECURITY]
ALTER TABLE public.sequence_analytics_cache ENABLE ROW LEVEL SECURITY;

-- chatbot_messages service manage chatbot_messages  [POLICY]
CREATE POLICY "service manage chatbot_messages" ON public.chatbot_messages TO service_role USING (true) WITH CHECK (true);

-- chatbot_sessions service manage chatbot_sessions  [POLICY]
CREATE POLICY "service manage chatbot_sessions" ON public.chatbot_sessions TO service_role USING (true) WITH CHECK (true);

-- demo_job_steps service manage demo_job_steps  [POLICY]
CREATE POLICY "service manage demo_job_steps" ON public.demo_job_steps TO service_role USING (true) WITH CHECK (true);

-- demo_jobs service manage demo_jobs  [POLICY]
CREATE POLICY "service manage demo_jobs" ON public.demo_jobs TO service_role USING (true) WITH CHECK (true);

-- prompt_versions service manage prompt_versions  [POLICY]
CREATE POLICY "service manage prompt_versions" ON public.prompt_versions TO service_role USING (true) WITH CHECK (true);

-- prompt_improvement_suggestions service manage suggestions  [POLICY]
CREATE POLICY "service manage suggestions" ON public.prompt_improvement_suggestions TO service_role USING (true) WITH CHECK (true);

-- webhook_endpoints service role manages webhook endpoints  [POLICY]
CREATE POLICY "service role manages webhook endpoints" ON public.webhook_endpoints USING (false) WITH CHECK (false);

-- webhook_dedupe service role only dedupe  [POLICY]
CREATE POLICY "service role only dedupe" ON public.webhook_dedupe USING (false) WITH CHECK (false);

-- pipeline_locks service role only locks  [POLICY]
CREATE POLICY "service role only locks" ON public.pipeline_locks USING (false) WITH CHECK (false);

-- site_settings  [ROW SECURITY]
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- system_health_checks  [ROW SECURITY]
ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;

-- unsubscribed_prospects  [ROW SECURITY]
ALTER TABLE public.unsubscribed_prospects ENABLE ROW LEVEL SECURITY;

-- variable_fallbacks  [ROW SECURITY]
ALTER TABLE public.variable_fallbacks ENABLE ROW LEVEL SECURITY;

-- webhook_dedupe  [ROW SECURITY]
ALTER TABLE public.webhook_dedupe ENABLE ROW LEVEL SECURITY;

-- webhook_endpoints  [ROW SECURITY]
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- webhook_logs  [ROW SECURITY]
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- webhook_logs wl_read_auth  [POLICY]
CREATE POLICY wl_read_auth ON public.webhook_logs FOR SELECT TO authenticated USING (true);

-- webhook_logs wl_service_all  [POLICY]
CREATE POLICY wl_service_all ON public.webhook_logs TO service_role USING (true) WITH CHECK (true);

-- SCHEMA public  [ACL]
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO sandbox_exec;

-- FUNCTION cancel_followups_on_booking()  [ACL]
GRANT ALL ON FUNCTION public.cancel_followups_on_booking() TO anon;
GRANT ALL ON FUNCTION public.cancel_followups_on_booking() TO authenticated;
GRANT ALL ON FUNCTION public.cancel_followups_on_booking() TO service_role;

-- FUNCTION cancel_followups_on_reply()  [ACL]
GRANT ALL ON FUNCTION public.cancel_followups_on_reply() TO anon;
GRANT ALL ON FUNCTION public.cancel_followups_on_reply() TO authenticated;
GRANT ALL ON FUNCTION public.cancel_followups_on_reply() TO service_role;

-- FUNCTION get_best_send_time(p_prospect_id uuid)  [ACL]
GRANT ALL ON FUNCTION public.get_best_send_time(p_prospect_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_best_send_time(p_prospect_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_best_send_time(p_prospect_id uuid) TO service_role;

-- FUNCTION match_kb_entries(p_chatbot_id uuid, p_query_embedding public.vector, p_match_count integer)  [ACL]
GRANT ALL ON FUNCTION public.match_kb_entries(p_chatbot_id uuid, p_query_embedding public.vector, p_match_count integer) TO anon;
GRANT ALL ON FUNCTION public.match_kb_entries(p_chatbot_id uuid, p_query_embedding public.vector, p_match_count integer) TO authenticated;
GRANT ALL ON FUNCTION public.match_kb_entries(p_chatbot_id uuid, p_query_embedding public.vector, p_match_count integer) TO service_role;

-- FUNCTION match_listings_hybrid(p_chatbot_id uuid, p_query_embedding public.vector, p_query_text text, p_match_count integer, p_filters jsonb)  [ACL]
GRANT ALL ON FUNCTION public.match_listings_hybrid(p_chatbot_id uuid, p_query_embedding public.vector, p_query_text text, p_match_count integer, p_filters jsonb) TO anon;
GRANT ALL ON FUNCTION public.match_listings_hybrid(p_chatbot_id uuid, p_query_embedding public.vector, p_query_text text, p_match_count integer, p_filters jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.match_listings_hybrid(p_chatbot_id uuid, p_query_embedding public.vector, p_query_text text, p_match_count integer, p_filters jsonb) TO service_role;

-- FUNCTION match_products(p_chatbot_id uuid, p_query_embedding public.vector, p_match_count integer)  [ACL]
GRANT ALL ON FUNCTION public.match_products(p_chatbot_id uuid, p_query_embedding public.vector, p_match_count integer) TO anon;
GRANT ALL ON FUNCTION public.match_products(p_chatbot_id uuid, p_query_embedding public.vector, p_match_count integer) TO authenticated;
GRANT ALL ON FUNCTION public.match_products(p_chatbot_id uuid, p_query_embedding public.vector, p_match_count integer) TO service_role;

-- FUNCTION match_products_hybrid(p_chatbot_id uuid, p_query_embedding public.vector, p_query_text text, p_match_count integer, p_filters jsonb)  [ACL]
GRANT ALL ON FUNCTION public.match_products_hybrid(p_chatbot_id uuid, p_query_embedding public.vector, p_query_text text, p_match_count integer, p_filters jsonb) TO anon;
GRANT ALL ON FUNCTION public.match_products_hybrid(p_chatbot_id uuid, p_query_embedding public.vector, p_query_text text, p_match_count integer, p_filters jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.match_products_hybrid(p_chatbot_id uuid, p_query_embedding public.vector, p_query_text text, p_match_count integer, p_filters jsonb) TO service_role;

-- FUNCTION mirror_demo_lead_to_prospect()  [ACL]
GRANT ALL ON FUNCTION public.mirror_demo_lead_to_prospect() TO anon;
GRANT ALL ON FUNCTION public.mirror_demo_lead_to_prospect() TO authenticated;
GRANT ALL ON FUNCTION public.mirror_demo_lead_to_prospect() TO service_role;

-- FUNCTION on_incoming_message_track()  [ACL]
GRANT ALL ON FUNCTION public.on_incoming_message_track() TO anon;
GRANT ALL ON FUNCTION public.on_incoming_message_track() TO authenticated;
GRANT ALL ON FUNCTION public.on_incoming_message_track() TO service_role;

-- FUNCTION on_link_event_track_prospect()  [ACL]
GRANT ALL ON FUNCTION public.on_link_event_track_prospect() TO anon;
GRANT ALL ON FUNCTION public.on_link_event_track_prospect() TO authenticated;
GRANT ALL ON FUNCTION public.on_link_event_track_prospect() TO service_role;

-- FUNCTION release_pipeline_lock(p_key text, p_holder text)  [ACL]
GRANT ALL ON FUNCTION public.release_pipeline_lock(p_key text, p_holder text) TO anon;
GRANT ALL ON FUNCTION public.release_pipeline_lock(p_key text, p_holder text) TO authenticated;
GRANT ALL ON FUNCTION public.release_pipeline_lock(p_key text, p_holder text) TO service_role;

-- FUNCTION touch_demo_leads_updated_at()  [ACL]
GRANT ALL ON FUNCTION public.touch_demo_leads_updated_at() TO anon;
GRANT ALL ON FUNCTION public.touch_demo_leads_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.touch_demo_leads_updated_at() TO service_role;

-- FUNCTION touch_updated_at_generic()  [ACL]
GRANT ALL ON FUNCTION public.touch_updated_at_generic() TO anon;
GRANT ALL ON FUNCTION public.touch_updated_at_generic() TO authenticated;
GRANT ALL ON FUNCTION public.touch_updated_at_generic() TO service_role;

-- FUNCTION touch_updated_at_inbox()  [ACL]
GRANT ALL ON FUNCTION public.touch_updated_at_inbox() TO anon;
GRANT ALL ON FUNCTION public.touch_updated_at_inbox() TO authenticated;
GRANT ALL ON FUNCTION public.touch_updated_at_inbox() TO service_role;

-- FUNCTION try_acquire_pipeline_lock(p_key text, p_holder text, p_ttl_seconds integer)  [ACL]
GRANT ALL ON FUNCTION public.try_acquire_pipeline_lock(p_key text, p_holder text, p_ttl_seconds integer) TO anon;
GRANT ALL ON FUNCTION public.try_acquire_pipeline_lock(p_key text, p_holder text, p_ttl_seconds integer) TO authenticated;
GRANT ALL ON FUNCTION public.try_acquire_pipeline_lock(p_key text, p_holder text, p_ttl_seconds integer) TO service_role;

-- FUNCTION update_leads_updated_at()  [ACL]
GRANT ALL ON FUNCTION public.update_leads_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_leads_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_leads_updated_at() TO service_role;

-- TABLE ab_test_results  [ACL]
GRANT ALL ON TABLE public.ab_test_results TO anon;
GRANT ALL ON TABLE public.ab_test_results TO authenticated;
GRANT ALL ON TABLE public.ab_test_results TO service_role;
GRANT SELECT,INSERT ON TABLE public.ab_test_results TO sandbox_exec;

-- TABLE activity_logs  [ACL]
GRANT ALL ON TABLE public.activity_logs TO anon;
GRANT ALL ON TABLE public.activity_logs TO authenticated;
GRANT ALL ON TABLE public.activity_logs TO service_role;
GRANT SELECT,INSERT ON TABLE public.activity_logs TO sandbox_exec;

-- TABLE api_providers  [ACL]
GRANT ALL ON TABLE public.api_providers TO anon;
GRANT ALL ON TABLE public.api_providers TO authenticated;
GRANT ALL ON TABLE public.api_providers TO service_role;
GRANT SELECT,INSERT ON TABLE public.api_providers TO sandbox_exec;

-- TABLE audit_log  [ACL]
GRANT ALL ON TABLE public.audit_log TO anon;
GRANT ALL ON TABLE public.audit_log TO authenticated;
GRANT ALL ON TABLE public.audit_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.audit_log TO sandbox_exec;

-- TABLE chatbot_conversations  [ACL]
GRANT ALL ON TABLE public.chatbot_conversations TO anon;
GRANT ALL ON TABLE public.chatbot_conversations TO authenticated;
GRANT ALL ON TABLE public.chatbot_conversations TO service_role;
GRANT SELECT,INSERT ON TABLE public.chatbot_conversations TO sandbox_exec;

-- TABLE chatbot_messages  [ACL]
GRANT ALL ON TABLE public.chatbot_messages TO anon;
GRANT ALL ON TABLE public.chatbot_messages TO authenticated;
GRANT ALL ON TABLE public.chatbot_messages TO service_role;
GRANT SELECT,INSERT ON TABLE public.chatbot_messages TO sandbox_exec;

-- TABLE chatbot_sessions  [ACL]
GRANT ALL ON TABLE public.chatbot_sessions TO anon;
GRANT ALL ON TABLE public.chatbot_sessions TO authenticated;
GRANT ALL ON TABLE public.chatbot_sessions TO service_role;
GRANT SELECT,INSERT ON TABLE public.chatbot_sessions TO sandbox_exec;

-- TABLE chatbots  [ACL]
GRANT ALL ON TABLE public.chatbots TO anon;
GRANT ALL ON TABLE public.chatbots TO authenticated;
GRANT ALL ON TABLE public.chatbots TO service_role;
GRANT SELECT,INSERT ON TABLE public.chatbots TO sandbox_exec;

-- TABLE demo_job_steps  [ACL]
GRANT ALL ON TABLE public.demo_job_steps TO anon;
GRANT ALL ON TABLE public.demo_job_steps TO authenticated;
GRANT ALL ON TABLE public.demo_job_steps TO service_role;
GRANT SELECT,INSERT ON TABLE public.demo_job_steps TO sandbox_exec;

-- TABLE demo_jobs  [ACL]
GRANT ALL ON TABLE public.demo_jobs TO anon;
GRANT ALL ON TABLE public.demo_jobs TO authenticated;
GRANT ALL ON TABLE public.demo_jobs TO service_role;
GRANT SELECT,INSERT ON TABLE public.demo_jobs TO sandbox_exec;

-- TABLE demo_leads  [ACL]
GRANT ALL ON TABLE public.demo_leads TO anon;
GRANT ALL ON TABLE public.demo_leads TO authenticated;
GRANT ALL ON TABLE public.demo_leads TO service_role;
GRANT SELECT,INSERT ON TABLE public.demo_leads TO sandbox_exec;

-- TABLE demo_open_log  [ACL]
GRANT ALL ON TABLE public.demo_open_log TO anon;
GRANT ALL ON TABLE public.demo_open_log TO authenticated;
GRANT ALL ON TABLE public.demo_open_log TO service_role;
GRANT SELECT,INSERT ON TABLE public.demo_open_log TO sandbox_exec;

-- TABLE demo_pages  [ACL]
GRANT ALL ON TABLE public.demo_pages TO anon;
GRANT ALL ON TABLE public.demo_pages TO authenticated;
GRANT ALL ON TABLE public.demo_pages TO service_role;
GRANT SELECT,INSERT ON TABLE public.demo_pages TO sandbox_exec;

-- TABLE ecommerce_landing_template  [ACL]
GRANT ALL ON TABLE public.ecommerce_landing_template TO anon;
GRANT ALL ON TABLE public.ecommerce_landing_template TO authenticated;
GRANT ALL ON TABLE public.ecommerce_landing_template TO service_role;
GRANT SELECT,INSERT ON TABLE public.ecommerce_landing_template TO sandbox_exec;

-- TABLE email_queue  [ACL]
GRANT ALL ON TABLE public.email_queue TO anon;
GRANT ALL ON TABLE public.email_queue TO authenticated;
GRANT ALL ON TABLE public.email_queue TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_queue TO sandbox_exec;

-- TABLE error_events  [ACL]
GRANT ALL ON TABLE public.error_events TO anon;
GRANT ALL ON TABLE public.error_events TO authenticated;
GRANT ALL ON TABLE public.error_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.error_events TO sandbox_exec;

-- TABLE follow_up_enrollments  [ACL]
GRANT ALL ON TABLE public.follow_up_enrollments TO anon;
GRANT ALL ON TABLE public.follow_up_enrollments TO authenticated;
GRANT ALL ON TABLE public.follow_up_enrollments TO service_role;
GRANT SELECT,INSERT ON TABLE public.follow_up_enrollments TO sandbox_exec;

-- TABLE follow_up_sequences_templates  [ACL]
GRANT ALL ON TABLE public.follow_up_sequences_templates TO anon;
GRANT ALL ON TABLE public.follow_up_sequences_templates TO authenticated;
GRANT ALL ON TABLE public.follow_up_sequences_templates TO service_role;
GRANT SELECT,INSERT ON TABLE public.follow_up_sequences_templates TO sandbox_exec;

-- TABLE follow_up_steps  [ACL]
GRANT ALL ON TABLE public.follow_up_steps TO anon;
GRANT ALL ON TABLE public.follow_up_steps TO authenticated;
GRANT ALL ON TABLE public.follow_up_steps TO service_role;
GRANT SELECT,INSERT ON TABLE public.follow_up_steps TO sandbox_exec;

-- TABLE follow_up_templates  [ACL]
GRANT ALL ON TABLE public.follow_up_templates TO anon;
GRANT ALL ON TABLE public.follow_up_templates TO authenticated;
GRANT ALL ON TABLE public.follow_up_templates TO service_role;
GRANT SELECT,INSERT ON TABLE public.follow_up_templates TO sandbox_exec;

-- TABLE followup_events  [ACL]
GRANT ALL ON TABLE public.followup_events TO anon;
GRANT ALL ON TABLE public.followup_events TO authenticated;
GRANT ALL ON TABLE public.followup_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.followup_events TO sandbox_exec;

-- TABLE followup_rules  [ACL]
GRANT ALL ON TABLE public.followup_rules TO anon;
GRANT ALL ON TABLE public.followup_rules TO authenticated;
GRANT ALL ON TABLE public.followup_rules TO service_role;
GRANT SELECT,INSERT ON TABLE public.followup_rules TO sandbox_exec;

-- TABLE followup_settings  [ACL]
GRANT ALL ON TABLE public.followup_settings TO anon;
GRANT ALL ON TABLE public.followup_settings TO authenticated;
GRANT ALL ON TABLE public.followup_settings TO service_role;
GRANT SELECT,INSERT ON TABLE public.followup_settings TO sandbox_exec;

-- TABLE inbox_demos  [ACL]
GRANT ALL ON TABLE public.inbox_demos TO anon;
GRANT ALL ON TABLE public.inbox_demos TO authenticated;
GRANT ALL ON TABLE public.inbox_demos TO service_role;
GRANT SELECT,INSERT ON TABLE public.inbox_demos TO sandbox_exec;

-- TABLE inbox_messages  [ACL]
GRANT ALL ON TABLE public.inbox_messages TO anon;
GRANT ALL ON TABLE public.inbox_messages TO authenticated;
GRANT ALL ON TABLE public.inbox_messages TO service_role;
GRANT SELECT,INSERT ON TABLE public.inbox_messages TO sandbox_exec;

-- TABLE inbox_prompts  [ACL]
GRANT ALL ON TABLE public.inbox_prompts TO anon;
GRANT ALL ON TABLE public.inbox_prompts TO authenticated;
GRANT ALL ON TABLE public.inbox_prompts TO service_role;
GRANT SELECT,INSERT ON TABLE public.inbox_prompts TO sandbox_exec;

-- TABLE industry_templates  [ACL]
GRANT ALL ON TABLE public.industry_templates TO anon;
GRANT ALL ON TABLE public.industry_templates TO authenticated;
GRANT ALL ON TABLE public.industry_templates TO service_role;
GRANT SELECT,INSERT ON TABLE public.industry_templates TO sandbox_exec;

-- TABLE knowledge_base_entries  [ACL]
GRANT ALL ON TABLE public.knowledge_base_entries TO anon;
GRANT ALL ON TABLE public.knowledge_base_entries TO authenticated;
GRANT ALL ON TABLE public.knowledge_base_entries TO service_role;
GRANT SELECT,INSERT ON TABLE public.knowledge_base_entries TO sandbox_exec;

-- TABLE knowledge_base_jobs  [ACL]
GRANT ALL ON TABLE public.knowledge_base_jobs TO anon;
GRANT ALL ON TABLE public.knowledge_base_jobs TO authenticated;
GRANT ALL ON TABLE public.knowledge_base_jobs TO service_role;
GRANT SELECT,INSERT ON TABLE public.knowledge_base_jobs TO sandbox_exec;

-- TABLE lead_follow_ups  [ACL]
GRANT ALL ON TABLE public.lead_follow_ups TO anon;
GRANT ALL ON TABLE public.lead_follow_ups TO authenticated;
GRANT ALL ON TABLE public.lead_follow_ups TO service_role;
GRANT SELECT,INSERT ON TABLE public.lead_follow_ups TO sandbox_exec;

-- TABLE leads  [ACL]
GRANT ALL ON TABLE public.leads TO anon;
GRANT ALL ON TABLE public.leads TO authenticated;
GRANT ALL ON TABLE public.leads TO service_role;
GRANT SELECT,INSERT ON TABLE public.leads TO sandbox_exec;

-- TABLE link_events  [ACL]
GRANT ALL ON TABLE public.link_events TO anon;
GRANT ALL ON TABLE public.link_events TO authenticated;
GRANT ALL ON TABLE public.link_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.link_events TO sandbox_exec;

-- TABLE manyreach_logs  [ACL]
GRANT ALL ON TABLE public.manyreach_logs TO anon;
GRANT ALL ON TABLE public.manyreach_logs TO authenticated;
GRANT ALL ON TABLE public.manyreach_logs TO service_role;
GRANT SELECT,INSERT ON TABLE public.manyreach_logs TO sandbox_exec;

-- TABLE node_prompts  [ACL]
GRANT ALL ON TABLE public.node_prompts TO anon;
GRANT ALL ON TABLE public.node_prompts TO authenticated;
GRANT ALL ON TABLE public.node_prompts TO service_role;
GRANT SELECT,INSERT ON TABLE public.node_prompts TO sandbox_exec;

-- TABLE notifications  [ACL]
GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;
GRANT SELECT,INSERT ON TABLE public.notifications TO sandbox_exec;

-- TABLE pipeline_events  [ACL]
GRANT ALL ON TABLE public.pipeline_events TO anon;
GRANT ALL ON TABLE public.pipeline_events TO authenticated;
GRANT ALL ON TABLE public.pipeline_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.pipeline_events TO sandbox_exec;

-- TABLE pipeline_locks  [ACL]
GRANT ALL ON TABLE public.pipeline_locks TO anon;
GRANT ALL ON TABLE public.pipeline_locks TO authenticated;
GRANT ALL ON TABLE public.pipeline_locks TO service_role;
GRANT SELECT,INSERT ON TABLE public.pipeline_locks TO sandbox_exec;

-- TABLE products  [ACL]
GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;
GRANT SELECT,INSERT ON TABLE public.products TO sandbox_exec;

-- TABLE prompt_improvement_suggestions  [ACL]
GRANT ALL ON TABLE public.prompt_improvement_suggestions TO anon;
GRANT ALL ON TABLE public.prompt_improvement_suggestions TO authenticated;
GRANT ALL ON TABLE public.prompt_improvement_suggestions TO service_role;
GRANT SELECT,INSERT ON TABLE public.prompt_improvement_suggestions TO sandbox_exec;

-- TABLE prompt_versions  [ACL]
GRANT ALL ON TABLE public.prompt_versions TO anon;
GRANT ALL ON TABLE public.prompt_versions TO authenticated;
GRANT ALL ON TABLE public.prompt_versions TO service_role;
GRANT SELECT,INSERT ON TABLE public.prompt_versions TO sandbox_exec;

-- TABLE property_listings  [ACL]
GRANT ALL ON TABLE public.property_listings TO anon;
GRANT ALL ON TABLE public.property_listings TO authenticated;
GRANT ALL ON TABLE public.property_listings TO service_role;
GRANT SELECT,INSERT ON TABLE public.property_listings TO sandbox_exec;

-- TABLE prospect_activity_times  [ACL]
GRANT ALL ON TABLE public.prospect_activity_times TO anon;
GRANT ALL ON TABLE public.prospect_activity_times TO authenticated;
GRANT ALL ON TABLE public.prospect_activity_times TO service_role;
GRANT SELECT,INSERT ON TABLE public.prospect_activity_times TO sandbox_exec;

-- TABLE prospect_memory  [ACL]
GRANT ALL ON TABLE public.prospect_memory TO anon;
GRANT ALL ON TABLE public.prospect_memory TO authenticated;
GRANT ALL ON TABLE public.prospect_memory TO service_role;
GRANT SELECT,INSERT ON TABLE public.prospect_memory TO sandbox_exec;

-- TABLE prospects  [ACL]
GRANT ALL ON TABLE public.prospects TO anon;
GRANT ALL ON TABLE public.prospects TO authenticated;
GRANT ALL ON TABLE public.prospects TO service_role;
GRANT SELECT,INSERT ON TABLE public.prospects TO sandbox_exec;

-- TABLE realestate_profiles  [ACL]
GRANT ALL ON TABLE public.realestate_profiles TO anon;
GRANT ALL ON TABLE public.realestate_profiles TO authenticated;
GRANT ALL ON TABLE public.realestate_profiles TO service_role;
GRANT SELECT,INSERT ON TABLE public.realestate_profiles TO sandbox_exec;

-- TABLE reply_templates  [ACL]
GRANT ALL ON TABLE public.reply_templates TO anon;
GRANT ALL ON TABLE public.reply_templates TO authenticated;
GRANT ALL ON TABLE public.reply_templates TO service_role;
GRANT SELECT,INSERT ON TABLE public.reply_templates TO sandbox_exec;

-- TABLE scraped_data  [ACL]
GRANT ALL ON TABLE public.scraped_data TO anon;
GRANT ALL ON TABLE public.scraped_data TO authenticated;
GRANT ALL ON TABLE public.scraped_data TO service_role;
GRANT SELECT,INSERT ON TABLE public.scraped_data TO sandbox_exec;

-- TABLE sequence_analytics_cache  [ACL]
GRANT ALL ON TABLE public.sequence_analytics_cache TO anon;
GRANT ALL ON TABLE public.sequence_analytics_cache TO authenticated;
GRANT ALL ON TABLE public.sequence_analytics_cache TO service_role;
GRANT SELECT,INSERT ON TABLE public.sequence_analytics_cache TO sandbox_exec;

-- TABLE site_settings  [ACL]
GRANT ALL ON TABLE public.site_settings TO anon;
GRANT ALL ON TABLE public.site_settings TO authenticated;
GRANT ALL ON TABLE public.site_settings TO service_role;
GRANT SELECT,INSERT ON TABLE public.site_settings TO sandbox_exec;

-- TABLE system_health_checks  [ACL]
GRANT ALL ON TABLE public.system_health_checks TO anon;
GRANT ALL ON TABLE public.system_health_checks TO authenticated;
GRANT ALL ON TABLE public.system_health_checks TO service_role;
GRANT SELECT,INSERT ON TABLE public.system_health_checks TO sandbox_exec;

-- TABLE unsubscribed_prospects  [ACL]
GRANT ALL ON TABLE public.unsubscribed_prospects TO anon;
GRANT ALL ON TABLE public.unsubscribed_prospects TO authenticated;
GRANT ALL ON TABLE public.unsubscribed_prospects TO service_role;
GRANT SELECT,INSERT ON TABLE public.unsubscribed_prospects TO sandbox_exec;

-- TABLE variable_fallbacks  [ACL]
GRANT ALL ON TABLE public.variable_fallbacks TO anon;
GRANT ALL ON TABLE public.variable_fallbacks TO authenticated;
GRANT ALL ON TABLE public.variable_fallbacks TO service_role;
GRANT SELECT,INSERT ON TABLE public.variable_fallbacks TO sandbox_exec;

-- TABLE webhook_dedupe  [ACL]
GRANT ALL ON TABLE public.webhook_dedupe TO anon;
GRANT ALL ON TABLE public.webhook_dedupe TO authenticated;
GRANT ALL ON TABLE public.webhook_dedupe TO service_role;
GRANT SELECT,INSERT ON TABLE public.webhook_dedupe TO sandbox_exec;

-- TABLE webhook_endpoints  [ACL]
GRANT ALL ON TABLE public.webhook_endpoints TO anon;
GRANT ALL ON TABLE public.webhook_endpoints TO authenticated;
GRANT ALL ON TABLE public.webhook_endpoints TO service_role;
GRANT SELECT,INSERT ON TABLE public.webhook_endpoints TO sandbox_exec;

-- TABLE webhook_logs  [ACL]
GRANT ALL ON TABLE public.webhook_logs TO anon;
GRANT ALL ON TABLE public.webhook_logs TO authenticated;
GRANT ALL ON TABLE public.webhook_logs TO service_role;
GRANT SELECT,INSERT ON TABLE public.webhook_logs TO sandbox_exec;

-- DEFAULT PRIVILEGES FOR SEQUENCES  [DEFAULT ACL]
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO sandbox_exec;

-- DEFAULT PRIVILEGES FOR SEQUENCES  [DEFAULT ACL]
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- DEFAULT PRIVILEGES FOR FUNCTIONS  [DEFAULT ACL]
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- DEFAULT PRIVILEGES FOR FUNCTIONS  [DEFAULT ACL]
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- DEFAULT PRIVILEGES FOR TABLES  [DEFAULT ACL]
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec;

-- DEFAULT PRIVILEGES FOR TABLES  [DEFAULT ACL]
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict 8kFsAbsYWGcaMl1SWa8beWsE4GkRp6biotXUAcA62okOgqqhoiy6wnCTK4dDGSg
