-- ============================================================
-- 04 — TRIGGERS
-- Bind the functions in 03 to their tables. Run after 02 and 03.
-- Generated from the production database (schema-only, no lead data).
-- ============================================================

SET statement_timeout = 0;
SET client_min_messages = warning;
SET search_path = public, extensions;

-- products products_updated_at  [TRIGGER]
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_demo_leads_updated_at();

-- reply_templates rt_touch  [TRIGGER]
CREATE TRIGGER rt_touch BEFORE UPDATE ON public.reply_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_inbox();

-- ecommerce_landing_template touch_ecom_landing_updated_at  [TRIGGER]
CREATE TRIGGER touch_ecom_landing_updated_at BEFORE UPDATE ON public.ecommerce_landing_template FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- follow_up_templates touch_follow_up_templates_updated_at  [TRIGGER]
CREATE TRIGGER touch_follow_up_templates_updated_at BEFORE UPDATE ON public.follow_up_templates FOR EACH ROW EXECUTE FUNCTION public.touch_demo_leads_updated_at();

-- prospects trg_cancel_followups_on_booking  [TRIGGER]
CREATE TRIGGER trg_cancel_followups_on_booking BEFORE UPDATE OF calendly_booked_at ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.cancel_followups_on_booking();

-- inbox_messages trg_cancel_followups_on_reply  [TRIGGER]
CREATE TRIGGER trg_cancel_followups_on_reply AFTER INSERT ON public.inbox_messages FOR EACH ROW EXECUTE FUNCTION public.cancel_followups_on_reply();

-- demo_job_steps trg_demo_job_steps_touch  [TRIGGER]
CREATE TRIGGER trg_demo_job_steps_touch BEFORE UPDATE ON public.demo_job_steps FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- demo_jobs trg_demo_jobs_touch  [TRIGGER]
CREATE TRIGGER trg_demo_jobs_touch BEFORE UPDATE ON public.demo_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- demo_leads trg_demo_leads_updated_at  [TRIGGER]
CREATE TRIGGER trg_demo_leads_updated_at BEFORE UPDATE ON public.demo_leads FOR EACH ROW EXECUTE FUNCTION public.touch_demo_leads_updated_at();

-- inbox_prompts trg_inbox_prompts_updated  [TRIGGER]
CREATE TRIGGER trg_inbox_prompts_updated BEFORE UPDATE ON public.inbox_prompts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_inbox();

-- inbox_messages trg_incoming_message_track  [TRIGGER]
CREATE TRIGGER trg_incoming_message_track AFTER INSERT ON public.inbox_messages FOR EACH ROW EXECUTE FUNCTION public.on_incoming_message_track();

-- link_events trg_link_event_prospect  [TRIGGER]
CREATE TRIGGER trg_link_event_prospect AFTER INSERT ON public.link_events FOR EACH ROW EXECUTE FUNCTION public.on_link_event_track_prospect();

-- demo_leads trg_mirror_demo_lead_to_prospect  [TRIGGER]
CREATE TRIGGER trg_mirror_demo_lead_to_prospect AFTER INSERT OR UPDATE ON public.demo_leads FOR EACH ROW EXECUTE FUNCTION public.mirror_demo_lead_to_prospect();

-- node_prompts trg_node_prompts_updated  [TRIGGER]
CREATE TRIGGER trg_node_prompts_updated BEFORE UPDATE ON public.node_prompts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- property_listings trg_property_listings_touch  [TRIGGER]
CREATE TRIGGER trg_property_listings_touch BEFORE UPDATE ON public.property_listings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- prospect_memory trg_prospect_memory_updated  [TRIGGER]
CREATE TRIGGER trg_prospect_memory_updated BEFORE UPDATE ON public.prospect_memory FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- prospects trg_prospects_updated  [TRIGGER]
CREATE TRIGGER trg_prospects_updated BEFORE UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_inbox();

-- realestate_profiles trg_realestate_profiles_touch  [TRIGGER]
CREATE TRIGGER trg_realestate_profiles_touch BEFORE UPDATE ON public.realestate_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- follow_up_enrollments trg_touch_enrollments  [TRIGGER]
CREATE TRIGGER trg_touch_enrollments BEFORE UPDATE ON public.follow_up_enrollments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- followup_events trg_touch_followup_events  [TRIGGER]
CREATE TRIGGER trg_touch_followup_events BEFORE UPDATE ON public.followup_events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- followup_rules trg_touch_followup_rules  [TRIGGER]
CREATE TRIGGER trg_touch_followup_rules BEFORE UPDATE ON public.followup_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- follow_up_sequences_templates trg_touch_sequences  [TRIGGER]
CREATE TRIGGER trg_touch_sequences BEFORE UPDATE ON public.follow_up_sequences_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- follow_up_steps trg_touch_steps  [TRIGGER]
CREATE TRIGGER trg_touch_steps BEFORE UPDATE ON public.follow_up_steps FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- webhook_endpoints trg_webhook_endpoints_updated_at  [TRIGGER]
CREATE TRIGGER trg_webhook_endpoints_updated_at BEFORE UPDATE ON public.webhook_endpoints FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- leads update_leads_updated_at  [TRIGGER]
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_leads_updated_at();
