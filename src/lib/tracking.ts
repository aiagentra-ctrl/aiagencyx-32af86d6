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

const recentEvents = new Map<string, number>();

// ── Activity tracking ──
const markActive = () => {
  const now = Date.now();
  if (!isActive && lastActiveTime) {
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
  if (duration < 2) return;
  trackEvent(slug, "section_engagement", {
    ...options,
    metadata: { section, duration_seconds: duration },
  });
};

// ── Scroll depth tracking ──
const scrollMilestones = new Set<number>();
let scrollTrackingSlug: string | null = null;
let scrollTrackingOptions: { demoPageId?: string; businessName?: string } = {};

const handleScrollDepth = () => {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (docHeight <= 0) return;
  const pct = Math.round((scrollTop / docHeight) * 100);

  for (const milestone of [25, 50, 75, 100]) {
    if (pct >= milestone && !scrollMilestones.has(milestone)) {
      scrollMilestones.add(milestone);
      if (scrollTrackingSlug) {
        trackEvent(scrollTrackingSlug, "scroll_depth", {
          ...scrollTrackingOptions,
          metadata: { depth_percent: milestone },
        });
      }
    }
  }
};

export const startScrollTracking = (slug: string, options?: { demoPageId?: string; businessName?: string }) => {
  scrollMilestones.clear();
  scrollTrackingSlug = slug;
  scrollTrackingOptions = options || {};
  window.addEventListener("scroll", handleScrollDepth, { passive: true });
};

export const stopScrollTracking = () => {
  window.removeEventListener("scroll", handleScrollDepth);
  scrollTrackingSlug = null;
};

// ── Click heatmap tracking ──
let clickTrackingSlug: string | null = null;
let clickTrackingOptions: { demoPageId?: string; businessName?: string } = {};

const handleClickTrack = (e: MouseEvent) => {
  if (!clickTrackingSlug) return;
  const target = e.target as HTMLElement;
  if (!target) return;

  // Identify what was clicked
  const button = target.closest("button");
  const link = target.closest("a");
  const section = target.closest("section, [id]");

  const clickData: Record<string, any> = {
    x_percent: Math.round((e.clientX / window.innerWidth) * 100),
    y_percent: Math.round((e.clientY / document.documentElement.scrollHeight) * 100),
    viewport_y: Math.round(((e.clientY + window.scrollY) / document.documentElement.scrollHeight) * 100),
  };

  if (button) {
    clickData.element = "button";
    clickData.text = button.textContent?.trim().substring(0, 50) || "";
    clickData.classes = button.className.substring(0, 100);
  } else if (link) {
    clickData.element = "link";
    clickData.text = link.textContent?.trim().substring(0, 50) || "";
    clickData.href = (link as HTMLAnchorElement).href?.substring(0, 200) || "";
  } else {
    clickData.element = target.tagName.toLowerCase();
    clickData.text = target.textContent?.trim().substring(0, 30) || "";
  }

  if (section) {
    clickData.section_id = (section as HTMLElement).id || "";
  }

  trackEvent(clickTrackingSlug, "click_heatmap", {
    ...clickTrackingOptions,
    metadata: clickData,
  });
};

export const startClickTracking = (slug: string, options?: { demoPageId?: string; businessName?: string }) => {
  clickTrackingSlug = slug;
  clickTrackingOptions = options || {};
  document.addEventListener("click", handleClickTrack, { passive: true });
};

export const stopClickTracking = () => {
  document.removeEventListener("click", handleClickTrack);
  clickTrackingSlug = null;
};

// ── Return visit detection ──
export const trackReturnVisit = (slug: string, options?: { demoPageId?: string; businessName?: string }) => {
  const key = `visit_history_${slug}`;
  const now = Date.now();
  const historyRaw = localStorage.getItem(key);
  let visits: number[] = [];

  try {
    visits = historyRaw ? JSON.parse(historyRaw) : [];
  } catch { visits = []; }

  const visitCount = visits.length + 1;
  const lastVisit = visits.length > 0 ? visits[visits.length - 1] : null;
  const timeSinceLastMs = lastVisit ? now - lastVisit : null;
  const isReturn = visits.length > 0;

  // Save this visit
  visits.push(now);
  if (visits.length > 20) visits = visits.slice(-20); // Keep last 20
  localStorage.setItem(key, JSON.stringify(visits));

  if (isReturn) {
    trackEvent(slug, "return_visit", {
      ...options,
      metadata: {
        visit_number: visitCount,
        time_since_last_seconds: timeSinceLastMs ? Math.round(timeSinceLastMs / 1000) : null,
        time_since_last_human: timeSinceLastMs ? formatTimeSince(timeSinceLastMs) : null,
        total_visits: visitCount,
        first_visit: new Date(visits[0]).toISOString(),
      },
    });
  }

  return { isReturn, visitCount, timeSinceLastMs };
};

function formatTimeSince(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

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
  if (durationSeconds < 1 || durationSeconds > 86400) return;

  stopActivityTracking();

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
      max_scroll_depth: Math.max(...scrollMilestones, 0),
      client_device: getClientDeviceInfo(),
    },
  });

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-event`;
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon) {
    try { navigator.sendBeacon(url, blob); } catch {
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body, keepalive: true }).catch(() => {});
    }
  } else {
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body, keepalive: true }).catch(() => {});
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
    const dedupeKey = `${slug}:${eventType}`;
    // Allow scroll_depth and click_heatmap through with less aggressive dedupe
    const dedupeMs = (eventType === "click_heatmap") ? 500 : (eventType === "scroll_depth") ? 0 : 3000;
    const lastFired = recentEvents.get(dedupeKey);
    if (lastFired && Date.now() - lastFired < dedupeMs) return;
    recentEvents.set(dedupeKey, Date.now());

    if (recentEvents.size > 100) {
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

    // Mirror to track-visitor for lead intelligence (additive, fire-and-forget)
    try {
      const utm: Record<string, string> = {};
      try {
        const p = new URLSearchParams(window.location.search);
        ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(k => {
          const v = p.get(k); if (v) utm[k] = v;
        });
      } catch { /* ignore */ }
      supabase.functions.invoke("track-visitor", {
        body: {
          slug,
          event_type: eventType,
          session_id: getSessionId(),
          metadata: { ...(options?.metadata || {}), utm },
        },
      }).catch(() => {});
    } catch { /* ignore */ }
  } catch {
    // Tracking should never break the user experience
  }
};
