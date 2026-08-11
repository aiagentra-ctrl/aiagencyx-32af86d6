// Shared geo-filtering for every tracking entry point.
//
// Rule (from the tracking brief):
//   - Self / owner traffic  -> Nepal, India, Bangladesh, Pakistan  (never counted)
//   - Real client traffic   -> US, CA, AU, GB, NZ + all of Europe  (counted)
//   - Anything else         -> DEFAULT TO TRACKED (never silently drop a lead)

export const SELF_TRAFFIC_COUNTRIES = ["NP", "IN", "BD", "PK"] as const;

export const EUROPE_COUNTRIES = [
  "AL","AD","AT","BY","BE","BA","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR",
  "HU","IS","IE","IT","XK","LV","LI","LT","LU","MT","MD","MC","ME","NL","MK","NO",
  "PL","PT","RO","RU","SM","RS","SK","SI","ES","SE","CH","UA","VA",
] as const;

export const TRACKED_COUNTRIES = ["US", "CA", "AU", "GB", "NZ", ...EUROPE_COUNTRIES] as const;

export function normalizeCountry(code?: string | null): string | null {
  const c = (code || "").trim().toUpperCase();
  return c ? c : null;
}

/** True when the open came from one of our own countries and must not be tracked. */
export function isSelfTrafficCountry(code?: string | null): boolean {
  const c = normalizeCountry(code);
  if (!c) return false; // unknown -> tracked
  return (SELF_TRAFFIC_COUNTRIES as readonly string[]).includes(c);
}

/** True when the open should be counted. Unknown / unlisted countries default to tracked. */
export function isTrackedCountry(code?: string | null): boolean {
  return !isSelfTrafficCountry(code);
}

export function extractIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function isLookupableIp(ip?: string | null): boolean {
  return !!ip && ip !== "unknown" && ip !== "127.0.0.1" && ip !== "::1";
}

/** ip-api.com lookup with a short timeout. Returns nulls on any failure. */
export async function lookupGeo(
  ip: string,
  timeoutMs = 3000,
): Promise<{ countryCode: string | null; city: string | null }> {
  if (!isLookupableIp(ip)) return { countryCode: null, city: null };
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,city,status`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return { countryCode: null, city: null };
    const j = await r.json();
    if (j?.status !== "success") return { countryCode: null, city: null };
    return { countryCode: normalizeCountry(j.countryCode), city: j.city || null };
  } catch {
    return { countryCode: null, city: null };
  }
}

export type GeoDecision = {
  countryCode: string | null;
  city: string | null;
  isSelfTraffic: boolean;
};

/** One-call helper: resolve the country and decide whether this open counts. */
export async function resolveGeo(ip: string, timeoutMs = 3000): Promise<GeoDecision> {
  const { countryCode, city } = await lookupGeo(ip, timeoutMs);
  return { countryCode, city, isSelfTraffic: isSelfTrafficCountry(countryCode) };
}

// ---------------------------------------------------------------------------
// Owner / self-traffic resolution
// ---------------------------------------------------------------------------

export type OwnerConfig = {
  ips: string[];
  countries: string[];
  emails: string[];
  deviceToken: string | null;
};

const OWNER_KEYS = ["owner_ips", "owner_countries", "owner_emails", "owner_device_token", "blocked_ips"];

function splitList(v?: string | null): string[] {
  return (v || "").split(",").map((x) => x.trim()).filter(Boolean);
}

/** Reads the owner/test-traffic settings saved from the admin panel. */
export async function loadOwnerConfig(supabase: any): Promise<OwnerConfig> {
  const { data } = await supabase.from("site_settings").select("key,value").in("key", OWNER_KEYS);
  const map: Record<string, string> = {};
  for (const r of data || []) map[r.key] = r.value || "";
  return {
    ips: [...splitList(map.owner_ips), ...splitList(map.blocked_ips)],
    countries: splitList(map.owner_countries).map((c) => c.toUpperCase()),
    emails: splitList(map.owner_emails).map((e) => e.toLowerCase()),
    deviceToken: map.owner_device_token ? map.owner_device_token.trim() : null,
  };
}

export type SelfTrafficInput = {
  cfg: OwnerConfig;
  ip?: string | null;
  countryCode?: string | null;
  /** Token stored on the owner's browser via "Mark this device as mine". */
  ownerToken?: string | null;
  /** Set when the visit came from an authenticated admin session. */
  isAdminSession?: boolean;
  email?: string | null;
  /** Country we already recorded for this lead, used as a fallback signal. */
  knownCountry?: string | null;
};

export type SelfTrafficDecision = { isSelf: boolean; reason: string | null };

/**
 * Layered owner detection, strongest signal first. An UNKNOWN device or
 * location is never treated as self traffic — it stays a potential client so
 * normal follow-up keeps running.
 */
export function resolveSelfTraffic(input: SelfTrafficInput): SelfTrafficDecision {
  const { cfg, ip, countryCode, ownerToken, isAdminSession, email, knownCountry } = input;

  if (cfg.deviceToken && ownerToken && ownerToken === cfg.deviceToken) {
    return { isSelf: true, reason: "owner_device" };
  }
  if (isAdminSession) return { isSelf: true, reason: "admin_session" };
  if (ip && cfg.ips.includes(ip)) return { isSelf: true, reason: "owner_ip" };

  const c = normalizeCountry(countryCode);
  if (c) {
    if (cfg.countries.includes(c)) return { isSelf: true, reason: "owner_country" };
    if (isSelfTrafficCountry(c)) return { isSelf: true, reason: "self_traffic_country" };
    return { isSelf: false, reason: null };
  }

  // Country unknown: fall back to the country we already know for this lead.
  const known = normalizeCountry(knownCountry);
  if (known && (cfg.countries.includes(known) || isSelfTrafficCountry(known))) {
    return { isSelf: true, reason: "known_owner_country" };
  }
  if (email && cfg.emails.includes(email.toLowerCase())) {
    return { isSelf: true, reason: "owner_email" };
  }
  // Unknown device / location -> treat as a real client.
  return { isSelf: false, reason: null };
}


// Engagement duration tiers (voice + chat)
// ---------------------------------------------------------------------------

export type EngagementTier = "not_tried" | "tried" | "warm";

/** <1s = not_tried | 1-9.99s = tried | 10s+ = warm */
export function engagementTier(seconds: number | null | undefined): EngagementTier {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 1) return "not_tried";
  if (s < 10) return "tried";
  return "warm";
}

export const TIER_LABELS: Record<EngagementTier, string> = {
  not_tried: "Not tried",
  tried: "Tried",
  warm: "Warm lead",
};
