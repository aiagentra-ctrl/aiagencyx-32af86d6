/**
 * Vapi native knowledge files.
 *
 * Instead of stuffing the whole menu / KB into the system prompt (slow, token
 * heavy, truncated), we upload it to Vapi as a real file and attach it to the
 * assistant with the built-in canonical knowledge base. Vapi then does the
 * retrieval itself — no tool round-trip to our edge functions.
 *
 * Verified against the live Vapi API: POST /file (multipart, explicit
 * text/markdown mime type) then `model.knowledgeBase = { provider: "canonical",
 * fileIds: [...] }` on the assistant.
 */

export type VapiFile = { id: string; name: string; status?: string };

export async function uploadVapiTextFile(opts: {
  apiKey: string;
  name: string;
  content: string;
}): Promise<VapiFile | null> {
  const text = (opts.content || "").trim();
  if (!text) return null;
  const safeName = `${opts.name.replace(/[^\w.-]+/g, "-").slice(0, 60)}.md`;
  try {
    const form = new FormData();
    // The explicit mime type matters — Vapi rejects application/octet-stream.
    form.append("file", new File([text], safeName, { type: "text/markdown" }));
    const res = await fetch("https://api.vapi.ai/file", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      body: form,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.id) {
      console.error("[vapi-file] upload failed", res.status, JSON.stringify(body).slice(0, 400));
      return null;
    }
    return { id: body.id, name: body.name, status: body.status };
  } catch (e) {
    console.error("[vapi-file] upload error", e);
    return null;
  }
}

export function canonicalKnowledgeBase(fileIds: string[]) {
  return fileIds.length > 0 ? { provider: "canonical", fileIds } : undefined;
}

/**
 * Create a native Vapi "query" tool bound to uploaded knowledge files.
 * This is the supported retrieval path (provider `google`); the older
 * `canonical` file indexing leaves files stuck in `status: failed`.
 */
export async function createKnowledgeQueryTool(opts: {
  apiKey: string;
  fileIds: string[];
  businessName: string;
  description?: string;
}): Promise<string | null> {
  if (!opts.fileIds.length) return null;
  try {
    const res = await fetch("https://api.vapi.ai/tool", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "query",
        function: { name: "knowledge_query" },
        knowledgeBases: [{
          provider: "google",
          name: opts.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "business-kb",
          description: opts.description
            || "Complete business knowledge: services, pricing, hours, policies, FAQs, menu, products, listings and website content.",
          fileIds: opts.fileIds,
        }],
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.id) {
      console.error("[vapi-file] query tool failed", res.status, JSON.stringify(body).slice(0, 400));
      return null;
    }
    return body.id as string;
  } catch (e) {
    console.error("[vapi-file] query tool error", e);
    return null;
  }
}

export async function deleteVapiTool(apiKey: string, toolId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.vapi.ai/tool/${toolId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteVapiFile(apiKey: string, fileId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.vapi.ai/file/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
