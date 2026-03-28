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

// Collect basic device info client-side for metadata enrichment
const getClientDeviceInfo = () => {
  const ua = navigator.userAgent;
  const screenWidth = window.screen?.width || 0;
  const screenHeight = window.screen?.height || 0;
  const language = navigator.language || "unknown";
  const timezone = Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || "unknown";
  return { screenWidth, screenHeight, language, timezone, pixelRatio: window.devicePixelRatio || 1 };
};

// Track recent events to prevent client-side duplicate fires
const recentEvents = new Map<string, number>();

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
    // Client-side dedupe: same slug+event within 3s
    const dedupeKey = `${slug}:${eventType}`;
    const lastFired = recentEvents.get(dedupeKey);
    if (lastFired && Date.now() - lastFired < 3000) return;
    recentEvents.set(dedupeKey, Date.now());

    // Clean old entries
    if (recentEvents.size > 50) {
      const cutoff = Date.now() - 10000;
      for (const [k, v] of recentEvents) {
        if (v < cutoff) recentEvents.delete(k);
      }
    }

    const deviceInfo = getClientDeviceInfo();

    await supabase.functions.invoke("track-event", {
      body: {
        slug,
        event_type: eventType,
        link_type: options?.linkType || "demo",
        session_id: getSessionId(),
        demo_page_id: options?.demoPageId || null,
        chatbot_id: options?.chatbotId || null,
        business_name: options?.businessName || slug,
        metadata: {
          ...(options?.metadata || {}),
          client_device: deviceInfo,
        },
      },
    });
  } catch {
    // Tracking should never break the user experience
  }
};
