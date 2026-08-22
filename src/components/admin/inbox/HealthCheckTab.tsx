// System health check — grouped sections matching run-health-check output.
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminFetchSafe } from "@/lib/adminData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plug, GitBranch, Brain, Database, ShieldCheck,
  Play, Loader2, Check, X, AlertTriangle, ChevronDown, RotateCw, Wrench,
} from "lucide-react";
import { toast } from "sonner";

type StepStatus = "idle" | "running" | "pass" | "warn" | "fail";
type StepResult = {
  step: string; label: string; group: string;
  status: "pass" | "warn" | "fail";
  duration_ms: number; response_detail: any; error_message: string | null;
};

type Group = "integrations" | "pipeline" | "memory" | "data";

const GROUPS: { key: Group; title: string; desc: string; Icon: any }[] = [
  { key: "integrations", title: "Integrations & APIs", desc: "External services, keys, limits and dependencies.", Icon: Plug },
  { key: "pipeline", title: "Pipeline flow", desc: "Webhook → storage → classification → reply → demo.", Icon: GitBranch },
  { key: "memory", title: "Memory & history", desc: "Is lead memory and thread history actually feeding the AI?", Icon: Brain },
  { key: "data", title: "Data sync", desc: "Dashboard reads, table volumes and failed demo jobs.", Icon: Database },
];

// Mirrors the server STEPS map (step key → label + group).
const STEPS: { key: string; label: string; group: Group; desc: string }[] = [
  { key: "firecrawl", label: "Firecrawl (mandatory for demos)", group: "integrations", desc: "Scraping API — demos are blocked when this is down." },
  { key: "openrouter", label: "OpenRouter / LLM", group: "integrations", desc: "Key validity plus remaining credit." },
  { key: "lovable_ai", label: "Lovable AI Gateway", group: "integrations", desc: "Fallback AI gateway ping." },
  { key: "vapi", label: "VAPI voice agents", group: "integrations", desc: "Voice assistant API reachability." },
  { key: "manyreach", label: "ManyReach outbound", group: "integrations", desc: "Sending API key check (nothing is sent)." },
  { key: "secrets", label: "Required secrets", group: "integrations", desc: "All required environment secrets present." },
  { key: "webhook", label: "Inbound webhook", group: "pipeline", desc: "Posts a mock ManyReach payload to the live webhook." },
  { key: "db_write", label: "Message storage", group: "pipeline", desc: "Confirms the payload landed in prospects + messages." },
  { key: "classify", label: "AI classification", group: "pipeline", desc: "Expects Positive / Negative / Objection." },
  { key: "generate_reply", label: "Reply generation", group: "pipeline", desc: "Runs the positive reply handler." },
  { key: "create_demo", label: "Demo generation (opt-in)", group: "pipeline", desc: "Really builds a demo — run manually." },
  { key: "memory", label: "Lead memory read/write", group: "memory", desc: "Memory rows plus recent memory_read events." },
  { key: "history", label: "Thread history completeness", group: "memory", desc: "Stored messages and unclassified replies." },
  { key: "data_sync", label: "Inbox / Conversations data sync", group: "data", desc: "Row counts behind the dashboard views." },
  { key: "admin_data", label: "Admin data API (dashboard reads)", group: "data", desc: "Service-role read layer used by the panel." },
  { key: "demo_jobs", label: "Demo job failures", group: "data", desc: "Failed or partial demo builds awaiting retry." },
];

// create_demo is opt-in, matching the server ORDER.
const RUN_ALL_KEYS = STEPS.map((s) => s.key).filter((k) => k !== "create_demo");

type CardState = { status: StepStatus; duration_ms?: number; detail?: any; error?: string | null; tested_at?: string };

const DOT: Record<StepStatus, string> = {
  idle: "bg-muted-foreground/30",
  running: "bg-blue-500 animate-pulse",
  pass: "bg-emerald-500",
  warn: "bg-amber-500",
  fail: "bg-red-500",
};

function relTime(iso?: string) {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleString();
}

type Job = { id: string; business_name: string | null; status: string; last_error: string | null; created_at: string };

export default function HealthCheckTab() {
  const [states, setStates] = useState<Record<string, CardState>>(
    () => STEPS.reduce((a, s) => ({ ...a, [s.key]: { status: "idle" as StepStatus } }), {}),
  );
  const [runningAll, setRunningAll] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [lastFullRunAt, setLastFullRunAt] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadHistory = async () => {
    const { data } = await supabase
      .from("system_health_checks").select("*")
      .order("tested_at", { ascending: false }).limit(30);
    setHistory(data || []);
  };

  const loadJobs = async () => {
    const d = await adminFetchSafe<{ jobs: Job[] }>("demo_jobs", { jobs: [] }, { status: ["failed", "partial"], limit: 25 });
    setJobs(d.jobs || []);
  };

  useEffect(() => {
    loadHistory();
    loadJobs();
    const ch = supabase.channel("hc")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_health_checks" }, () => loadHistory())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const runStep = async (key: string): Promise<StepResult | null> => {
    setStates((s) => ({ ...s, [key]: { ...s[key], status: "running" } }));
    const t0 = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke("run-health-check", { body: { step: key } });
      if (error) throw error;
      const r: StepResult = data?.results?.[0];
      if (!r) throw new Error("no result returned");
      setStates((s) => ({
        ...s,
        [key]: {
          status: r.status, duration_ms: r.duration_ms, detail: r.response_detail,
          error: r.error_message, tested_at: new Date().toISOString(),
        },
      }));
      if (key === "demo_jobs") loadJobs();
      return r;
    } catch (e: any) {
      setStates((s) => ({
        ...s,
        [key]: { status: "fail", duration_ms: Date.now() - t0, error: String(e?.message || e), tested_at: new Date().toISOString() },
      }));
      return null;
    }
  };

  const runAll = async () => {
    if (runningAll) return;
    setRunningAll(true);
    setStates((s) => STEPS.reduce((a, st) => ({ ...a, [st.key]: { status: "idle" as StepStatus } }), { ...s }));
    let pass = 0, warn = 0; const failed: string[] = [];
    for (const key of RUN_ALL_KEYS) {
      const r = await runStep(key);
      if (r?.status === "pass") pass++;
      else if (r?.status === "warn") warn++;
      else failed.push(STEPS.find((s) => s.key === key)?.label || key);
    }
    setLastFullRunAt(new Date().toISOString());
    setRunningAll(false);
    await loadJobs();
    if (failed.length === 0) toast.success(`${pass}/${RUN_ALL_KEYS.length} passed${warn ? `, ${warn} degraded` : ""} ✅`);
    else toast.error(`${failed.length} failed — ${failed.join(", ")}`);
  };

  const retryJob = async (id: string) => {
    setRetrying(id);
    try {
      const { data, error } = await supabase.functions.invoke("retry-demo-job", { body: { job_id: id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Retried ${(data as any)?.retried_steps?.length ?? 0} unfinished step(s)`);
      await loadJobs();
    } catch (e: any) {
      toast.error(`Retry failed: ${e?.message || e}`);
    }
    setRetrying(null);
  };

  const summary = useMemo(() => {
    const tested = STEPS.filter((s) => states[s.key]?.status && states[s.key].status !== "idle" && states[s.key].status !== "running");
    if (tested.length === 0) return null;
    return {
      tested: tested.length,
      pass: tested.filter((s) => states[s.key].status === "pass").length,
      warn: tested.filter((s) => states[s.key].status === "warn").length,
      failed: tested.filter((s) => states[s.key].status === "fail"),
    };
  }, [states]);

  const groupStatus = (g: Group): StepStatus => {
    const inGroup = STEPS.filter((s) => s.group === g).map((s) => states[s.key]?.status || "idle");
    if (inGroup.includes("fail")) return "fail";
    if (inGroup.includes("running")) return "running";
    if (inGroup.includes("warn")) return "warn";
    if (inGroup.some((s) => s === "pass")) return "pass";
    return "idle";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              System Health Check
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Integrations, pipeline flow, lead memory and data sync. Test data is marked and hidden from your real inbox.
            </div>
            {lastFullRunAt && (
              <div className="text-[10px] text-muted-foreground mt-1">Last full run: {relTime(lastFullRunAt)}</div>
            )}
          </div>
          <Button onClick={runAll} disabled={runningAll}>
            {runningAll
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running…</>
              : <><Play className="mr-2 h-4 w-4" /> Run All Checks</>}
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
      {summary && (
        <Card className={summary.failed.length === 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5"}>
          <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="font-medium">
              {summary.pass} passed
              {summary.warn > 0 && <> · {summary.warn} degraded</>}
              {summary.failed.length > 0 && <> · {summary.failed.length} failed</>}
            </div>
            {summary.failed.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {summary.failed.map((s) => (
                  <button
                    key={s.key}
                    className="text-[11px] underline text-red-600"
                    onClick={() => cardRefs.current[s.key]?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  >{s.label}</button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grouped sections */}
      {GROUPS.map(({ key: g, title, desc, Icon }) => (
        <div key={g} className="space-y-2">
          <div className="flex items-center gap-2 pt-2">
            <span className={`h-2 w-2 rounded-full ${DOT[groupStatus(g)]}`} />
            <Icon className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <div className="text-[11px] text-muted-foreground">{desc}</div>
            </div>
          </div>

          <div className="grid gap-2">
            {STEPS.filter((s) => s.group === g).map((step) => {
              const st = states[step.key] || { status: "idle" as StepStatus };
              return (
                <Card key={step.key} ref={(el) => (cardRefs.current[step.key] = el)}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                          <span className={`h-2 w-2 rounded-full ${DOT[st.status]}`} />
                          {step.label}
                          {st.duration_ms != null && <Badge variant="outline" className="h-4 text-[10px]">{st.duration_ms}ms</Badge>}
                          {st.status === "pass" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                          {st.status === "warn" && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                          {st.status === "fail" && <X className="h-3.5 w-3.5 text-red-500" />}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{step.desc}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {st.status === "idle" ? "Not tested yet" : `Tested ${relTime(st.tested_at)}`}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => runStep(step.key)} disabled={st.status === "running" || runningAll}>
                        {st.status === "running"
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <RotateCw className="h-3.5 w-3.5" />}
                        <span className="ml-1.5">Run</span>
                      </Button>
                    </div>

                    {st.error && (
                      <div className={`rounded-md border text-xs p-2 ${
                        st.status === "warn"
                          ? "border-amber-500/30 bg-amber-500/5 text-amber-700"
                          : "border-red-500/30 bg-red-500/5 text-red-600"
                      }`}>
                        {st.error}
                      </div>
                    )}

                    {st.detail != null && (
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                          <ChevronDown className="h-3 w-3" /> Raw response
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <pre className="text-[10px] bg-muted/50 rounded p-2 mt-1 overflow-auto max-h-48">
{JSON.stringify(st.detail, null, 2)}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Failed demo jobs */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                Failed demo jobs
              </div>
              <div className="text-xs text-muted-foreground">Retry re-runs only the unfinished steps.</div>
            </div>
            <Button size="sm" variant="ghost" onClick={loadJobs}><RotateCw className="h-3.5 w-3.5" /></Button>
          </div>
          {jobs.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-6">No failed or partial jobs 🎉</div>
          ) : (
            <ul className="divide-y">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {j.business_name || "Untitled"}{" "}
                      <Badge variant="outline" className="h-4 text-[10px] ml-1">{j.status}</Badge>
                    </div>
                    {j.last_error && <div className="text-[11px] text-red-600 truncate max-w-xl">{j.last_error}</div>}
                    <div className="text-[10px] text-muted-foreground">{relTime(j.created_at)}</div>
                  </div>
                  <Button size="sm" variant="outline" disabled={retrying === j.id} onClick={() => retryJob(j.id)}>
                    {retrying === j.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RotateCw className="h-3.5 w-3.5" />}
                    <span className="ml-1.5">Retry</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="font-semibold text-sm">Recent runs</div>
          <div className="text-xs text-muted-foreground">Last 30 health-check results, newest first.</div>
          <ScrollArea className="h-64 mt-2">
            {history.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-6">No runs yet.</div>
            ) : (
              <ul className="text-xs divide-y">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        h.status === "pass" ? "bg-emerald-500" : h.status === "warn" ? "bg-amber-500" : "bg-red-500"
                      }`} />
                      <span className="font-mono">{h.step_name}</span>
                      {h.duration_ms != null && <span className="text-muted-foreground">· {h.duration_ms}ms</span>}
                      {h.error_message && <span className="text-red-600 truncate">· {h.error_message}</span>}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{relTime(h.tested_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
