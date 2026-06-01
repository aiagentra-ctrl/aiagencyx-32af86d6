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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
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
          product_count: number
          prompt_core: Json | null
          research_data: Json | null
          services: Json | null
          slug: string
          status: string
          store_name: string | null
          store_platform: string | null
          system_prompt: string
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
          product_count?: number
          prompt_core?: Json | null
          research_data?: Json | null
          services?: Json | null
          slug: string
          status?: string
          store_name?: string | null
          store_platform?: string | null
          system_prompt?: string
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
          product_count?: number
          prompt_core?: Json | null
          research_data?: Json | null
          services?: Json | null
          slug?: string
          status?: string
          store_name?: string | null
          store_platform?: string | null
          system_prompt?: string
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
      demo_leads: {
        Row: {
          bcc_emails: Json | null
          campaign_id: string | null
          campaign_name: string | null
          cc_emails: Json | null
          chat_first_at: string | null
          company: string | null
          country_code: string | null
          created_at: string
          demo_page_id: string | null
          demo_tried: boolean
          demo_type_tried: string | null
          engagement: Json
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
          campaign_id?: string | null
          campaign_name?: string | null
          cc_emails?: Json | null
          chat_first_at?: string | null
          company?: string | null
          country_code?: string | null
          created_at?: string
          demo_page_id?: string | null
          demo_tried?: boolean
          demo_type_tried?: string | null
          engagement?: Json
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
          campaign_id?: string | null
          campaign_name?: string | null
          cc_emails?: Json | null
          chat_first_at?: string | null
          company?: string | null
          country_code?: string | null
          created_at?: string
          demo_page_id?: string | null
          demo_tried?: boolean
          demo_type_tried?: string | null
          engagement?: Json
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
