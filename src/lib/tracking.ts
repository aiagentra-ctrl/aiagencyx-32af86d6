import { supabase } from "@/integrations/supabase/client";

let sessionId: string | null = null;

const getSessionId = (): string => {
  if (sessionId) return sessionId;
  sessionId = sessionStorage.getItem("tracking_sid");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("tracking_sid", sessionId);
  }
  return sessionId;
};

export const trackEvent = async (
  slug: string,
  eventType: string,
  options?: {
    linkType?: string;
    demoPageId?: string;
    chatbotId?: string;
    businessName?: string;
    metadata?: Record<string, any>;
  }
) => {
  try {
    await supabase.functions.invoke("track-event", {
      body: {
        slug,
        event_type: eventType,
        link_type: options?.linkType || "demo",
        session_id: getSessionId(),
        demo_page_id: options?.demoPageId || null,
        chatbot_id: options?.chatbotId || null,
        business_name: options?.businessName || slug,
        metadata: options?.metadata || {},
      },
    });
  } catch {
    // Tracking should never break the user experience
  }
};
