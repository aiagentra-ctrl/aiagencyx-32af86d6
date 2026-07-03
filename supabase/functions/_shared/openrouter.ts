// Shared OpenRouter client for e-commerce AI stack.
// Chat + embeddings with automatic fallback to openai/gpt-4o-mini.
// All e-commerce edge functions should use this helper.

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const SITE_URL = Deno.env.get("SITE_URL") || "https://aiagentra.lovable.app";

export const MODELS = {
  ecommerce_chat: "anthropic/claude-3.5-haiku",
  extraction: "google/gemini-2.0-flash-001",
  kb_build: "anthropic/claude-3.5-haiku",
  voice: "anthropic/claude-3.5-haiku",
  fallback: "openai/gpt-4o-mini",
  embedding: "openai/text-embedding-3-small",
} as const;

const ROUTER_URL = "https://openrouter.ai/api/v1";

function headers(extra: Record<string, string> = {}): HeadersInit {
  return {
    Authorization: `Bearer ${OPENROUTER_API_KEY ?? ""}`,
    "Content-Type": "application/json",
    "HTTP-Referer": SITE_URL,
    "X-Title": "AI Agency Dashboard",
    ...extra,
  };
}

export interface ChatOpts {
  temperature?: number;
  max_tokens?: number;
  response_format?: any;
  stream?: boolean;
  fallback?: string;
  timeoutMs?: number;
  extraBody?: Record<string, any>;
}

async function timedFetch(url: string, init: RequestInit, timeoutMs = 30000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Chat completion via OpenRouter. Non-streaming by default.
 * On failure, retries once with the fallback model (openai/gpt-4o-mini).
 */
export async function chatCompletion(
  model: string,
  messages: any[],
  opts: ChatOpts = {}
): Promise<{ content: string; raw: any; usedModel: string } | null> {
  if (!OPENROUTER_API_KEY) return null;
  const fallback = opts.fallback ?? MODELS.fallback;
  const attempts = [model, fallback].filter((m, i, a) => a.indexOf(m) === i);
  for (const m of attempts) {
    try {
      const body: any = {
        model: m,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.max_tokens ?? 1024,
      };
      if (opts.response_format) body.response_format = opts.response_format;
      if (opts.stream) body.stream = true;
      if (opts.extraBody) Object.assign(body, opts.extraBody);
      const res = await timedFetch(`${ROUTER_URL}/chat/completions`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      }, opts.timeoutMs ?? 30000);
      if (!res.ok) {
        console.warn(`[openrouter] ${m} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      return { content, raw: data, usedModel: m };
    } catch (e) {
      console.warn(`[openrouter] ${m} threw`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}

/**
 * Streaming chat completion — returns raw Response so the caller can pipe.
 * Fallback retries with the fallback model if the first request fails before streaming begins.
 */
export async function chatCompletionStream(
  model: string,
  messages: any[],
  opts: ChatOpts = {}
): Promise<{ response: Response; usedModel: string } | null> {
  if (!OPENROUTER_API_KEY) return null;
  const fallback = opts.fallback ?? MODELS.fallback;
  const attempts = [model, fallback].filter((m, i, a) => a.indexOf(m) === i);
  for (const m of attempts) {
    try {
      const body: any = {
        model: m,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.max_tokens ?? 1024,
        stream: true,
      };
      if (opts.extraBody) Object.assign(body, opts.extraBody);
      const res = await timedFetch(`${ROUTER_URL}/chat/completions`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      }, opts.timeoutMs ?? 60000);
      if (!res.ok) {
        console.warn(`[openrouter-stream] ${m} → HTTP ${res.status}`);
        continue;
      }
      return { response: res, usedModel: m };
    } catch (e) {
      console.warn(`[openrouter-stream] ${m} threw`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}

/** Create embedding — returns a number[] or null. Text is capped at 8000 chars. */
export async function createEmbedding(text: string): Promise<number[] | null> {
  if (!OPENROUTER_API_KEY) return null;
  try {
    const res = await timedFetch(`${ROUTER_URL}/embeddings`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model: MODELS.embedding, input: text.slice(0, 8000) }),
    }, 15000);
    if (!res.ok) {
      console.warn(`[openrouter-emb] HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data?.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.warn("[openrouter-emb] threw", e instanceof Error ? e.message : e);
    return null;
  }
}