// Shared Firecrawl client (direct API mode — FIRECRAWL_API_KEY is a real `fc-` key).
// Firecrawl is a HARD dependency for demo generation: if it is not healthy we do
// not build a demo, we record a failed job instead.

const FIRECRAWL_V1 = "https://api.firecrawl.dev/v1";
const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

export type FirecrawlHealth = {
  ok: boolean;
  configured: boolean;
  status: number | null;
  credits_exhausted: boolean;
  rate_limited: boolean;
  latency_ms: number;
  error: string | null;
  detail?: unknown;
};

export function firecrawlKey(): string | null {
  return Deno.env.get("FIRECRAWL_API_KEY") || null;
}

async function withTimeout(url: string, init: RequestInit, ms: number) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Live check: a tiny real scrape against a stable URL. */
export async function checkFirecrawl(timeoutMs = 20000): Promise<FirecrawlHealth> {
  const key = firecrawlKey();
  const t0 = Date.now();
  if (!key) {
    return {
      ok: false, configured: false, status: null, credits_exhausted: false,
      rate_limited: false, latency_ms: 0,
      error: "FIRECRAWL_API_KEY is not configured — connect Firecrawl in Connectors",
    };
  }
  try {
    const res = await withTimeout(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", formats: ["markdown"], onlyMainContent: true }),
    }, timeoutMs);
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { /* keep text */ }
    const latency = Date.now() - t0;
    if (res.status === 402) {
      return { ok: false, configured: true, status: 402, credits_exhausted: true, rate_limited: false, latency_ms: latency, error: "Firecrawl credits exhausted", detail: body ?? text.slice(0, 300) };
    }
    if (res.status === 429) {
      return { ok: false, configured: true, status: 429, credits_exhausted: false, rate_limited: true, latency_ms: latency, error: "Firecrawl rate limit reached", detail: body ?? text.slice(0, 300) };
    }
    if (!res.ok) {
      return { ok: false, configured: true, status: res.status, credits_exhausted: false, rate_limited: false, latency_ms: latency, error: `Firecrawl HTTP ${res.status}`, detail: body ?? text.slice(0, 300) };
    }
    const md = body?.data?.markdown ?? body?.markdown ?? "";
    return {
      ok: !!md, configured: true, status: res.status, credits_exhausted: false, rate_limited: false,
      latency_ms: latency,
      error: md ? null : "Firecrawl responded but returned no content",
      detail: { chars: String(md).length },
    };
  } catch (e) {
    const msg = String((e as any)?.message || e);
    return {
      ok: false, configured: true, status: null, credits_exhausted: false,
      rate_limited: false, latency_ms: Date.now() - t0,
      error: msg.includes("abort") ? "Firecrawl timeout" : msg,
    };
  }
}

/** Scrape a single page. Throws with the provider status + body on failure. */
export async function firecrawlScrape(
  url: string,
  opts: { formats?: string[]; onlyMainContent?: boolean; timeoutMs?: number } = {},
) {
  const key = firecrawlKey();
  if (!key) throw new Error("FIRECRAWL_API_KEY is not configured");
  const res = await withTimeout(`${FIRECRAWL_V1}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: opts.formats ?? ["markdown"],
      onlyMainContent: opts.onlyMainContent ?? true,
    }),
  }, opts.timeoutMs ?? 25000);
  const text = await res.text();
  if (!res.ok) throw new Error(`Firecrawl scrape [${res.status}]: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  return {
    markdown: data?.data?.markdown ?? data?.markdown ?? "",
    logo: data?.data?.branding?.logo ?? data?.branding?.logo ?? data?.data?.branding?.images?.logo ?? undefined,
    raw: data,
  };
}
