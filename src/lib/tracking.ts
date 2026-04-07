import { supabase } from "@/integrations/supabase/client";

let sessionId: string | null = null;
let sessionStartTime: number | null = null;
let lastActiveTime: number | null = null;
let activeSeconds = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let isActive = true;
const IDLE_THRESHOLD = 30000; // 30s

const getSessionId = (): string => {
  if (sessionId) return sessionId;
  sessionId = sessionStorage.getItem("tracking_sid");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("tracking_sid", sessionId);
  }
  return sessionId;
};

const getClientDeviceInfo = () => {
  const screenWidth = window.screen?.width || 0;
  const screenHeight = window.screen?.height || 0;
  const language = navigator.language || "unknown";
  const timezone = Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || "unknown";
  return { screenWidth, screenHeight, language, timezone, pixelRatio: window.devicePixelRatio || 1 };
};

// Track recent events to prevent client-side duplicate fires
const recentEvents = new Map<string, number>();

// ── Activity tracking ──
const markActive = () => {
  const now = Date.now();
  if (!isActive && lastActiveTime) {
    // Was idle, now active again
    isActive = true;
  }
  lastActiveTime = now;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { isActive = false; }, IDLE_THRESHOLD);
};

let activityInterval: ReturnType<typeof setInterval> | null = null;

const startActivityTracking = () => {
  lastActiveTime = Date.now();
  isActive = true;
  
  const events = ["mousemove", "keydown", "scroll", "touchstart", "click"];
  events.forEach(e => window.addEventListener(e, markActive, { passive: true }));
  
  // Accumulate active seconds every second
  activityInterval = setInterval(() => {
    if (isActive) activeSeconds++;
  }, 1000);
};

const stopActivityTracking = () => {
  if (idleTimer) clearTimeout(idleTimer);
  if (activityInterval) clearInterval(activityInterval);
  const events = ["mousemove", "keydown", "scroll", "touchstart", "click"];
  events.forEach(e => window.removeEventListener(e, markActive));
};

// ── Section engagement tracking ──
const sectionTimers = new Map<string, number>();

export const trackSectionEnter = (section: string) => {
  sectionTimers.set(section, Date.now());
};

export const trackSectionLeave = (slug: string, section: string, options?: { demoPageId?: string; businessName?: string }) => {
  const startTime = sectionTimers.get(section);
  if (!startTime) return;
  const duration = Math.round((Date.now() - startTime) / 1000);
  sectionTimers.delete(section);
  if (duration < 2) return; // Ignore very short visits
  
  trackEvent(slug, "section_engagement", {
    ...options,
    metadata: { section, duration_seconds: duration },
  });
};

// ── Session lifecycle ──
export const trackSessionStart = (slug: string, options?: { demoPageId?: string; businessName?: string }) => {
  sessionStartTime = Date.now();
  sessionStorage.setItem("tracking_start", String(sessionStartTime));
  activeSeconds = 0;
  startActivityTracking();

  trackEvent(slug, "session_start", {
    ...options,
    metadata: { start_time: new Date(sessionStartTime).toISOString() },
  });
};

export const trackSessionEnd = (slug: string, options?: { demoPageId?: string; businessName?: string }) => {
  const startStr = sessionStorage.getItem("tracking_start");
  const start = startStr ? parseInt(startStr) : sessionStartTime;
  if (!start) return;

  const endTime = Date.now();
  const durationSeconds = Math.round((endTime - start) / 1000);

  // Reject invalid durations
  if (durationSeconds < 1 || durationSeconds > 86400) return;

  stopActivityTracking();

  // Use sendBeacon for reliable delivery on page unload
  const body = JSON.stringify({
    slug,
    event_type: "session_end",
    link_type: "demo",
    session_id: getSessionId(),
    demo_page_id: options?.demoPageId || null,
    chatbot_id: null,
    business_name: options?.businessName || slug,
    metadata: {
      start_time: new Date(start).toISOString(),
      end_time: new Date(endTime).toISOString(),
      duration_seconds: durationSeconds,
      active_time_seconds: activeSeconds,
      client_device: getClientDeviceInfo(),
    },
  });

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-event`;
  const headers = {
    "Content-Type": "application/json",
    "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  // Try sendBeacon first (works on page unload), fallback to fetch
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon) {
    // sendBeacon doesn't support custom headers, so use fetch if possible
    try {
      navigator.sendBeacon(url, blob);
    } catch {
      fetch(url, { method: "POST", headers, body, keepalive: true }).catch(() => {});
    }
  } else {
    fetch(url, { method: "POST", headers, body, keepalive: true }).catch(() => {});
  }

  sessionStartTime = null;
  sessionStorage.removeItem("tracking_start");
};

// ── Core event tracker ──
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
