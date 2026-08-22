// Resumable job/step tracking for demo generation.
// Every step writes its result before the next starts, so a failure never
// loses finished work and a retry can re-run only what is missing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export const DEMO_STEPS = [
  "firecrawl_check",
  "firecrawl_scrape",
  "analyze",
  "industry_match",

  "build_prompt",
  "create_voice_agent",
  "create_demo_page",
  "create_chatbot",
  "store_lead",
] as const;

export type DemoStep = (typeof DEMO_STEPS)[number];

export async function startDemoJob(args: {
  job_id?: string | null;
  email?: string | null;
  prospect_id?: string | null;
  business_name: string;
  website_url: string;
}): Promise<string | null> {
  try {
    if (args.job_id) {
      const { data } = await sb.from("demo_jobs")
        .update({ status: "running", last_error: null })
        .eq("id", args.job_id).select("id, attempt").maybeSingle();
      if (data) {
        await sb.from("demo_jobs").update({ attempt: (data as any).attempt + 1 }).eq("id", args.job_id);
        return args.job_id;
      }
    }
    const { data } = await sb.from("demo_jobs").insert({
      prospect_id: args.prospect_id ?? null,
      email: args.email ?? null,
      business_name: args.business_name,
      website_url: args.website_url,
      status: "running",
    }).select("id").single();
    const jobId = (data as any)?.id ?? null;
    if (jobId) {
      await sb.from("demo_job_steps").insert(
        DEMO_STEPS.map((step, i) => ({ job_id: jobId, step, step_order: i, status: "pending" })),
      );
    }
    return jobId;
  } catch (e) {
    console.error("startDemoJob failed:", e);
    return null;
  }
}

/** Has this step already completed on a previous attempt? */
export async function stepDone(jobId: string | null, step: DemoStep): Promise<any | null> {
  if (!jobId) return null;
  const { data } = await sb.from("demo_job_steps")
    .select("status, output").eq("job_id", jobId).eq("step", step).maybeSingle();
  return (data as any)?.status === "completed" ? ((data as any).output ?? {}) : null;
}

export async function recordStep(
  jobId: string | null,
  step: DemoStep,
  status: "running" | "completed" | "failed" | "skipped",
  extra: { output?: unknown; error?: string | null; duration_ms?: number } = {},
) {
  if (!jobId) return;
  try {
    await sb.from("demo_job_steps").upsert({
      job_id: jobId,
      step,
      step_order: DEMO_STEPS.indexOf(step),
      status,
      output: (extra.output ?? null) as any,
      error: extra.error ?? null,
      duration_ms: extra.duration_ms ?? null,
      attempt: 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: "job_id,step" });
  } catch (e) {
    console.error("recordStep failed:", e);
  }
}

/** Run a step with timing + persistence, reusing prior output when complete. */
export async function runStep<T>(
  jobId: string | null,
  step: DemoStep,
  fn: () => Promise<T>,
  opts: { reuse?: boolean; serialize?: (v: T) => unknown } = {},
): Promise<T> {
  const t0 = Date.now();
  await recordStep(jobId, step, "running");
  try {
    const out = await fn();
    await recordStep(jobId, step, "completed", {
      output: opts.serialize ? opts.serialize(out) : undefined,
      duration_ms: Date.now() - t0,
    });
    return out;
  } catch (e) {
    const msg = String((e as any)?.message || e);
    await recordStep(jobId, step, "failed", { error: msg, duration_ms: Date.now() - t0 });
    throw e;
  }
}

export async function finishJob(
  jobId: string | null,
  status: "completed" | "failed" | "partial",
  patch: { last_error?: string | null; result?: unknown } = {},
) {
  if (!jobId) return;
  try {
    await sb.from("demo_jobs").update({
      status,
      last_error: patch.last_error ?? null,
      result: (patch.result ?? {}) as any,
    }).eq("id", jobId);
  } catch (e) {
    console.error("finishJob failed:", e);
  }
}
