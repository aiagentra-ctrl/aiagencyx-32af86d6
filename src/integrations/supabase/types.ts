export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ab_test_results: {
        Row: {
          created_at: string
          declared_at: string | null
          enrollments: number
          id: string
          response_rate: number
          responses: number
          sequence_template_id: string
          variant: string
          winner_declared: boolean
          winner_variant: string | null
        }
        Insert: {
          created_at?: string
          declared_at?: string | null
          enrollments?: number
          id?: string
          response_rate?: number
          responses?: number
          sequence_template_id: string
          variant: string
          winner_declared?: boolean
          winner_variant?: string | null
        }
        Update: {
          created_at?: string
          declared_at?: string | null
          enrollments?: number
          id?: string
          response_rate?: number
          responses?: number
          sequence_template_id?: string
          variant?: string
          winner_declared?: boolean
          winner_variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_results_sequence_template_id_fkey"
            columns: ["sequence_template_id"]
            isOneToOne: false
            referencedRelation: "follow_up_sequences_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message: string
          metadata: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message: string
          metadata?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          metadata?: Json | null
          status?: string
        }
        Relationships: []
      }
      agent_appointments: {
        Row: {
          calendar_event_id: string | null
          calendar_id: string | null
          chatbot_id: string | null
          city: string | null
          created_at: string
          dedupe_key: string
          email: string | null
          email_sent: boolean
          end_at: string | null
          estimator: string | null
          first_name: string
          id: string
          kind: string
          last_name: string | null
          market: string | null
          mode: string
          party_size: number | null
          phone: string
          project_detail: string
          slot_label: string | null
          start_at: string
          state: string | null
          street_address: string | null
          timezone: string | null
          zip: string | null
        }
        Insert: {
          calendar_event_id?: string | null
          calendar_id?: string | null
          chatbot_id?: string | null
          city?: string | null
          created_at?: string
          dedupe_key: string
          email?: string | null
          email_sent?: boolean
          end_at?: string | null
          estimator?: string | null
          first_name: string
          id?: string
          kind?: string
          last_name?: string | null
          market?: string | null
          mode?: string
          party_size?: number | null
          phone: string
          project_detail: string
          slot_label?: string | null
          start_at: string
          state?: string | null
          street_address?: string | null
          timezone?: string | null
          zip?: string | null
        }
        Update: {
          calendar_event_id?: string | null
          calendar_id?: string | null
          chatbot_id?: string | null
          city?: string | null
          created_at?: string
          dedupe_key?: string
          email?: string | null
          email_sent?: boolean
          end_at?: string | null
          estimator?: string | null
          first_name?: string
          id?: string
          kind?: string
          last_name?: string | null
          market?: string | null
          mode?: string
          party_size?: number | null
          phone?: string
          project_detail?: string
          slot_label?: string | null
          start_at?: string
          state?: string | null
          street_address?: string | null
          timezone?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      agent_office_notes: {
        Row: {
          address: string | null
          body: string | null
          chatbot_id: string | null
          created_at: string
          delivered: boolean
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          mode: string
          next_step: string | null
          phone: string | null
          project_detail: string | null
          reason: string | null
        }
        Insert: {
          address?: string | null
          body?: string | null
          chatbot_id?: string | null
          created_at?: string
          delivered?: boolean
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          mode?: string
          next_step?: string | null
          phone?: string | null
          project_detail?: string | null
          reason?: string | null
        }
        Update: {
          address?: string | null
          body?: string | null
          chatbot_id?: string | null
          created_at?: string
          delivered?: boolean
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          mode?: string
          next_step?: string | null
          phone?: string | null
          project_detail?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      agent_tool_events: {
        Row: {
          chatbot_id: string | null
          created_at: string
          id: string
          mode: string
          payload: Json
          result: Json
          tool: string
        }
        Insert: {
          chatbot_id?: string | null
          created_at?: string
          id?: string
          mode?: string
          payload?: Json
          result?: Json
          tool: string
        }
        Update: {
          chatbot_id?: string | null
          created_at?: string
          id?: string
          mode?: string
          payload?: Json
          result?: Json
          tool?: string
        }
        Relationships: []
      }
      agent_unbooked_leads: {
        Row: {
          address: string | null
          chatbot_id: string | null
          created_at: string
          dedupe_key: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          project_detail: string | null
          reason: string | null
        }
        Insert: {
          address?: string | null
          chatbot_id?: string | null
          created_at?: string
          dedupe_key: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          project_detail?: string | null
          reason?: string | null
        }
        Update: {
          address?: string | null
          chatbot_id?: string | null
          created_at?: string
          dedupe_key?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          project_detail?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      api_providers: {
        Row: {
          api_key: string
          category: string
          created_at: string
          endpoint_url: string | null
          id: string
          is_enabled: boolean
          model: string | null
          name: string
          priority: number
          provider_type: string
        }
        Insert: {
          api_key: string
          category?: string
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_enabled?: boolean
          model?: string | null
          name: string
          priority?: number
          provider_type?: string
        }
        Update: {
          api_key?: string
          category?: string
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_enabled?: boolean
          model?: string | null
          name?: string
          priority?: number
          provider_type?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          actor: string | null
          created_at: string
          detail: Json
          event: string
          id: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          detail?: Json
          event: string
          id?: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          detail?: Json
          event?: string
          id?: string
        }
        Relationships: []
      }
      chatbot_conversations: {
        Row: {
          chatbot_id: string
          created_at: string
          id: string
          messages: Json
          session_id: string
          updated_at: string
        }
        Insert: {
          chatbot_id: string
          created_at?: string
          id?: string
          messages?: Json
          session_id: string
          updated_at?: string
        }
        Update: {
          chatbot_id?: string
          created_at?: string
          id?: string
          messages?: Json
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_conversations_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_messages: {
        Row: {
          chatbot_id: string | null
          content: string
          created_at: string
          id: string
          products_shown: Json | null
          query_intent: string | null
          response_quality_score: number | null
          role: string
          session_id: string | null
          was_helpful: boolean | null
        }
        Insert: {
          chatbot_id?: string | null
          content: string
          created_at?: string
          id?: string
          products_shown?: Json | null
          query_intent?: string | null
          response_quality_score?: number | null
          role: string
          session_id?: string | null
          was_helpful?: boolean | null
        }
        Update: {
          chatbot_id?: string | null
          content?: string
          created_at?: string
          id?: string
          products_shown?: Json | null
          query_intent?: string | null
          response_quality_score?: number | null
          role?: string
          session_id?: string | null
          was_helpful?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_messages_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chatbot_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_sessions: {
        Row: {
          analysis: Json | null
          analyzed_at: string | null
          bot_messages: number
          business_name: string | null
          chatbot_id: string | null
          demo_page_id: string | null
          ended_at: string | null
          flag_reason: string | null
          flagged_for_review: boolean
          id: string
          interaction_type: string
          last_message_at: string
          outcome: string
          products_clicked: number
          products_shown: number
          sentiment: string | null
          sentiment_score: number | null
          session_id: string
          started_at: string
          topics: string[] | null
          total_messages: number
          user_messages: number
        }
        Insert: {
          analysis?: Json | null
          analyzed_at?: string | null
          bot_messages?: number
          business_name?: string | null
          chatbot_id?: string | null
          demo_page_id?: string | null
          ended_at?: string | null
          flag_reason?: string | null
          flagged_for_review?: boolean
          id?: string
          interaction_type?: string
          last_message_at?: string
          outcome?: string
          products_clicked?: number
          products_shown?: number
          sentiment?: string | null
          sentiment_score?: number | null
          session_id: string
          started_at?: string
          topics?: string[] | null
          total_messages?: number
          user_messages?: number
        }
        Update: {
          analysis?: Json | null
          analyzed_at?: string | null
          bot_messages?: number
          business_name?: string | null
          chatbot_id?: string | null
          demo_page_id?: string | null
          ended_at?: string | null
          flag_reason?: string | null
          flagged_for_review?: boolean
          id?: string
          interaction_type?: string
          last_message_at?: string
          outcome?: string
          products_clicked?: number
          products_shown?: number
          sentiment?: string | null
          sentiment_score?: number | null
          session_id?: string
          started_at?: string
          topics?: string[] | null
          total_messages?: number
          user_messages?: number
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_sessions_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_sessions_demo_page_id_fkey"
            columns: ["demo_page_id"]
            isOneToOne: false
            referencedRelation: "demo_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbots: {
        Row: {
          ai_model: string
          ai_provider: string
          api_key_encrypted: string | null
          brand_tone: string | null
          business_name: string
          created_at: string
          demo_page_id: string | null
          faq_topics: Json | null
          id: string
          industry: string | null
          kb_chatbot_md: string | null
          kb_voice_text: string | null
          logo_url: string | null
          match_confidence: string | null
          matched_industry: string | null
          product_count: number
          prompt_core: Json | null
          research_data: Json | null
          services: Json | null
          slug: string
          status: string
          store_name: string | null
          store_platform: string | null
          system_prompt: string
          template_overrides: Json
          vapi_file_ids: Json
          vapi_tool_ids: Json
          website_url: string | null
          widget_config: Json | null
        }
        Insert: {
          ai_model?: string
          ai_provider?: string
          api_key_encrypted?: string | null
          brand_tone?: string | null
          business_name: string
          created_at?: string
          demo_page_id?: string | null
          faq_topics?: Json | null
          id?: string
          industry?: string | null
          kb_chatbot_md?: string | null
          kb_voice_text?: string | null
          logo_url?: string | null
          match_confidence?: string | null
          matched_industry?: string | null
          product_count?: number
          prompt_core?: Json | null
          research_data?: Json | null
          services?: Json | null
          slug: string
          status?: string
          store_name?: string | null
          store_platform?: string | null
          system_prompt?: string
          template_overrides?: Json
          vapi_file_ids?: Json
          vapi_tool_ids?: Json
          website_url?: string | null
          widget_config?: Json | null
        }
        Update: {
          ai_model?: string
          ai_provider?: string
          api_key_encrypted?: string | null
          brand_tone?: string | null
          business_name?: string
          created_at?: string
          demo_page_id?: string | null
          faq_topics?: Json | null
          id?: string
          industry?: string | null
          kb_chatbot_md?: string | null
          kb_voice_text?: string | null
          logo_url?: string | null
          match_confidence?: string | null
          matched_industry?: string | null
          product_count?: number
          prompt_core?: Json | null
          research_data?: Json | null
          services?: Json | null
          slug?: string
          status?: string
          store_name?: string | null
          store_platform?: string | null
          system_prompt?: string
          template_overrides?: Json
          vapi_file_ids?: Json
          vapi_tool_ids?: Json
          website_url?: string | null
          widget_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbots_demo_page_id_fkey"
            columns: ["demo_page_id"]
            isOneToOne: false
            referencedRelation: "demo_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_job_steps: {
        Row: {
          attempt: number
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          job_id: string
          output: Json | null
          status: string
          step: string
          step_order: number
          updated_at: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          job_id: string
          output?: Json | null
          status?: string
          step: string
          step_order?: number
          updated_at?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          job_id?: string
          output?: Json | null
          status?: string
          step?: string
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_job_steps_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "demo_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_jobs: {
        Row: {
          attempt: number
          business_name: string | null
          created_at: string
          email: string | null
          id: string
          last_error: string | null
          prospect_id: string | null
          result: Json
          status: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          attempt?: number
          business_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_error?: string | null
          prospect_id?: string | null
          result?: Json
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          attempt?: number
          business_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_error?: string | null
          prospect_id?: string | null
          result?: Json
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_jobs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_leads: {
        Row: {
          bcc_emails: Json | null
          calendly_booked_at: string | null
          calendly_clicked_at: string | null
          campaign_id: string | null
          campaign_name: string | null
          cc_emails: Json | null
          chat_first_at: string | null
          company: string | null
          country_code: string | null
          created_at: string
          deepest_section: string | null
          demo_engagement_seconds: number
          demo_page_id: string | null
          demo_tried: boolean
          demo_type_tried: string | null
          engagement: Json
          engagement_channel: string | null
          engagement_tier: string
          exit_section: string | null
          feedback_link_clicked: boolean
          feedback_link_clicked_at: string | null
          feedback_link_visit_count: number
          feedback_requested: boolean
          fingerprint: string | null
          first_name: string | null
          follow_up_message_id: string | null
          follow_up_sent_at: string | null
          followup_case1_sent: boolean
          followup_case2_sent: boolean
          id: string
          industry: string | null
          is_complete: boolean
          last_visit_at: string | null
          lead_score: number
          lead_source: string | null
          message_thread_id: string | null
          score_tier: string | null
          sender_email: string | null
          slug: string
          status: string
          tried_chat: boolean
          tried_voice: boolean
          updated_at: string
          visitor_session_id: string | null
          voice_first_at: string | null
        }
        Insert: {
          bcc_emails?: Json | null
          calendly_booked_at?: string | null
          calendly_clicked_at?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          cc_emails?: Json | null
          chat_first_at?: string | null
          company?: string | null
          country_code?: string | null
          created_at?: string
          deepest_section?: string | null
          demo_engagement_seconds?: number
          demo_page_id?: string | null
          demo_tried?: boolean
          demo_type_tried?: string | null
          engagement?: Json
          engagement_channel?: string | null
          engagement_tier?: string
          exit_section?: string | null
          feedback_link_clicked?: boolean
          feedback_link_clicked_at?: string | null
          feedback_link_visit_count?: number
          feedback_requested?: boolean
          fingerprint?: string | null
          first_name?: string | null
          follow_up_message_id?: string | null
          follow_up_sent_at?: string | null
          followup_case1_sent?: boolean
          followup_case2_sent?: boolean
          id?: string
          industry?: string | null
          is_complete?: boolean
          last_visit_at?: string | null
          lead_score?: number
          lead_source?: string | null
          message_thread_id?: string | null
          score_tier?: string | null
          sender_email?: string | null
          slug: string
          status?: string
          tried_chat?: boolean
          tried_voice?: boolean
          updated_at?: string
          visitor_session_id?: string | null
          voice_first_at?: string | null
        }
        Update: {
          bcc_emails?: Json | null
          calendly_booked_at?: string | null
          calendly_clicked_at?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          cc_emails?: Json | null
          chat_first_at?: string | null
          company?: string | null
          country_code?: string | null
          created_at?: string
          deepest_section?: string | null
          demo_engagement_seconds?: number
          demo_page_id?: string | null
          demo_tried?: boolean
          demo_type_tried?: string | null
          engagement?: Json
          engagement_channel?: string | null
          engagement_tier?: string
          exit_section?: string | null
          feedback_link_clicked?: boolean
          feedback_link_clicked_at?: string | null
          feedback_link_visit_count?: number
          feedback_requested?: boolean
          fingerprint?: string | null
          first_name?: string | null
          follow_up_message_id?: string | null
          follow_up_sent_at?: string | null
          followup_case1_sent?: boolean
          followup_case2_sent?: boolean
          id?: string
          industry?: string | null
          is_complete?: boolean
          last_visit_at?: string | null
          lead_score?: number
          lead_source?: string | null
          message_thread_id?: string | null
          score_tier?: string | null
          sender_email?: string | null
          slug?: string
          status?: string
          tried_chat?: boolean
          tried_voice?: boolean
          updated_at?: string
          visitor_session_id?: string | null
          voice_first_at?: string | null
        }
        Relationships: []
      }
      demo_open_log: {
        Row: {
          demo_id: string | null
          id: string
          opened_at: string
          prospect_id: string
        }
        Insert: {
          demo_id?: string | null
          id?: string
          opened_at?: string
          prospect_id: string
        }
        Update: {
          demo_id?: string | null
          id?: string
          opened_at?: string
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_open_log_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_pages: {
        Row: {
          assistant_id: string
          benefits: Json | null
          business_name: string
          calendly_url: string | null
          client_name: string | null
          company_name: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          cta_text: string | null
          custom_subdomain: string | null
          description: string | null
          dynamic_content: Json | null
          features: Json | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          industry: string | null
          slug: string
          social_proof: Json | null
          vapi_key: string
          views: number
        }
        Insert: {
          assistant_id: string
          benefits?: Json | null
          business_name: string
          calendly_url?: string | null
          client_name?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          cta_text?: string | null
          custom_subdomain?: string | null
          description?: string | null
          dynamic_content?: Json | null
          features?: Json | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          industry?: string | null
          slug: string
          social_proof?: Json | null
          vapi_key: string
          views?: number
        }
        Update: {
          assistant_id?: string
          benefits?: Json | null
          business_name?: string
          calendly_url?: string | null
          client_name?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          cta_text?: string | null
          custom_subdomain?: string | null
          description?: string | null
          dynamic_content?: Json | null
          features?: Json | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          industry?: string | null
          slug?: string
          social_proof?: Json | null
          vapi_key?: string
          views?: number
        }
        Relationships: []
      }
      ecommerce_landing_template: {
        Row: {
          created_at: string
          cta_button: string
          cta_headline: string
          cta_sub: string
          demo_headline: string
          demo_sub: string
          footer_note: string
          hero_cta_primary: string
          hero_cta_secondary: string
          hero_headline: string
          hero_image_url: string
          hero_sub: string
          id: string
          image_cta: string
          image_headline: string
          image_sub: string
          intro_body: string
          intro_greeting: string
          proof_headline: string
          singleton: boolean
          suggestion_chips: Json
          updated_at: string
          urgency_line: string
          youtube_embed_url: string
        }
        Insert: {
          created_at?: string
          cta_button?: string
          cta_headline?: string
          cta_sub?: string
          demo_headline?: string
          demo_sub?: string
          footer_note?: string
          hero_cta_primary?: string
          hero_cta_secondary?: string
          hero_headline?: string
          hero_image_url?: string
          hero_sub?: string
          id?: string
          image_cta?: string
          image_headline?: string
          image_sub?: string
          intro_body?: string
          intro_greeting?: string
          proof_headline?: string
          singleton?: boolean
          suggestion_chips?: Json
          updated_at?: string
          urgency_line?: string
          youtube_embed_url?: string
        }
        Update: {
          created_at?: string
          cta_button?: string
          cta_headline?: string
          cta_sub?: string
          demo_headline?: string
          demo_sub?: string
          footer_note?: string
          hero_cta_primary?: string
          hero_cta_secondary?: string
          hero_headline?: string
          hero_image_url?: string
          hero_sub?: string
          id?: string
          image_cta?: string
          image_headline?: string
          image_sub?: string
          intro_body?: string
          intro_greeting?: string
          proof_headline?: string
          singleton?: boolean
          suggestion_chips?: Json
          updated_at?: string
          urgency_line?: string
          youtube_embed_url?: string
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          cancelled_reason: string | null
          created_at: string
          id: string
          lead_id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          cancelled_reason?: string | null
          created_at?: string
          id?: string
          lead_id: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          cancelled_reason?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      error_events: {
        Row: {
          acknowledged: boolean
          created_at: string
          id: string
          message: string
          message_id: string | null
          prospect_id: string | null
          source: string
          stack: string | null
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          message: string
          message_id?: string | null
          prospect_id?: string | null
          source: string
          stack?: string | null
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          message?: string
          message_id?: string | null
          prospect_id?: string | null
          source?: string
          stack?: string | null
        }
        Relationships: []
      }
      follow_up_enrollments: {
        Row: {
          assigned_variant: string
          best_send_day: number | null
          best_send_hour: number | null
          completed_at: string | null
          created_at: string
          current_step: number
          id: string
          last_error: string | null
          next_step_at: string | null
          prospect_id: string
          replied_at: string | null
          reply_classification: string | null
          retry_count: number
          scheduling_debug: Json
          sequence_template_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_variant?: string
          best_send_day?: number | null
          best_send_hour?: number | null
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          last_error?: string | null
          next_step_at?: string | null
          prospect_id: string
          replied_at?: string | null
          reply_classification?: string | null
          retry_count?: number
          scheduling_debug?: Json
          sequence_template_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_variant?: string
          best_send_day?: number | null
          best_send_hour?: number | null
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          last_error?: string | null
          next_step_at?: string | null
          prospect_id?: string
          replied_at?: string | null
          reply_classification?: string | null
          retry_count?: number
          scheduling_debug?: Json
          sequence_template_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_enrollments_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_enrollments_sequence_template_id_fkey"
            columns: ["sequence_template_id"]
            isOneToOne: false
            referencedRelation: "follow_up_sequences_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_sequences_templates: {
        Row: {
          ab_test_enabled: boolean
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_steps: number
          name: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          ab_test_enabled?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_steps?: number
          name: string
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          ab_test_enabled?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_steps?: number
          name?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      follow_up_steps: {
        Row: {
          created_at: string
          delay_unit: string
          delay_value: number
          id: string
          include_demo_link: boolean
          message_body: string
          message_subject: string
          sequence_template_id: string
          step_number: number
          updated_at: string
          variant: string
        }
        Insert: {
          created_at?: string
          delay_unit?: string
          delay_value?: number
          id?: string
          include_demo_link?: boolean
          message_body?: string
          message_subject?: string
          sequence_template_id: string
          step_number: number
          updated_at?: string
          variant?: string
        }
        Update: {
          created_at?: string
          delay_unit?: string
          delay_value?: number
          id?: string
          include_demo_link?: boolean
          message_body?: string
          message_subject?: string
          sequence_template_id?: string
          step_number?: number
          updated_at?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_steps_sequence_template_id_fkey"
            columns: ["sequence_template_id"]
            isOneToOne: false
            referencedRelation: "follow_up_sequences_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_templates: {
        Row: {
          body: string
          condition: string
          created_at: string
          id: string
          subject: string
          updated_at: string
        }
        Insert: {
          body?: string
          condition: string
          created_at?: string
          id?: string
          subject?: string
          updated_at?: string
        }
        Update: {
          body?: string
          condition?: string
          created_at?: string
          id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      followup_events: {
        Row: {
          attempt: number
          created_at: string
          error: string | null
          id: string
          manyreach_message_id: string | null
          message_body: string | null
          message_subject: string | null
          prospect_id: string
          scheduled_at: string
          sent_at: string | null
          sequence_enrollment_id: string | null
          source: string
          status: string
          trigger_key: string
          updated_at: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          error?: string | null
          id?: string
          manyreach_message_id?: string | null
          message_body?: string | null
          message_subject?: string | null
          prospect_id: string
          scheduled_at?: string
          sent_at?: string | null
          sequence_enrollment_id?: string | null
          source?: string
          status?: string
          trigger_key: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          error?: string | null
          id?: string
          manyreach_message_id?: string | null
          message_body?: string | null
          message_subject?: string | null
          prospect_id?: string
          scheduled_at?: string
          sent_at?: string | null
          sequence_enrollment_id?: string | null
          source?: string
          status?: string
          trigger_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_rules: {
        Row: {
          auto_send: boolean
          created_at: string
          delay_hours: number
          enabled: boolean
          id: string
          label: string
          prompt_override: string | null
          trigger_key: string
          updated_at: string
        }
        Insert: {
          auto_send?: boolean
          created_at?: string
          delay_hours?: number
          enabled?: boolean
          id?: string
          label: string
          prompt_override?: string | null
          trigger_key: string
          updated_at?: string
        }
        Update: {
          auto_send?: boolean
          created_at?: string
          delay_hours?: number
          enabled?: boolean
          id?: string
          label?: string
          prompt_override?: string | null
          trigger_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      followup_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      inbox_demos: {
        Row: {
          business_name: string | null
          created_at: string
          demo_url: string
          id: string
          prospect_id: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          demo_url: string
          id?: string
          prospect_id: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          demo_url?: string
          id?: string
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_demos_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_messages: {
        Row: {
          body: string
          classification: string | null
          classified_by: string | null
          created_at: string
          direction: string
          id: string
          is_test_data: boolean
          manyreach_message_id: string | null
          prospect_id: string
          source: string
          subject: string | null
        }
        Insert: {
          body: string
          classification?: string | null
          classified_by?: string | null
          created_at?: string
          direction: string
          id?: string
          is_test_data?: boolean
          manyreach_message_id?: string | null
          prospect_id: string
          source?: string
          subject?: string | null
        }
        Update: {
          body?: string
          classification?: string | null
          classified_by?: string | null
          created_at?: string
          direction?: string
          id?: string
          is_test_data?: boolean
          manyreach_message_id?: string | null
          prospect_id?: string
          source?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_messages_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_prompts: {
        Row: {
          classification: string
          id: string
          system_prompt: string
          updated_at: string
        }
        Insert: {
          classification: string
          id?: string
          system_prompt: string
          updated_at?: string
        }
        Update: {
          classification?: string
          id?: string
          system_prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      industry_templates: {
        Row: {
          chatbot_config: Json
          chatbot_nav_items: Json
          created_at: string
          display_name: string
          first_message_template: string
          floating_bubbles: Json
          hero_subtitle_template: string | null
          id: string
          industry_name: string
          priority: number
          problem_statements: Json
          status: string
          system_prompt_template: string
          updated_at: string
          voice_config: Json
          website_template: Json
        }
        Insert: {
          chatbot_config?: Json
          chatbot_nav_items?: Json
          created_at?: string
          display_name: string
          first_message_template?: string
          floating_bubbles?: Json
          hero_subtitle_template?: string | null
          id?: string
          industry_name: string
          priority?: number
          problem_statements?: Json
          status?: string
          system_prompt_template?: string
          updated_at?: string
          voice_config?: Json
          website_template?: Json
        }
        Update: {
          chatbot_config?: Json
          chatbot_nav_items?: Json
          created_at?: string
          display_name?: string
          first_message_template?: string
          floating_bubbles?: Json
          hero_subtitle_template?: string | null
          id?: string
          industry_name?: string
          priority?: number
          problem_statements?: Json
          status?: string
          system_prompt_template?: string
          updated_at?: string
          voice_config?: Json
          website_template?: Json
        }
        Relationships: []
      }
      knowledge_base_entries: {
        Row: {
          chatbot_id: string
          content: string
          content_type: string
          created_at: string
          embedding: string | null
          id: string
          source_url: string | null
          structured: Json | null
          title: string | null
          updated_at: string
        }
        Insert: {
          chatbot_id: string
          content: string
          content_type?: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_url?: string | null
          structured?: Json | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          chatbot_id?: string
          content?: string
          content_type?: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_url?: string | null
          structured?: Json | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_base_jobs: {
        Row: {
          chatbot_id: string
          completed_at: string | null
          created_at: string
          entries_created: number
          error: string | null
          id: string
          pages_scraped: number
          status: string
          website_url: string
        }
        Insert: {
          chatbot_id: string
          completed_at?: string | null
          created_at?: string
          entries_created?: number
          error?: string | null
          id?: string
          pages_scraped?: number
          status?: string
          website_url: string
        }
        Update: {
          chatbot_id?: string
          completed_at?: string | null
          created_at?: string
          entries_created?: number
          error?: string | null
          id?: string
          pages_scraped?: number
          status?: string
          website_url?: string
        }
        Relationships: []
      }
      lead_follow_ups: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          message: string
          stage: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          message: string
          stage?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          message?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_follow_ups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          business_name: string
          created_at: string
          follow_up_count: number
          id: string
          last_follow_up_at: string | null
          next_follow_up_at: string | null
          notes: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          business_name: string
          created_at?: string
          follow_up_count?: number
          id?: string
          last_follow_up_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_name?: string
          created_at?: string
          follow_up_count?: number
          id?: string
          last_follow_up_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      link_events: {
        Row: {
          business_name: string
          chatbot_id: string | null
          city: string | null
          country_code: string | null
          created_at: string
          demo_page_id: string | null
          event_type: string
          id: string
          is_self_traffic: boolean
          link_type: string
          metadata: Json | null
          referrer: string | null
          session_id: string | null
          slug: string
          user_agent: string | null
          visitor_ip: string | null
        }
        Insert: {
          business_name: string
          chatbot_id?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          demo_page_id?: string | null
          event_type: string
          id?: string
          is_self_traffic?: boolean
          link_type?: string
          metadata?: Json | null
          referrer?: string | null
          session_id?: string | null
          slug: string
          user_agent?: string | null
          visitor_ip?: string | null
        }
        Update: {
          business_name?: string
          chatbot_id?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          demo_page_id?: string | null
          event_type?: string
          id?: string
          is_self_traffic?: boolean
          link_type?: string
          metadata?: Json | null
          referrer?: string | null
          session_id?: string | null
          slug?: string
          user_agent?: string | null
          visitor_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_events_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_events_demo_page_id_fkey"
            columns: ["demo_page_id"]
            isOneToOne: false
            referencedRelation: "demo_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      manyreach_accounts: {
        Row: {
          active: boolean
          api_key: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          notes: string | null
          updated_at: string
          use_env_key: boolean
          webhook_secret: string | null
        }
        Insert: {
          active?: boolean
          api_key?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          use_env_key?: boolean
          webhook_secret?: string | null
        }
        Update: {
          active?: boolean
          api_key?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          use_env_key?: boolean
          webhook_secret?: string | null
        }
        Relationships: []
      }
      manyreach_logs: {
        Row: {
          campaign_id: string | null
          created_at: string
          error_message: string | null
          id: string
          lead_id: string | null
          lead_score: number | null
          request_payload: Json | null
          response_payload: Json | null
          slug: string | null
          status: string
          thread_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          lead_score?: number | null
          request_payload?: Json | null
          response_payload?: Json | null
          slug?: string | null
          status: string
          thread_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          lead_score?: number | null
          request_payload?: Json | null
          response_payload?: Json | null
          slug?: string | null
          status?: string
          thread_id?: string | null
        }
        Relationships: []
      }
      manyreach_mailboxes: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          label: string
          manyreach_account_id: string | null
          updated_at: string
          uses_default_account: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          label?: string
          manyreach_account_id?: string | null
          updated_at?: string
          uses_default_account?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          label?: string
          manyreach_account_id?: string | null
          updated_at?: string
          uses_default_account?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "manyreach_mailboxes_manyreach_account_id_fkey"
            columns: ["manyreach_account_id"]
            isOneToOne: false
            referencedRelation: "manyreach_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      node_prompts: {
        Row: {
          created_at: string
          id: string
          model: string
          node_name: string
          system_prompt: string
          updated_at: string
          user_prompt_template: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string
          node_name: string
          system_prompt: string
          updated_at?: string
          user_prompt_template?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          node_name?: string
          system_prompt?: string
          updated_at?: string
          user_prompt_template?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          prospect_id: string | null
          read: boolean
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          prospect_id?: string | null
          read?: boolean
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          prospect_id?: string | null
          read?: boolean
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_events: {
        Row: {
          created_at: string
          details: Json | null
          error: string | null
          id: string
          message_id: string | null
          prospect_id: string | null
          status: string
          step: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          error?: string | null
          id?: string
          message_id?: string | null
          prospect_id?: string | null
          status: string
          step: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          error?: string | null
          id?: string
          message_id?: string | null
          prospect_id?: string | null
          status?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "inbox_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_locks: {
        Row: {
          acquired_at: string
          expires_at: string
          holder: string | null
          lock_key: string
        }
        Insert: {
          acquired_at?: string
          expires_at?: string
          holder?: string | null
          lock_key: string
        }
        Update: {
          acquired_at?: string
          expires_at?: string
          holder?: string | null
          lock_key?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          chatbot_id: string
          compare_at_price: number | null
          created_at: string
          currency: string | null
          description: string | null
          embedding: string | null
          handle: string | null
          id: string
          image_url: string | null
          images: string[] | null
          in_stock: boolean | null
          metadata: Json | null
          name: string
          options: Json | null
          price: number | null
          product_url: string | null
          sku: string | null
          tags: string[] | null
          updated_at: string
          variants: Json | null
          vendor: string | null
        }
        Insert: {
          category?: string | null
          chatbot_id: string
          compare_at_price?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          embedding?: string | null
          handle?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          in_stock?: boolean | null
          metadata?: Json | null
          name: string
          options?: Json | null
          price?: number | null
          product_url?: string | null
          sku?: string | null
          tags?: string[] | null
          updated_at?: string
          variants?: Json | null
          vendor?: string | null
        }
        Update: {
          category?: string | null
          chatbot_id?: string
          compare_at_price?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          embedding?: string | null
          handle?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          in_stock?: boolean | null
          metadata?: Json | null
          name?: string
          options?: Json | null
          price?: number | null
          product_url?: string | null
          sku?: string | null
          tags?: string[] | null
          updated_at?: string
          variants?: Json | null
          vendor?: string | null
        }
        Relationships: []
      }
      prompt_improvement_suggestions: {
        Row: {
          applied_at: string | null
          chatbot_id: string | null
          created_at: string
          current_behavior: string | null
          evidence: Json | null
          id: string
          industry: string
          occurrence_count: number
          outcomes: Json | null
          sessions_analyzed: number | null
          status: string
          suggested_change: string | null
          suggestion_type: string | null
          suggestions: Json | null
          summary: string | null
        }
        Insert: {
          applied_at?: string | null
          chatbot_id?: string | null
          created_at?: string
          current_behavior?: string | null
          evidence?: Json | null
          id?: string
          industry?: string
          occurrence_count?: number
          outcomes?: Json | null
          sessions_analyzed?: number | null
          status?: string
          suggested_change?: string | null
          suggestion_type?: string | null
          suggestions?: Json | null
          summary?: string | null
        }
        Update: {
          applied_at?: string | null
          chatbot_id?: string | null
          created_at?: string
          current_behavior?: string | null
          evidence?: Json | null
          id?: string
          industry?: string
          occurrence_count?: number
          outcomes?: Json | null
          sessions_analyzed?: number | null
          status?: string
          suggested_change?: string | null
          suggestion_type?: string | null
          suggestions?: Json | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_improvement_suggestions_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_versions: {
        Row: {
          applied_by: string
          change_summary: string | null
          chatbot_id: string | null
          created_at: string
          id: string
          industry: string
          suggestions_applied: string[] | null
          system_prompt: string
          version_number: number
        }
        Insert: {
          applied_by?: string
          change_summary?: string | null
          chatbot_id?: string | null
          created_at?: string
          id?: string
          industry?: string
          suggestions_applied?: string[] | null
          system_prompt: string
          version_number?: number
        }
        Update: {
          applied_by?: string
          change_summary?: string | null
          chatbot_id?: string | null
          created_at?: string
          id?: string
          industry?: string
          suggestions_applied?: string[] | null
          system_prompt?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_chatbot_id_fkey"
            columns: ["chatbot_id"]
            isOneToOne: false
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      property_listings: {
        Row: {
          address: string | null
          bathrooms: number | null
          bedrooms: number | null
          chatbot_id: string
          city: string | null
          created_at: string
          description_raw: string | null
          embedding: string | null
          features: string[] | null
          hoa_fee: number | null
          id: string
          last_scraped: string | null
          listing_agent: string | null
          listing_id: string | null
          lot_size: string | null
          metadata: Json
          photos: string[] | null
          price: number | null
          property_type: string | null
          source_url: string | null
          sqft: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          chatbot_id: string
          city?: string | null
          created_at?: string
          description_raw?: string | null
          embedding?: string | null
          features?: string[] | null
          hoa_fee?: number | null
          id?: string
          last_scraped?: string | null
          listing_agent?: string | null
          listing_id?: string | null
          lot_size?: string | null
          metadata?: Json
          photos?: string[] | null
          price?: number | null
          property_type?: string | null
          source_url?: string | null
          sqft?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          chatbot_id?: string
          city?: string | null
          created_at?: string
          description_raw?: string | null
          embedding?: string | null
          features?: string[] | null
          hoa_fee?: number | null
          id?: string
          last_scraped?: string | null
          listing_agent?: string | null
          listing_id?: string | null
          lot_size?: string | null
          metadata?: Json
          photos?: string[] | null
          price?: number | null
          property_type?: string | null
          source_url?: string | null
          sqft?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prospect_activity_times: {
        Row: {
          created_at: string
          day_of_week: number
          event_type: string
          hour_of_day: number
          id: string
          prospect_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          event_type: string
          hour_of_day: number
          id?: string
          prospect_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          event_type?: string
          hour_of_day?: number
          id?: string
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_activity_times_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_memory: {
        Row: {
          classification_history: string[]
          conversation_stage: string
          created_at: string
          demo_behavior: Json
          demo_link_sent: boolean
          demo_link_sent_at: string | null
          demo_link_sent_in_message_id: string | null
          id: string
          last_classification: string | null
          last_reply_at: string | null
          lead_status: string
          optimal_send_window: Json
          pitch_count: number
          prospect_id: string
          reply_times: Json
          sequence_memory: Json
          total_replies_received: number
          updated_at: string
        }
        Insert: {
          classification_history?: string[]
          conversation_stage?: string
          created_at?: string
          demo_behavior?: Json
          demo_link_sent?: boolean
          demo_link_sent_at?: string | null
          demo_link_sent_in_message_id?: string | null
          id?: string
          last_classification?: string | null
          last_reply_at?: string | null
          lead_status?: string
          optimal_send_window?: Json
          pitch_count?: number
          prospect_id: string
          reply_times?: Json
          sequence_memory?: Json
          total_replies_received?: number
          updated_at?: string
        }
        Update: {
          classification_history?: string[]
          conversation_stage?: string
          created_at?: string
          demo_behavior?: Json
          demo_link_sent?: boolean
          demo_link_sent_at?: string | null
          demo_link_sent_in_message_id?: string | null
          id?: string
          last_classification?: string | null
          last_reply_at?: string | null
          lead_status?: string
          optimal_send_window?: Json
          pitch_count?: number
          prospect_id?: string
          reply_times?: Json
          sequence_memory?: Json
          total_replies_received?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_memory_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          automation_paused: boolean
          calendly_booked_at: string | null
          calendly_clicked_at: string | null
          campaign_id: string | null
          campaign_name: string | null
          chatbot_tried_at: string | null
          client_memory: Json
          company: string | null
          country_code: string | null
          created_at: string
          demo_engagement_seconds: number
          demo_link_clicked_at: string | null
          demo_page_opened_at: string | null
          demo_sent_at: string | null
          email: string
          engagement_channel: string | null
          engagement_tier: string
          first_interaction_at: string | null
          firstname: string | null
          followup_attempts: number
          followup_status: string
          hot_lead_detected_at: string | null
          hot_lead_open_count: number
          id: string
          is_hot_lead: boolean
          is_self_traffic: boolean
          is_test_data: boolean
          last_activity_at: string | null
          last_classification: string | null
          last_interaction_at: string | null
          last_message_at: string | null
          max_followup_attempts: number
          next_followup_at: string | null
          next_followup_trigger: string | null
          original_message_id: string | null
          reply_to_email: string | null
          sender_email: string | null
          updated_at: string
          voice_tried_at: string | null
          website_url: string | null
        }
        Insert: {
          automation_paused?: boolean
          calendly_booked_at?: string | null
          calendly_clicked_at?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          chatbot_tried_at?: string | null
          client_memory?: Json
          company?: string | null
          country_code?: string | null
          created_at?: string
          demo_engagement_seconds?: number
          demo_link_clicked_at?: string | null
          demo_page_opened_at?: string | null
          demo_sent_at?: string | null
          email: string
          engagement_channel?: string | null
          engagement_tier?: string
          first_interaction_at?: string | null
          firstname?: string | null
          followup_attempts?: number
          followup_status?: string
          hot_lead_detected_at?: string | null
          hot_lead_open_count?: number
          id?: string
          is_hot_lead?: boolean
          is_self_traffic?: boolean
          is_test_data?: boolean
          last_activity_at?: string | null
          last_classification?: string | null
          last_interaction_at?: string | null
          last_message_at?: string | null
          max_followup_attempts?: number
          next_followup_at?: string | null
          next_followup_trigger?: string | null
          original_message_id?: string | null
          reply_to_email?: string | null
          sender_email?: string | null
          updated_at?: string
          voice_tried_at?: string | null
          website_url?: string | null
        }
        Update: {
          automation_paused?: boolean
          calendly_booked_at?: string | null
          calendly_clicked_at?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          chatbot_tried_at?: string | null
          client_memory?: Json
          company?: string | null
          country_code?: string | null
          created_at?: string
          demo_engagement_seconds?: number
          demo_link_clicked_at?: string | null
          demo_page_opened_at?: string | null
          demo_sent_at?: string | null
          email?: string
          engagement_channel?: string | null
          engagement_tier?: string
          first_interaction_at?: string | null
          firstname?: string | null
          followup_attempts?: number
          followup_status?: string
          hot_lead_detected_at?: string | null
          hot_lead_open_count?: number
          id?: string
          is_hot_lead?: boolean
          is_self_traffic?: boolean
          is_test_data?: boolean
          last_activity_at?: string | null
          last_classification?: string | null
          last_interaction_at?: string | null
          last_message_at?: string | null
          max_followup_attempts?: number
          next_followup_at?: string | null
          next_followup_trigger?: string | null
          original_message_id?: string | null
          reply_to_email?: string | null
          sender_email?: string | null
          updated_at?: string
          voice_tried_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      realestate_profiles: {
        Row: {
          agency_record: Json
          booking_widget_detected: boolean
          business_type: string | null
          chatbot_id: string
          compliance_notes: string[] | null
          confidence: string | null
          core_job: string[] | null
          created_at: string
          generated_prompt: string | null
          id: string
          key_differentiators: string[] | null
          needs_human_review: boolean
          property_types: string[] | null
          service_area: string[] | null
          suggested_agent_persona_name: string | null
          tone_signals: string | null
          updated_at: string
        }
        Insert: {
          agency_record?: Json
          booking_widget_detected?: boolean
          business_type?: string | null
          chatbot_id: string
          compliance_notes?: string[] | null
          confidence?: string | null
          core_job?: string[] | null
          created_at?: string
          generated_prompt?: string | null
          id?: string
          key_differentiators?: string[] | null
          needs_human_review?: boolean
          property_types?: string[] | null
          service_area?: string[] | null
          suggested_agent_persona_name?: string | null
          tone_signals?: string | null
          updated_at?: string
        }
        Update: {
          agency_record?: Json
          booking_widget_detected?: boolean
          business_type?: string | null
          chatbot_id?: string
          compliance_notes?: string[] | null
          confidence?: string | null
          core_job?: string[] | null
          created_at?: string
          generated_prompt?: string | null
          id?: string
          key_differentiators?: string[] | null
          needs_human_review?: boolean
          property_types?: string[] | null
          service_area?: string[] | null
          suggested_agent_persona_name?: string | null
          tone_signals?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reply_templates: {
        Row: {
          body: string
          classification: string
          created_at: string
          id: string
          is_default: boolean
          locked_vars: string[]
          phase: string
          updated_at: string
        }
        Insert: {
          body: string
          classification: string
          created_at?: string
          id?: string
          is_default?: boolean
          locked_vars?: string[]
          phase?: string
          updated_at?: string
        }
        Update: {
          body?: string
          classification?: string
          created_at?: string
          id?: string
          is_default?: boolean
          locked_vars?: string[]
          phase?: string
          updated_at?: string
        }
        Relationships: []
      }
      scraped_data: {
        Row: {
          expires_at: string | null
          id: string
          logo_url: string | null
          raw_content: string | null
          scraped_at: string | null
          structured_data: Json | null
          website_url: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          logo_url?: string | null
          raw_content?: string | null
          scraped_at?: string | null
          structured_data?: Json | null
          website_url: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          logo_url?: string | null
          raw_content?: string | null
          scraped_at?: string | null
          structured_data?: Json | null
          website_url?: string
        }
        Relationships: []
      }
      sequence_analytics_cache: {
        Row: {
          avg_step_to_reply: number | null
          id: string
          last_computed_at: string
          reply_quality: Json
          response_rate: number
          sequence_template_id: string
          step_funnel_data: Json
          total_active: number
          total_completed: number
          total_enrolled: number
          total_responded: number
          variant_a_stats: Json | null
          variant_b_stats: Json | null
        }
        Insert: {
          avg_step_to_reply?: number | null
          id?: string
          last_computed_at?: string
          reply_quality?: Json
          response_rate?: number
          sequence_template_id: string
          step_funnel_data?: Json
          total_active?: number
          total_completed?: number
          total_enrolled?: number
          total_responded?: number
          variant_a_stats?: Json | null
          variant_b_stats?: Json | null
        }
        Update: {
          avg_step_to_reply?: number | null
          id?: string
          last_computed_at?: string
          reply_quality?: Json
          response_rate?: number
          sequence_template_id?: string
          step_funnel_data?: Json
          total_active?: number
          total_completed?: number
          total_enrolled?: number
          total_responded?: number
          variant_a_stats?: Json | null
          variant_b_stats?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_analytics_cache_sequence_template_id_fkey"
            columns: ["sequence_template_id"]
            isOneToOne: true
            referencedRelation: "follow_up_sequences_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      system_health_checks: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          id: string
          response_detail: Json | null
          status: string
          step_name: string
          tested_at: string
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          response_detail?: Json | null
          status: string
          step_name: string
          tested_at?: string
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          response_detail?: Json | null
          status?: string
          step_name?: string
          tested_at?: string
        }
        Relationships: []
      }
      unsubscribed_prospects: {
        Row: {
          email: string
          id: string
          prospect_id: string | null
          reason: string | null
          unsubscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          prospect_id?: string | null
          reason?: string | null
          unsubscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          prospect_id?: string | null
          reason?: string | null
          unsubscribed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unsubscribed_prospects_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      variable_fallbacks: {
        Row: {
          description: string | null
          fallback_value: string
          id: string
          updated_at: string
          variable_key: string
        }
        Insert: {
          description?: string | null
          fallback_value?: string
          id?: string
          updated_at?: string
          variable_key: string
        }
        Update: {
          description?: string | null
          fallback_value?: string
          id?: string
          updated_at?: string
          variable_key?: string
        }
        Relationships: []
      }
      webhook_dedupe: {
        Row: {
          first_seen_at: string
          inbox_message_id: string | null
          last_seen_at: string
          message_key: string
          prospect_id: string | null
          seen_count: number
        }
        Insert: {
          first_seen_at?: string
          inbox_message_id?: string | null
          last_seen_at?: string
          message_key: string
          prospect_id?: string | null
          seen_count?: number
        }
        Update: {
          first_seen_at?: string
          inbox_message_id?: string | null
          last_seen_at?: string
          message_key?: string
          prospect_id?: string | null
          seen_count?: number
        }
        Relationships: []
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          hit_count: number
          id: string
          label: string
          last_status: number | null
          last_used_at: string | null
          provider: string
          token: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          hit_count?: number
          id?: string
          label: string
          last_status?: number | null
          last_used_at?: string | null
          provider?: string
          token: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          hit_count?: number
          id?: string
          label?: string
          last_status?: number | null
          last_used_at?: string | null
          provider?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          endpoint: string
          error: string | null
          id: string
          method: string | null
          payload: Json | null
          response: Json | null
          response_ms: number | null
          source: string | null
          status: string
          status_code: number | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          error?: string | null
          id?: string
          method?: string | null
          payload?: Json | null
          response?: Json | null
          response_ms?: number | null
          source?: string | null
          status: string
          status_code?: number | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          error?: string | null
          id?: string
          method?: string | null
          payload?: Json | null
          response?: Json | null
          response_ms?: number | null
          source?: string | null
          status?: string
          status_code?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_best_send_time: {
        Args: { p_prospect_id: string }
        Returns: {
          best_day: number
          best_hour: number
          data_points: number
        }[]
      }
      match_kb_entries: {
        Args: {
          p_chatbot_id: string
          p_match_count?: number
          p_query_embedding: string
        }
        Returns: {
          content: string
          content_type: string
          id: string
          similarity: number
          source_url: string
          structured: Json
          title: string
        }[]
      }
      match_listings_hybrid: {
        Args: {
          p_chatbot_id: string
          p_filters?: Json
          p_match_count?: number
          p_query_embedding: string
          p_query_text: string
        }
        Returns: {
          address: string
          bathrooms: number
          bedrooms: number
          city: string
          combined_score: number
          description_raw: string
          features: string[]
          hoa_fee: number
          id: string
          last_scraped: string
          listing_agent: string
          listing_id: string
          photos: string[]
          price: number
          property_type: string
          source_url: string
          sqft: number
          status: string
          text_score: number
          vector_score: number
        }[]
      }
      match_products: {
        Args: {
          p_chatbot_id: string
          p_match_count?: number
          p_query_embedding: string
        }
        Returns: {
          category: string
          currency: string
          description: string
          id: string
          image_url: string
          name: string
          price: number
          product_url: string
          similarity: number
          sku: string
        }[]
      }
      match_products_hybrid: {
        Args: {
          p_chatbot_id: string
          p_filters?: Json
          p_match_count?: number
          p_query_embedding: string
          p_query_text: string
        }
        Returns: {
          category: string
          combined_score: number
          compare_at_price: number
          currency: string
          description: string
          id: string
          image_url: string
          images: string[]
          in_stock: boolean
          name: string
          options: Json
          price: number
          product_url: string
          sku: string
          text_score: number
          variants: Json
          vector_score: number
          vendor: string
        }[]
      }
      release_pipeline_lock: {
        Args: { p_holder: string; p_key: string }
        Returns: undefined
      }
      try_acquire_pipeline_lock: {
        Args: { p_holder: string; p_key: string; p_ttl_seconds?: number }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
