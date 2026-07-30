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
