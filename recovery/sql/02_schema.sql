-- ============================================================
-- 02 — TABLES, CONSTRAINTS, INDEXES
-- All public-schema tables, PK/FK/unique constraints and indexes.
-- Generated from the production database (schema-only, no lead data).
-- ============================================================

SET statement_timeout = 0;
SET client_min_messages = warning;
SET search_path = public, extensions;

-- ab_test_results  [TABLE]
CREATE TABLE public.ab_test_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sequence_template_id uuid NOT NULL,
    variant text NOT NULL,
    enrollments integer DEFAULT 0 NOT NULL,
    responses integer DEFAULT 0 NOT NULL,
    response_rate double precision DEFAULT 0 NOT NULL,
    winner_declared boolean DEFAULT false NOT NULL,
    winner_variant text,
    declared_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- activity_logs  [TABLE]
CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    status text DEFAULT 'info'::text NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- api_providers  [TABLE]
CREATE TABLE public.api_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    provider_type text DEFAULT 'openai'::text NOT NULL,
    api_key text NOT NULL,
    endpoint_url text,
    model text,
    priority integer DEFAULT 0 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    category text DEFAULT 'llm'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- audit_log  [TABLE]
CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event text NOT NULL,
    actor text,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- chatbot_conversations  [TABLE]
CREATE TABLE public.chatbot_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chatbot_id uuid NOT NULL,
    session_id text NOT NULL,
    messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- chatbot_messages  [TABLE]
CREATE TABLE public.chatbot_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    chatbot_id uuid,
    role text NOT NULL,
    content text NOT NULL,
    products_shown jsonb,
    query_intent text,
    response_quality_score double precision,
    was_helpful boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- chatbot_sessions  [TABLE]
CREATE TABLE public.chatbot_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chatbot_id uuid,
    demo_page_id uuid,
    business_name text,
    session_id text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    total_messages integer DEFAULT 0 NOT NULL,
    user_messages integer DEFAULT 0 NOT NULL,
    bot_messages integer DEFAULT 0 NOT NULL,
    interaction_type text DEFAULT 'chat'::text NOT NULL,
    products_shown integer DEFAULT 0 NOT NULL,
    products_clicked integer DEFAULT 0 NOT NULL,
    sentiment_score double precision,
    outcome text DEFAULT 'unknown'::text NOT NULL,
    flagged_for_review boolean DEFAULT false NOT NULL,
    flag_reason text,
    ended_at timestamp with time zone,
    analyzed_at timestamp with time zone,
    analysis jsonb,
    topics text[],
    sentiment text
);

-- chatbots  [TABLE]
CREATE TABLE public.chatbots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_name text NOT NULL,
    website_url text,
    slug text NOT NULL,
    system_prompt text DEFAULT ''::text NOT NULL,
    ai_provider text DEFAULT 'lovable'::text NOT NULL,
    ai_model text DEFAULT 'google/gemini-3-flash-preview'::text NOT NULL,
    api_key_encrypted text,
    research_data jsonb,
    brand_tone text,
    industry text,
    services jsonb DEFAULT '[]'::jsonb,
    faq_topics jsonb DEFAULT '[]'::jsonb,
    widget_config jsonb DEFAULT '{"greeting": "Hi! How can I help you?", "position": "bottom-right"}'::jsonb,
    demo_page_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    logo_url text,
    kb_chatbot_md text,
    kb_voice_text text,
    prompt_core jsonb,
    store_name text,
    store_platform text,
    product_count integer DEFAULT 0 NOT NULL
);

-- demo_job_steps  [TABLE]
CREATE TABLE public.demo_job_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    step text NOT NULL,
    step_order integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    output jsonb,
    error text,
    duration_ms integer,
    attempt integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- demo_jobs  [TABLE]
CREATE TABLE public.demo_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid,
    email text,
    business_name text,
    website_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt integer DEFAULT 1 NOT NULL,
    last_error text,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- demo_leads  [TABLE]
CREATE TABLE public.demo_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    demo_page_id uuid,
    slug text NOT NULL,
    first_name text,
    company text,
    campaign_name text,
    industry text,
    campaign_id text,
    lead_source text,
    sender_email text,
    message_thread_id text,
    cc_emails jsonb DEFAULT '[]'::jsonb,
    bcc_emails jsonb DEFAULT '[]'::jsonb,
    is_complete boolean DEFAULT false NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    lead_score integer DEFAULT 0 NOT NULL,
    score_tier text DEFAULT 'low'::text,
    country_code text,
    visitor_session_id text,
    demo_tried boolean DEFAULT false NOT NULL,
    demo_type_tried text,
    last_visit_at timestamp with time zone,
    follow_up_sent_at timestamp with time zone,
    follow_up_message_id text,
    engagement jsonb DEFAULT '{}'::jsonb NOT NULL,
    fingerprint text,
    tried_voice boolean DEFAULT false NOT NULL,
    tried_chat boolean DEFAULT false NOT NULL,
    voice_first_at timestamp with time zone,
    chat_first_at timestamp with time zone,
    followup_case1_sent boolean DEFAULT false NOT NULL,
    followup_case2_sent boolean DEFAULT false NOT NULL,
    feedback_requested boolean DEFAULT false NOT NULL,
    feedback_link_clicked boolean DEFAULT false NOT NULL,
    feedback_link_clicked_at timestamp with time zone,
    feedback_link_visit_count integer DEFAULT 0 NOT NULL,
    demo_engagement_seconds numeric DEFAULT 0 NOT NULL,
    engagement_tier text DEFAULT 'not_tried'::text NOT NULL,
    engagement_channel text,
    calendly_clicked_at timestamp with time zone,
    calendly_booked_at timestamp with time zone,
    exit_section text,
    deepest_section text
);

-- demo_open_log  [TABLE]
CREATE TABLE public.demo_open_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid NOT NULL,
    demo_id uuid,
    opened_at timestamp with time zone DEFAULT now() NOT NULL
);

-- demo_pages  [TABLE]
CREATE TABLE public.demo_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    assistant_id text NOT NULL,
    business_name text NOT NULL,
    description text,
    vapi_key text NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    client_name text,
    company_name text,
    industry text,
    hero_title text,
    hero_subtitle text,
    calendly_url text,
    cta_text text DEFAULT 'Book a Call'::text,
    contact_email text,
    contact_phone text,
    custom_subdomain text,
    features jsonb DEFAULT '[]'::jsonb,
    benefits jsonb DEFAULT '[]'::jsonb,
    social_proof jsonb DEFAULT '[]'::jsonb,
    dynamic_content jsonb DEFAULT '{}'::jsonb
);

-- ecommerce_landing_template  [TABLE]
CREATE TABLE public.ecommerce_landing_template (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    singleton boolean DEFAULT true NOT NULL,
    hero_headline text DEFAULT 'Turn every visitor into a customer with {{company}}''s AI'::text NOT NULL,
    hero_sub text DEFAULT 'A voice + chat agent that knows every product in your store — and sells for you 24/7.'::text NOT NULL,
    hero_cta_primary text DEFAULT '💬 Try the AI now'::text NOT NULL,
    hero_cta_secondary text DEFAULT '🎙 Or start a voice call'::text NOT NULL,
    intro_greeting text DEFAULT 'Hey {{visitor_name}},'::text NOT NULL,
    intro_body text DEFAULT 'I built a tool that captures leads while you''re off the clock.

It''s a robot that talks to your customers on your site, answers questions, and helps them get exactly what they want while you focus on running {{company}}.

Try it out 💬

A smooth chat will begin in the bottom-right corner.

Capture sales the moment buyers are ready by responding instantly.'::text NOT NULL,
    image_headline text DEFAULT 'Turn conversations into conversions'::text NOT NULL,
    image_sub text DEFAULT 'Book a call and see how AI Agents can sell, support, and generate leads for {{company}} 24/7.'::text NOT NULL,
    image_cta text DEFAULT 'Book Your Call Now'::text NOT NULL,
    hero_image_url text DEFAULT ''::text NOT NULL,
    urgency_line text DEFAULT 'Don''t wait until it''s too late. The early adopters always win.'::text NOT NULL,
    proof_headline text DEFAULT 'The proof? My clients can''t stop talking about it'::text NOT NULL,
    youtube_embed_url text DEFAULT 'https://www.youtube.com/embed/eOAyie0kWGQ'::text NOT NULL,
    demo_headline text DEFAULT 'Talk to {{company}}''s AI — chat or voice, one window'::text NOT NULL,
    demo_sub text DEFAULT 'Type a question or tap the mic. The same AI answers both ways — and knows every one of your products.'::text NOT NULL,
    cta_headline text DEFAULT 'Ready to grow {{company}} with AI?'::text NOT NULL,
    cta_sub text DEFAULT 'Book a 15-min call and see it live on your store.'::text NOT NULL,
    cta_button text DEFAULT 'Book Your Call Now'::text NOT NULL,
    footer_note text DEFAULT 'Built for {{company}} with ❤️ by AI Agents'::text NOT NULL,
    suggestion_chips jsonb DEFAULT '["🏆 Show bestsellers", "🎁 Gift ideas", "💰 Under $100", "📦 Shipping info"]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- email_queue  [TABLE]
CREATE TABLE public.email_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    type text NOT NULL,
    scheduled_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    cancelled_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'cancelled'::text, 'failed'::text]))),
    CONSTRAINT email_queue_type_check CHECK ((type = ANY (ARRAY['case1'::text, 'case2'::text])))
);

-- error_events  [TABLE]
CREATE TABLE public.error_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    message_id uuid,
    prospect_id uuid,
    message text NOT NULL,
    stack text,
    acknowledged boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- follow_up_enrollments  [TABLE]
CREATE TABLE public.follow_up_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid NOT NULL,
    sequence_template_id uuid NOT NULL,
    current_step integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    next_step_at timestamp with time zone,
    completed_at timestamp with time zone,
    retry_count integer DEFAULT 0 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_variant text DEFAULT 'A'::text NOT NULL,
    replied_at timestamp with time zone,
    reply_classification text,
    best_send_hour smallint,
    best_send_day smallint,
    scheduling_debug jsonb DEFAULT '{}'::jsonb NOT NULL
);

-- follow_up_sequences_templates  [TABLE]
CREATE TABLE public.follow_up_sequences_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    trigger_type text DEFAULT 'custom'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ab_test_enabled boolean DEFAULT false NOT NULL,
    max_steps integer DEFAULT 3 NOT NULL
);

-- follow_up_steps  [TABLE]
CREATE TABLE public.follow_up_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sequence_template_id uuid NOT NULL,
    step_number integer NOT NULL,
    delay_value integer DEFAULT 2 NOT NULL,
    delay_unit text DEFAULT 'days'::text NOT NULL,
    message_subject text DEFAULT 'Re: {{firstname}} overview'::text NOT NULL,
    message_body text DEFAULT ''::text NOT NULL,
    include_demo_link boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    variant text DEFAULT 'A'::text NOT NULL
);

-- follow_up_templates  [TABLE]
CREATE TABLE public.follow_up_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    condition text NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT follow_up_templates_condition_check CHECK ((condition = ANY (ARRAY['not_tried'::text, 'tried_voice_agent'::text, 'tried_chatbot'::text])))
);

-- followup_events  [TABLE]
CREATE TABLE public.followup_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid NOT NULL,
    trigger_key text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    scheduled_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    message_subject text,
    message_body text,
    manyreach_message_id text,
    error text,
    attempt integer DEFAULT 1 NOT NULL,
    source text DEFAULT 'rule'::text NOT NULL,
    sequence_enrollment_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- followup_rules  [TABLE]
CREATE TABLE public.followup_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trigger_key text NOT NULL,
    label text NOT NULL,
    delay_hours integer DEFAULT 24 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    auto_send boolean DEFAULT false NOT NULL,
    prompt_override text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- followup_settings  [TABLE]
CREATE TABLE public.followup_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- inbox_demos  [TABLE]
CREATE TABLE public.inbox_demos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid NOT NULL,
    demo_url text NOT NULL,
    business_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- inbox_messages  [TABLE]
CREATE TABLE public.inbox_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid NOT NULL,
    manyreach_message_id text,
    direction text NOT NULL,
    source text DEFAULT 'email'::text NOT NULL,
    subject text,
    body text NOT NULL,
    classification text,
    classified_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_test_data boolean DEFAULT false NOT NULL,
    CONSTRAINT inbox_messages_classification_check CHECK ((classification = ANY (ARRAY['Positive'::text, 'Negative'::text, 'Objection'::text]))),
    CONSTRAINT inbox_messages_classified_by_check CHECK ((classified_by = ANY (ARRAY['ai'::text, 'human'::text]))),
    CONSTRAINT inbox_messages_direction_check CHECK ((direction = ANY (ARRAY['incoming'::text, 'outgoing'::text])))
);

-- inbox_prompts  [TABLE]
CREATE TABLE public.inbox_prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    classification text NOT NULL,
    system_prompt text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inbox_prompts_classification_check CHECK ((classification = ANY (ARRAY['Positive'::text, 'Negative'::text, 'Objection'::text, 'Classifier'::text])))
);

-- industry_templates  [TABLE]
CREATE TABLE public.industry_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    industry_name text NOT NULL,
    display_name text NOT NULL,
    system_prompt_template text DEFAULT ''::text NOT NULL,
    first_message_template text DEFAULT 'Hi, thank you for calling {business_name}! How can I help you?'::text NOT NULL,
    chatbot_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    voice_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    website_template jsonb DEFAULT '{}'::jsonb NOT NULL,
    problem_statements jsonb DEFAULT '[]'::jsonb NOT NULL,
    chatbot_nav_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    floating_bubbles jsonb DEFAULT '[]'::jsonb NOT NULL,
    hero_subtitle_template text,
    status text DEFAULT 'active'::text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- knowledge_base_entries  [TABLE]
CREATE TABLE public.knowledge_base_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chatbot_id uuid NOT NULL,
    source_url text,
    content_type text DEFAULT 'page'::text NOT NULL,
    title text,
    content text NOT NULL,
    structured jsonb DEFAULT '{}'::jsonb,
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- knowledge_base_jobs  [TABLE]
CREATE TABLE public.knowledge_base_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chatbot_id uuid NOT NULL,
    website_url text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    pages_scraped integer DEFAULT 0 NOT NULL,
    entries_created integer DEFAULT 0 NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);

-- lead_follow_ups  [TABLE]
CREATE TABLE public.lead_follow_ups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    message text NOT NULL,
    stage text DEFAULT 'reminder'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- leads  [TABLE]
CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    business_name text NOT NULL,
    status text DEFAULT 'needs_follow_up'::text NOT NULL,
    follow_up_count integer DEFAULT 0 NOT NULL,
    last_follow_up_at timestamp with time zone,
    next_follow_up_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- link_events  [TABLE]
CREATE TABLE public.link_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    demo_page_id uuid,
    chatbot_id uuid,
    business_name text NOT NULL,
    slug text NOT NULL,
    link_type text DEFAULT 'demo'::text NOT NULL,
    event_type text NOT NULL,
    session_id text,
    visitor_ip text,
    country_code text,
    city text,
    user_agent text,
    referrer text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_self_traffic boolean DEFAULT false NOT NULL
);

-- manyreach_logs  [TABLE]
CREATE TABLE public.manyreach_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    lead_id uuid,
    slug text,
    campaign_id text,
    thread_id text,
    status text NOT NULL,
    lead_score integer,
    request_payload jsonb,
    response_payload jsonb,
    error_message text
);

-- node_prompts  [TABLE]
CREATE TABLE public.node_prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    node_name text NOT NULL,
    system_prompt text NOT NULL,
    user_prompt_template text,
    model text DEFAULT 'google/gemini-2.5-flash'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- notifications  [TABLE]
CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    prospect_id uuid,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- pipeline_events  [TABLE]
CREATE TABLE public.pipeline_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid,
    prospect_id uuid,
    step text NOT NULL,
    status text NOT NULL,
    details jsonb,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pipeline_events_status_check CHECK ((status = ANY (ARRAY['ok'::text, 'skipped'::text, 'failed'::text])))
);

-- pipeline_locks  [TABLE]
CREATE TABLE public.pipeline_locks (
    lock_key text NOT NULL,
    holder text,
    acquired_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL
);

-- products  [TABLE]
CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chatbot_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    price numeric,
    currency text DEFAULT 'USD'::text,
    image_url text,
    product_url text,
    sku text,
    category text,
    tags text[] DEFAULT '{}'::text[],
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    handle text,
    vendor text,
    images text[] DEFAULT '{}'::text[],
    variants jsonb DEFAULT '[]'::jsonb,
    options jsonb DEFAULT '[]'::jsonb,
    compare_at_price numeric,
    in_stock boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- prompt_improvement_suggestions  [TABLE]
CREATE TABLE public.prompt_improvement_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chatbot_id uuid,
    industry text DEFAULT 'ecommerce'::text NOT NULL,
    suggestion_type text,
    current_behavior text,
    suggested_change text,
    evidence jsonb DEFAULT '[]'::jsonb,
    occurrence_count integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    applied_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sessions_analyzed integer,
    outcomes jsonb,
    summary text,
    suggestions jsonb
);

-- prompt_versions  [TABLE]
CREATE TABLE public.prompt_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chatbot_id uuid,
    industry text DEFAULT 'ecommerce'::text NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    system_prompt text NOT NULL,
    change_summary text,
    suggestions_applied uuid[] DEFAULT ARRAY[]::uuid[],
    applied_by text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- property_listings  [TABLE]
CREATE TABLE public.property_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chatbot_id uuid NOT NULL,
    listing_id text,
    address text,
    city text,
    price numeric,
    status text,
    bedrooms numeric,
    bathrooms numeric,
    sqft numeric,
    lot_size text,
    property_type text,
    description_raw text,
    features text[] DEFAULT '{}'::text[],
    hoa_fee numeric,
    listing_agent text,
    photos text[] DEFAULT '{}'::text[],
    source_url text,
    last_scraped timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- prospect_activity_times  [TABLE]
CREATE TABLE public.prospect_activity_times (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid NOT NULL,
    day_of_week smallint NOT NULL,
    hour_of_day smallint NOT NULL,
    event_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- prospect_memory  [TABLE]
CREATE TABLE public.prospect_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid NOT NULL,
    demo_link_sent boolean DEFAULT false NOT NULL,
    demo_link_sent_at timestamp with time zone,
    demo_link_sent_in_message_id uuid,
    reply_times jsonb DEFAULT '[]'::jsonb NOT NULL,
    optimal_send_window jsonb DEFAULT '{}'::jsonb NOT NULL,
    conversation_stage text DEFAULT 'pre_demo'::text NOT NULL,
    total_replies_received integer DEFAULT 0 NOT NULL,
    last_reply_at timestamp with time zone,
    classification_history text[] DEFAULT '{}'::text[] NOT NULL,
    demo_behavior jsonb DEFAULT '{}'::jsonb NOT NULL,
    sequence_memory jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    lead_status text DEFAULT 'new'::text NOT NULL,
    last_classification text,
    pitch_count integer DEFAULT 0 NOT NULL
);

-- prospects  [TABLE]
CREATE TABLE public.prospects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    firstname text,
    company text,
    website_url text,
    campaign_id text,
    campaign_name text,
    sender_email text,
    reply_to_email text,
    automation_paused boolean DEFAULT false NOT NULL,
    last_message_at timestamp with time zone,
    last_classification text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    demo_sent_at timestamp with time zone,
    is_test_data boolean DEFAULT false NOT NULL,
    client_memory jsonb DEFAULT '{}'::jsonb NOT NULL,
    original_message_id text,
    demo_link_clicked_at timestamp with time zone,
    demo_page_opened_at timestamp with time zone,
    voice_tried_at timestamp with time zone,
    chatbot_tried_at timestamp with time zone,
    last_activity_at timestamp with time zone,
    followup_attempts integer DEFAULT 0 NOT NULL,
    max_followup_attempts integer DEFAULT 2 NOT NULL,
    followup_status text DEFAULT 'none'::text NOT NULL,
    next_followup_at timestamp with time zone,
    next_followup_trigger text,
    is_hot_lead boolean DEFAULT false NOT NULL,
    hot_lead_detected_at timestamp with time zone,
    hot_lead_open_count integer DEFAULT 0 NOT NULL,
    demo_engagement_seconds numeric DEFAULT 0 NOT NULL,
    engagement_tier text DEFAULT 'not_tried'::text NOT NULL,
    engagement_channel text,
    first_interaction_at timestamp with time zone,
    last_interaction_at timestamp with time zone,
    calendly_clicked_at timestamp with time zone,
    calendly_booked_at timestamp with time zone,
    country_code text,
    is_self_traffic boolean DEFAULT false NOT NULL
);

-- realestate_profiles  [TABLE]
CREATE TABLE public.realestate_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chatbot_id uuid NOT NULL,
    agency_record jsonb DEFAULT '{}'::jsonb NOT NULL,
    business_type text,
    core_job text[] DEFAULT '{}'::text[],
    service_area text[] DEFAULT '{}'::text[],
    property_types text[] DEFAULT '{}'::text[],
    tone_signals text,
    key_differentiators text[] DEFAULT '{}'::text[],
    compliance_notes text[] DEFAULT '{}'::text[],
    suggested_agent_persona_name text,
    confidence text,
    booking_widget_detected boolean DEFAULT false NOT NULL,
    needs_human_review boolean DEFAULT false NOT NULL,
    generated_prompt text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- reply_templates  [TABLE]
CREATE TABLE public.reply_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    classification text NOT NULL,
    phase text DEFAULT 'pre_demo'::text NOT NULL,
    body text NOT NULL,
    locked_vars text[] DEFAULT ARRAY['demo_url'::text] NOT NULL,
    is_default boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reply_templates_phase_check CHECK ((phase = ANY (ARRAY['pre_demo'::text, 'post_demo'::text])))
);

-- scraped_data  [TABLE]
CREATE TABLE public.scraped_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    website_url text NOT NULL,
    raw_content text,
    structured_data jsonb DEFAULT '{}'::jsonb,
    logo_url text,
    scraped_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval)
);

-- sequence_analytics_cache  [TABLE]
CREATE TABLE public.sequence_analytics_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sequence_template_id uuid NOT NULL,
    total_enrolled integer DEFAULT 0 NOT NULL,
    total_active integer DEFAULT 0 NOT NULL,
    total_completed integer DEFAULT 0 NOT NULL,
    total_responded integer DEFAULT 0 NOT NULL,
    response_rate double precision DEFAULT 0 NOT NULL,
    avg_step_to_reply double precision,
    step_funnel_data jsonb DEFAULT '[]'::jsonb NOT NULL,
    reply_quality jsonb DEFAULT '{}'::jsonb NOT NULL,
    variant_a_stats jsonb,
    variant_b_stats jsonb,
    last_computed_at timestamp with time zone DEFAULT now() NOT NULL
);

-- site_settings  [TABLE]
CREATE TABLE public.site_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- system_health_checks  [TABLE]
CREATE TABLE public.system_health_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    step_name text NOT NULL,
    status text NOT NULL,
    response_detail jsonb,
    error_message text,
    duration_ms integer,
    tested_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT system_health_checks_status_check CHECK ((status = ANY (ARRAY['pass'::text, 'fail'::text, 'running'::text])))
);

-- unsubscribed_prospects  [TABLE]
CREATE TABLE public.unsubscribed_prospects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prospect_id uuid,
    email text NOT NULL,
    reason text,
    unsubscribed_at timestamp with time zone DEFAULT now() NOT NULL
);

-- variable_fallbacks  [TABLE]
CREATE TABLE public.variable_fallbacks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    variable_key text NOT NULL,
    fallback_value text DEFAULT ''::text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- webhook_dedupe  [TABLE]
CREATE TABLE public.webhook_dedupe (
    message_key text NOT NULL,
    prospect_id uuid,
    inbox_message_id uuid,
    seen_count integer DEFAULT 1 NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);

-- webhook_endpoints  [TABLE]
CREATE TABLE public.webhook_endpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    token text NOT NULL,
    provider text DEFAULT 'manyreach'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    hit_count integer DEFAULT 0 NOT NULL,
    last_used_at timestamp with time zone,
    last_status integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- webhook_logs  [TABLE]
CREATE TABLE public.webhook_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    endpoint text NOT NULL,
    method text DEFAULT 'POST'::text,
    status text NOT NULL,
    status_code integer,
    response_ms integer,
    payload jsonb,
    response jsonb,
    error text,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT webhook_logs_status_check CHECK ((status = ANY (ARRAY['success'::text, 'failed'::text])))
);

-- ab_test_results ab_test_results_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.ab_test_results
    ADD CONSTRAINT ab_test_results_pkey PRIMARY KEY (id);

-- activity_logs activity_logs_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);

-- api_providers api_providers_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.api_providers
    ADD CONSTRAINT api_providers_pkey PRIMARY KEY (id);

-- audit_log audit_log_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

-- chatbot_conversations chatbot_conversations_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.chatbot_conversations
    ADD CONSTRAINT chatbot_conversations_pkey PRIMARY KEY (id);

-- chatbot_messages chatbot_messages_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.chatbot_messages
    ADD CONSTRAINT chatbot_messages_pkey PRIMARY KEY (id);

-- chatbot_sessions chatbot_sessions_chatbot_id_session_id_key  [CONSTRAINT]
ALTER TABLE ONLY public.chatbot_sessions
    ADD CONSTRAINT chatbot_sessions_chatbot_id_session_id_key UNIQUE (chatbot_id, session_id);

-- chatbot_sessions chatbot_sessions_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.chatbot_sessions
    ADD CONSTRAINT chatbot_sessions_pkey PRIMARY KEY (id);

-- chatbots chatbots_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.chatbots
    ADD CONSTRAINT chatbots_pkey PRIMARY KEY (id);

-- chatbots chatbots_slug_key  [CONSTRAINT]
ALTER TABLE ONLY public.chatbots
    ADD CONSTRAINT chatbots_slug_key UNIQUE (slug);

-- demo_job_steps demo_job_steps_job_id_step_key  [CONSTRAINT]
ALTER TABLE ONLY public.demo_job_steps
    ADD CONSTRAINT demo_job_steps_job_id_step_key UNIQUE (job_id, step);

-- demo_job_steps demo_job_steps_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.demo_job_steps
    ADD CONSTRAINT demo_job_steps_pkey PRIMARY KEY (id);

-- demo_jobs demo_jobs_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.demo_jobs
    ADD CONSTRAINT demo_jobs_pkey PRIMARY KEY (id);

-- demo_leads demo_leads_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.demo_leads
    ADD CONSTRAINT demo_leads_pkey PRIMARY KEY (id);

-- demo_open_log demo_open_log_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.demo_open_log
    ADD CONSTRAINT demo_open_log_pkey PRIMARY KEY (id);

-- demo_pages demo_pages_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.demo_pages
    ADD CONSTRAINT demo_pages_pkey PRIMARY KEY (id);

-- demo_pages demo_pages_slug_key  [CONSTRAINT]
ALTER TABLE ONLY public.demo_pages
    ADD CONSTRAINT demo_pages_slug_key UNIQUE (slug);

-- ecommerce_landing_template ecommerce_landing_template_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.ecommerce_landing_template
    ADD CONSTRAINT ecommerce_landing_template_pkey PRIMARY KEY (id);

-- ecommerce_landing_template ecommerce_landing_template_singleton_key  [CONSTRAINT]
ALTER TABLE ONLY public.ecommerce_landing_template
    ADD CONSTRAINT ecommerce_landing_template_singleton_key UNIQUE (singleton);

-- email_queue email_queue_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_pkey PRIMARY KEY (id);

-- error_events error_events_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.error_events
    ADD CONSTRAINT error_events_pkey PRIMARY KEY (id);

-- follow_up_enrollments follow_up_enrollments_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.follow_up_enrollments
    ADD CONSTRAINT follow_up_enrollments_pkey PRIMARY KEY (id);

-- follow_up_sequences_templates follow_up_sequences_templates_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.follow_up_sequences_templates
    ADD CONSTRAINT follow_up_sequences_templates_pkey PRIMARY KEY (id);

-- follow_up_steps follow_up_steps_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.follow_up_steps
    ADD CONSTRAINT follow_up_steps_pkey PRIMARY KEY (id);

-- follow_up_steps follow_up_steps_sequence_template_id_step_number_key  [CONSTRAINT]
ALTER TABLE ONLY public.follow_up_steps
    ADD CONSTRAINT follow_up_steps_sequence_template_id_step_number_key UNIQUE (sequence_template_id, step_number);

-- follow_up_templates follow_up_templates_condition_key  [CONSTRAINT]
ALTER TABLE ONLY public.follow_up_templates
    ADD CONSTRAINT follow_up_templates_condition_key UNIQUE (condition);

-- follow_up_templates follow_up_templates_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.follow_up_templates
    ADD CONSTRAINT follow_up_templates_pkey PRIMARY KEY (id);

-- followup_events followup_events_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.followup_events
    ADD CONSTRAINT followup_events_pkey PRIMARY KEY (id);

-- followup_rules followup_rules_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.followup_rules
    ADD CONSTRAINT followup_rules_pkey PRIMARY KEY (id);

-- followup_rules followup_rules_trigger_key_key  [CONSTRAINT]
ALTER TABLE ONLY public.followup_rules
    ADD CONSTRAINT followup_rules_trigger_key_key UNIQUE (trigger_key);

-- followup_settings followup_settings_key_key  [CONSTRAINT]
ALTER TABLE ONLY public.followup_settings
    ADD CONSTRAINT followup_settings_key_key UNIQUE (key);

-- followup_settings followup_settings_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.followup_settings
    ADD CONSTRAINT followup_settings_pkey PRIMARY KEY (id);

-- inbox_demos inbox_demos_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.inbox_demos
    ADD CONSTRAINT inbox_demos_pkey PRIMARY KEY (id);

-- inbox_messages inbox_messages_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.inbox_messages
    ADD CONSTRAINT inbox_messages_pkey PRIMARY KEY (id);

-- inbox_prompts inbox_prompts_classification_key  [CONSTRAINT]
ALTER TABLE ONLY public.inbox_prompts
    ADD CONSTRAINT inbox_prompts_classification_key UNIQUE (classification);

-- inbox_prompts inbox_prompts_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.inbox_prompts
    ADD CONSTRAINT inbox_prompts_pkey PRIMARY KEY (id);

-- industry_templates industry_templates_industry_name_key  [CONSTRAINT]
ALTER TABLE ONLY public.industry_templates
    ADD CONSTRAINT industry_templates_industry_name_key UNIQUE (industry_name);

-- industry_templates industry_templates_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.industry_templates
    ADD CONSTRAINT industry_templates_pkey PRIMARY KEY (id);

-- knowledge_base_entries knowledge_base_entries_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.knowledge_base_entries
    ADD CONSTRAINT knowledge_base_entries_pkey PRIMARY KEY (id);

-- knowledge_base_jobs knowledge_base_jobs_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.knowledge_base_jobs
    ADD CONSTRAINT knowledge_base_jobs_pkey PRIMARY KEY (id);

-- lead_follow_ups lead_follow_ups_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.lead_follow_ups
    ADD CONSTRAINT lead_follow_ups_pkey PRIMARY KEY (id);

-- leads leads_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);

-- link_events link_events_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.link_events
    ADD CONSTRAINT link_events_pkey PRIMARY KEY (id);

-- manyreach_logs manyreach_logs_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.manyreach_logs
    ADD CONSTRAINT manyreach_logs_pkey PRIMARY KEY (id);

-- node_prompts node_prompts_node_name_key  [CONSTRAINT]
ALTER TABLE ONLY public.node_prompts
    ADD CONSTRAINT node_prompts_node_name_key UNIQUE (node_name);

-- node_prompts node_prompts_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.node_prompts
    ADD CONSTRAINT node_prompts_pkey PRIMARY KEY (id);

-- notifications notifications_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

-- pipeline_events pipeline_events_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.pipeline_events
    ADD CONSTRAINT pipeline_events_pkey PRIMARY KEY (id);

-- pipeline_locks pipeline_locks_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.pipeline_locks
    ADD CONSTRAINT pipeline_locks_pkey PRIMARY KEY (lock_key);

-- products products_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

-- prompt_improvement_suggestions prompt_improvement_suggestions_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.prompt_improvement_suggestions
    ADD CONSTRAINT prompt_improvement_suggestions_pkey PRIMARY KEY (id);

-- prompt_versions prompt_versions_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.prompt_versions
    ADD CONSTRAINT prompt_versions_pkey PRIMARY KEY (id);

-- property_listings property_listings_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.property_listings
    ADD CONSTRAINT property_listings_pkey PRIMARY KEY (id);

-- prospect_activity_times prospect_activity_times_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.prospect_activity_times
    ADD CONSTRAINT prospect_activity_times_pkey PRIMARY KEY (id);

-- prospect_memory prospect_memory_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.prospect_memory
    ADD CONSTRAINT prospect_memory_pkey PRIMARY KEY (id);

-- prospect_memory prospect_memory_prospect_id_key  [CONSTRAINT]
ALTER TABLE ONLY public.prospect_memory
    ADD CONSTRAINT prospect_memory_prospect_id_key UNIQUE (prospect_id);

-- prospects prospects_email_key  [CONSTRAINT]
ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_email_key UNIQUE (email);

-- prospects prospects_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.prospects
    ADD CONSTRAINT prospects_pkey PRIMARY KEY (id);

-- realestate_profiles realestate_profiles_chatbot_id_key  [CONSTRAINT]
ALTER TABLE ONLY public.realestate_profiles
    ADD CONSTRAINT realestate_profiles_chatbot_id_key UNIQUE (chatbot_id);

-- realestate_profiles realestate_profiles_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.realestate_profiles
    ADD CONSTRAINT realestate_profiles_pkey PRIMARY KEY (id);

-- reply_templates reply_templates_classification_phase_key  [CONSTRAINT]
ALTER TABLE ONLY public.reply_templates
    ADD CONSTRAINT reply_templates_classification_phase_key UNIQUE (classification, phase);

-- reply_templates reply_templates_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.reply_templates
    ADD CONSTRAINT reply_templates_pkey PRIMARY KEY (id);

-- scraped_data scraped_data_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.scraped_data
    ADD CONSTRAINT scraped_data_pkey PRIMARY KEY (id);

-- scraped_data scraped_data_website_url_key  [CONSTRAINT]
ALTER TABLE ONLY public.scraped_data
    ADD CONSTRAINT scraped_data_website_url_key UNIQUE (website_url);

-- sequence_analytics_cache sequence_analytics_cache_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.sequence_analytics_cache
    ADD CONSTRAINT sequence_analytics_cache_pkey PRIMARY KEY (id);

-- sequence_analytics_cache sequence_analytics_cache_sequence_template_id_key  [CONSTRAINT]
ALTER TABLE ONLY public.sequence_analytics_cache
    ADD CONSTRAINT sequence_analytics_cache_sequence_template_id_key UNIQUE (sequence_template_id);

-- site_settings site_settings_key_key  [CONSTRAINT]
ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_key_key UNIQUE (key);

-- site_settings site_settings_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);

-- system_health_checks system_health_checks_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.system_health_checks
    ADD CONSTRAINT system_health_checks_pkey PRIMARY KEY (id);

-- unsubscribed_prospects unsubscribed_prospects_email_key  [CONSTRAINT]
ALTER TABLE ONLY public.unsubscribed_prospects
    ADD CONSTRAINT unsubscribed_prospects_email_key UNIQUE (email);

-- unsubscribed_prospects unsubscribed_prospects_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.unsubscribed_prospects
    ADD CONSTRAINT unsubscribed_prospects_pkey PRIMARY KEY (id);

-- unsubscribed_prospects unsubscribed_prospects_prospect_id_key  [CONSTRAINT]
ALTER TABLE ONLY public.unsubscribed_prospects
    ADD CONSTRAINT unsubscribed_prospects_prospect_id_key UNIQUE (prospect_id);

-- variable_fallbacks variable_fallbacks_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.variable_fallbacks
    ADD CONSTRAINT variable_fallbacks_pkey PRIMARY KEY (id);

-- variable_fallbacks variable_fallbacks_variable_key_key  [CONSTRAINT]
ALTER TABLE ONLY public.variable_fallbacks
    ADD CONSTRAINT variable_fallbacks_variable_key_key UNIQUE (variable_key);

-- webhook_dedupe webhook_dedupe_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.webhook_dedupe
    ADD CONSTRAINT webhook_dedupe_pkey PRIMARY KEY (message_key);

-- webhook_endpoints webhook_endpoints_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.webhook_endpoints
    ADD CONSTRAINT webhook_endpoints_pkey PRIMARY KEY (id);

-- webhook_endpoints webhook_endpoints_token_key  [CONSTRAINT]
ALTER TABLE ONLY public.webhook_endpoints
    ADD CONSTRAINT webhook_endpoints_token_key UNIQUE (token);

-- webhook_logs webhook_logs_pkey  [CONSTRAINT]
ALTER TABLE ONLY public.webhook_logs
    ADD CONSTRAINT webhook_logs_pkey PRIMARY KEY (id);

-- enrollments_next_idx  [INDEX]
CREATE INDEX enrollments_next_idx ON public.follow_up_enrollments USING btree (status, next_step_at);

-- enrollments_prospect_idx  [INDEX]
CREATE INDEX enrollments_prospect_idx ON public.follow_up_enrollments USING btree (prospect_id);

-- error_events_created_idx  [INDEX]
CREATE INDEX error_events_created_idx ON public.error_events USING btree (created_at DESC);

-- follow_up_steps_seq_idx  [INDEX]
CREATE INDEX follow_up_steps_seq_idx ON public.follow_up_steps USING btree (sequence_template_id, step_number);

-- followup_events_prospect_idx  [INDEX]
CREATE INDEX followup_events_prospect_idx ON public.followup_events USING btree (prospect_id);

-- followup_events_status_scheduled_idx  [INDEX]
CREATE INDEX followup_events_status_scheduled_idx ON public.followup_events USING btree (status, scheduled_at);

-- idx_audit_log_created  [INDEX]
CREATE INDEX idx_audit_log_created ON public.audit_log USING btree (created_at DESC);

-- idx_chatbot_messages_quality  [INDEX]
CREATE INDEX idx_chatbot_messages_quality ON public.chatbot_messages USING btree (response_quality_score) WHERE (response_quality_score IS NOT NULL);

-- idx_chatbot_messages_session  [INDEX]
CREATE INDEX idx_chatbot_messages_session ON public.chatbot_messages USING btree (session_id, created_at);

-- idx_chatbot_sessions_chatbot  [INDEX]
CREATE INDEX idx_chatbot_sessions_chatbot ON public.chatbot_sessions USING btree (chatbot_id, last_message_at DESC);

-- idx_chatbot_sessions_ended  [INDEX]
CREATE INDEX idx_chatbot_sessions_ended ON public.chatbot_sessions USING btree (ended_at DESC) WHERE (ended_at IS NOT NULL);

-- idx_chatbot_sessions_flagged  [INDEX]
CREATE INDEX idx_chatbot_sessions_flagged ON public.chatbot_sessions USING btree (flagged_for_review) WHERE (flagged_for_review = true);

-- idx_chatbot_sessions_outcome  [INDEX]
CREATE INDEX idx_chatbot_sessions_outcome ON public.chatbot_sessions USING btree (outcome);

-- idx_demo_job_steps_job  [INDEX]
CREATE INDEX idx_demo_job_steps_job ON public.demo_job_steps USING btree (job_id, step_order);

-- idx_demo_jobs_status  [INDEX]
CREATE INDEX idx_demo_jobs_status ON public.demo_jobs USING btree (status, created_at DESC);

-- idx_demo_leads_fingerprint  [INDEX]
CREATE INDEX idx_demo_leads_fingerprint ON public.demo_leads USING btree (fingerprint);

-- idx_demo_leads_slug  [INDEX]
CREATE INDEX idx_demo_leads_slug ON public.demo_leads USING btree (slug);

-- idx_demo_leads_status  [INDEX]
CREATE INDEX idx_demo_leads_status ON public.demo_leads USING btree (status);

-- idx_dol_prospect_time  [INDEX]
CREATE INDEX idx_dol_prospect_time ON public.demo_open_log USING btree (prospect_id, opened_at DESC);

-- idx_email_queue_lead  [INDEX]
CREATE INDEX idx_email_queue_lead ON public.email_queue USING btree (lead_id);

-- idx_email_queue_status_scheduled  [INDEX]
CREATE INDEX idx_email_queue_status_scheduled ON public.email_queue USING btree (status, scheduled_at);

-- idx_health_tested_at  [INDEX]
CREATE INDEX idx_health_tested_at ON public.system_health_checks USING btree (tested_at DESC);

-- idx_inbox_demos_prospect  [INDEX]
CREATE INDEX idx_inbox_demos_prospect ON public.inbox_demos USING btree (prospect_id);

-- idx_inbox_messages_prospect  [INDEX]
CREATE INDEX idx_inbox_messages_prospect ON public.inbox_messages USING btree (prospect_id, created_at DESC);

-- idx_inbox_messages_test  [INDEX]
CREATE INDEX idx_inbox_messages_test ON public.inbox_messages USING btree (is_test_data);

-- idx_kb_entries_chatbot  [INDEX]
CREATE INDEX idx_kb_entries_chatbot ON public.knowledge_base_entries USING btree (chatbot_id);

-- idx_kb_entries_embedding  [INDEX]
CREATE INDEX idx_kb_entries_embedding ON public.knowledge_base_entries USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');

-- idx_kb_entries_type  [INDEX]
CREATE INDEX idx_kb_entries_type ON public.knowledge_base_entries USING btree (content_type);

-- idx_kb_jobs_chatbot  [INDEX]
CREATE INDEX idx_kb_jobs_chatbot ON public.knowledge_base_jobs USING btree (chatbot_id);

-- idx_leads_slug  [INDEX]
CREATE UNIQUE INDEX idx_leads_slug ON public.leads USING btree (slug);

-- idx_link_events_created  [INDEX]
CREATE INDEX idx_link_events_created ON public.link_events USING btree (created_at DESC);

-- idx_link_events_slug  [INDEX]
CREATE INDEX idx_link_events_slug ON public.link_events USING btree (slug);

-- idx_manyreach_logs_lead  [INDEX]
CREATE INDEX idx_manyreach_logs_lead ON public.manyreach_logs USING btree (lead_id);

-- idx_notif_unread  [INDEX]
CREATE INDEX idx_notif_unread ON public.notifications USING btree (read, created_at DESC);

-- idx_pat_event  [INDEX]
CREATE INDEX idx_pat_event ON public.prospect_activity_times USING btree (event_type);

-- idx_pat_prospect  [INDEX]
CREATE INDEX idx_pat_prospect ON public.prospect_activity_times USING btree (prospect_id);

-- idx_products_fts  [INDEX]
CREATE INDEX idx_products_fts ON public.products USING gin (to_tsvector('english'::regconfig, ((((((COALESCE(name, ''::text) || ' '::text) || COALESCE(description, ''::text)) || ' '::text) || COALESCE(category, ''::text)) || ' '::text) || COALESCE(vendor, ''::text))));

-- idx_prompt_versions_industry  [INDEX]
CREATE INDEX idx_prompt_versions_industry ON public.prompt_versions USING btree (industry, created_at DESC);

-- idx_property_listings_chatbot  [INDEX]
CREATE INDEX idx_property_listings_chatbot ON public.property_listings USING btree (chatbot_id);

-- idx_property_listings_fts  [INDEX]
CREATE INDEX idx_property_listings_fts ON public.property_listings USING gin (to_tsvector('english'::regconfig, ((((((COALESCE(address, ''::text) || ' '::text) || COALESCE(city, ''::text)) || ' '::text) || COALESCE(property_type, ''::text)) || ' '::text) || COALESCE(description_raw, ''::text))));

-- idx_prospect_memory_prospect  [INDEX]
CREATE INDEX idx_prospect_memory_prospect ON public.prospect_memory USING btree (prospect_id);

-- idx_prospects_hot  [INDEX]
CREATE INDEX idx_prospects_hot ON public.prospects USING btree (is_hot_lead, hot_lead_detected_at DESC);

-- idx_prospects_test  [INDEX]
CREATE INDEX idx_prospects_test ON public.prospects USING btree (is_test_data);

-- idx_webhook_endpoints_token  [INDEX]
CREATE INDEX idx_webhook_endpoints_token ON public.webhook_endpoints USING btree (token);

-- link_events_self_traffic_idx  [INDEX]
CREATE INDEX link_events_self_traffic_idx ON public.link_events USING btree (is_self_traffic, created_at DESC);

-- link_events_slug_created_idx  [INDEX]
CREATE INDEX link_events_slug_created_idx ON public.link_events USING btree (slug, created_at DESC);

-- pipeline_events_msg_idx  [INDEX]
CREATE INDEX pipeline_events_msg_idx ON public.pipeline_events USING btree (message_id, created_at);

-- pipeline_events_prospect_idx  [INDEX]
CREATE INDEX pipeline_events_prospect_idx ON public.pipeline_events USING btree (prospect_id, created_at);

-- products_chatbot_handle_unique  [INDEX]
CREATE UNIQUE INDEX products_chatbot_handle_unique ON public.products USING btree (chatbot_id, handle) WHERE (handle IS NOT NULL);

-- products_chatbot_id_idx  [INDEX]
CREATE INDEX products_chatbot_id_idx ON public.products USING btree (chatbot_id);

-- products_embedding_idx  [INDEX]
CREATE INDEX products_embedding_idx ON public.products USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');

-- webhook_logs_created_idx  [INDEX]
CREATE INDEX webhook_logs_created_idx ON public.webhook_logs USING btree (created_at DESC);

-- ab_test_results ab_test_results_sequence_template_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.ab_test_results
    ADD CONSTRAINT ab_test_results_sequence_template_id_fkey FOREIGN KEY (sequence_template_id) REFERENCES public.follow_up_sequences_templates(id) ON DELETE CASCADE;

-- chatbot_conversations chatbot_conversations_chatbot_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.chatbot_conversations
    ADD CONSTRAINT chatbot_conversations_chatbot_id_fkey FOREIGN KEY (chatbot_id) REFERENCES public.chatbots(id) ON DELETE CASCADE;

-- chatbot_messages chatbot_messages_chatbot_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.chatbot_messages
    ADD CONSTRAINT chatbot_messages_chatbot_id_fkey FOREIGN KEY (chatbot_id) REFERENCES public.chatbots(id) ON DELETE CASCADE;

-- chatbot_messages chatbot_messages_session_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.chatbot_messages
    ADD CONSTRAINT chatbot_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chatbot_sessions(id) ON DELETE CASCADE;

-- chatbot_sessions chatbot_sessions_chatbot_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.chatbot_sessions
    ADD CONSTRAINT chatbot_sessions_chatbot_id_fkey FOREIGN KEY (chatbot_id) REFERENCES public.chatbots(id) ON DELETE CASCADE;

-- chatbot_sessions chatbot_sessions_demo_page_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.chatbot_sessions
    ADD CONSTRAINT chatbot_sessions_demo_page_id_fkey FOREIGN KEY (demo_page_id) REFERENCES public.demo_pages(id) ON DELETE SET NULL;

-- chatbots chatbots_demo_page_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.chatbots
    ADD CONSTRAINT chatbots_demo_page_id_fkey FOREIGN KEY (demo_page_id) REFERENCES public.demo_pages(id) ON DELETE SET NULL;

-- demo_job_steps demo_job_steps_job_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.demo_job_steps
    ADD CONSTRAINT demo_job_steps_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.demo_jobs(id) ON DELETE CASCADE;

-- demo_jobs demo_jobs_prospect_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.demo_jobs
    ADD CONSTRAINT demo_jobs_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE SET NULL;

-- demo_open_log demo_open_log_prospect_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.demo_open_log
    ADD CONSTRAINT demo_open_log_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;

-- follow_up_enrollments follow_up_enrollments_prospect_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.follow_up_enrollments
    ADD CONSTRAINT follow_up_enrollments_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;

-- follow_up_enrollments follow_up_enrollments_sequence_template_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.follow_up_enrollments
    ADD CONSTRAINT follow_up_enrollments_sequence_template_id_fkey FOREIGN KEY (sequence_template_id) REFERENCES public.follow_up_sequences_templates(id) ON DELETE CASCADE;

-- follow_up_steps follow_up_steps_sequence_template_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.follow_up_steps
    ADD CONSTRAINT follow_up_steps_sequence_template_id_fkey FOREIGN KEY (sequence_template_id) REFERENCES public.follow_up_sequences_templates(id) ON DELETE CASCADE;

-- followup_events followup_events_prospect_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.followup_events
    ADD CONSTRAINT followup_events_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;

-- inbox_demos inbox_demos_prospect_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.inbox_demos
    ADD CONSTRAINT inbox_demos_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;

-- inbox_messages inbox_messages_prospect_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.inbox_messages
    ADD CONSTRAINT inbox_messages_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;

-- lead_follow_ups lead_follow_ups_lead_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.lead_follow_ups
    ADD CONSTRAINT lead_follow_ups_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

-- link_events link_events_chatbot_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.link_events
    ADD CONSTRAINT link_events_chatbot_id_fkey FOREIGN KEY (chatbot_id) REFERENCES public.chatbots(id) ON DELETE SET NULL;

-- link_events link_events_demo_page_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.link_events
    ADD CONSTRAINT link_events_demo_page_id_fkey FOREIGN KEY (demo_page_id) REFERENCES public.demo_pages(id) ON DELETE CASCADE;

-- notifications notifications_prospect_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;

-- pipeline_events pipeline_events_message_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.pipeline_events
    ADD CONSTRAINT pipeline_events_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.inbox_messages(id) ON DELETE CASCADE;

-- pipeline_events pipeline_events_prospect_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.pipeline_events
    ADD CONSTRAINT pipeline_events_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;

-- prompt_improvement_suggestions prompt_improvement_suggestions_chatbot_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.prompt_improvement_suggestions
    ADD CONSTRAINT prompt_improvement_suggestions_chatbot_id_fkey FOREIGN KEY (chatbot_id) REFERENCES public.chatbots(id) ON DELETE CASCADE;

-- prompt_versions prompt_versions_chatbot_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.prompt_versions
    ADD CONSTRAINT prompt_versions_chatbot_id_fkey FOREIGN KEY (chatbot_id) REFERENCES public.chatbots(id) ON DELETE CASCADE;

-- prospect_activity_times prospect_activity_times_prospect_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.prospect_activity_times
    ADD CONSTRAINT prospect_activity_times_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;

-- prospect_memory prospect_memory_prospect_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.prospect_memory
    ADD CONSTRAINT prospect_memory_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;

-- sequence_analytics_cache sequence_analytics_cache_sequence_template_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.sequence_analytics_cache
    ADD CONSTRAINT sequence_analytics_cache_sequence_template_id_fkey FOREIGN KEY (sequence_template_id) REFERENCES public.follow_up_sequences_templates(id) ON DELETE CASCADE;

-- unsubscribed_prospects unsubscribed_prospects_prospect_id_fkey  [FK CONSTRAINT]
ALTER TABLE ONLY public.unsubscribed_prospects
    ADD CONSTRAINT unsubscribed_prospects_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE;
