// System health check page — n8n-style "is everything wired right?" view.
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Webhook, Database, Sparkles, Globe, MessageSquare, Send, ShieldCheck,
  Play, Loader2, Check, X, Circle, ChevronDown, RotateCw,
} from "lucide-react";
import { toast } from "sonner";

type StepKey = "webhook" | "db_write" | "classify" | "create_demo" | "generate_reply" | "manyreach" | "secrets";
type StepStatus = "idle" | "running" | "pass" | "fail";
type StepResult = { step: string; status: "pass" | "fail"; duration_ms: number; response_detail: any; error_message: string | null };

const STEPS: { key: StepKey; title: string; desc: string; Icon: any }[] = [
  { key: "webhook",        title: "1. Webhook Endpoint",       desc: "Posts a mock ManyReach payload to the live webhook URL (with secret).", Icon: Webhook },
  { key: "db_write",       title: "2. Database Write",         desc: "Confirms the mock payload was inserted into prospects + messages.", Icon: Database },
  { key: "classify",       title: "3. AI Classification",      desc: "Runs the classifier on a sample message — expects Positive / Negative / Objection.", Icon: Sparkles },
  { key: "create_demo",    title: "4. Demo Creation API",      desc: "Calls /create-demo and confirms a valid demo_url is returned.", Icon: Globe },
  { key: "generate_reply", title: "5. AI Reply Generation",    desc: "Runs the positive reply handler with a fake demo_url.", Icon: MessageSquare },
  { key: "manyreach",      title: "6. ManyReach Connectivity", desc: "Checks the ManyReach API key is valid (no real message sent).", Icon: Send },
  { key: "secrets",        title: "7. Environment Secrets",    desc: "Confirms required secrets are present on the server.", Icon: ShieldCheck },
];

type CardState = {
  status: StepStatus;
  duration_ms?: number;
  detail?: any;
  error?: string | null;
  tested_at?: string;
};

const STATUS_COLOR: Record<StepStatus, string> = {
  idle: "bg-muted-foreground/30",
  running: "bg-blue-500 animate-pulse",
  pass: "bg-emerald-500",
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

export default function HealthCheckTab() {
  const [states, setStates] = useState<Record<StepKey, CardState>>(
    () => STEPS.reduce((acc, s) => ({ ...acc, [s.key]: { status: "idle" } }), {} as Record<StepKey, CardState>),
  );
  const [runningAll, setRunningAll] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [lastFullRunAt, setLastFullRunAt] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadHistory = async () => {
    const { data } = await supabase
      .from("system_health_checks")
      .select("*").order("tested_at", { ascending: false }).limit(30);
    setHistory(data || []);
  };

  useEffect(() => {
    loadHistory();
    const ch = supabase.channel("hc")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_health_checks" }, () => loadHistory())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const runStep = async (key: StepKey): Promise<StepResult | null> => {
    setStates((s) => ({ ...s, [key]: { ...s[key], status: "running" } }));
    const t0 = Date.now();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; }, 12000);
    try {
      const { data, error } = await supabase.functions.invoke("run-health-check", { body: { step: key } });
      clearTimeout(timer);
      if (error) throw error;
      const r: StepResult = data?.results?.[0];
      if (!r) throw new Error("no result returned");
      setStates((s) => ({
        ...s,
        [key]: {
          status: r.status,
          duration_ms: r.duration_ms,
          detail: r.response_detail,
          error: r.error_message,
          tested_at: new Date().toISOString(),
        },
      }));
      return r;
    } catch (e: any) {
      clearTimeout(timer);
      const err = timedOut ? "timed out after 12s" : String(e?.message || e);
      setStates((s) => ({
        ...s,
        [key]: { status: "fail", duration_ms: Date.now() - t0, error: err, tested_at: new Date().toISOString() },
      }));
      return null;
    }
  };

  const runAll = async () => {
    if (runningAll) return;
    setRunningAll(true);
    // reset to idle so progression is visible
    setStates((s) => STEPS.reduce((acc, st) => ({ ...acc, [st.key]: { status: "idle" as StepStatus } }), { ...s }));
    let pass = 0; let fail = 0; const failedSteps: string[] = [];
    for (const s of STEPS) {
      const r = await runStep(s.key);
      if (r?.status === "pass") pass++;
      else { fail++; failedSteps.push(s.title); }
    }
    setLastFullRunAt(new Date().toISOString());
    setRunningAll(false);
    if (fail === 0) toast.success(`All ${pass}/${STEPS.length} checks passed ✅`);
    else toast.error(`${pass}/${STEPS.length} passed — failed: ${failedSteps.join(", ")}`);
  };

  const summary = useMemo(() => {
    const tested = STEPS.filter((s) => states[s.key].status !== "idle");
    if (tested.length === 0) return null;
    const pass = tested.filter((s) => states[s.key].status === "pass").length;
    return { tested: tested.length, pass, total: STEPS.length, failed: tested.filter((s) => states[s.key].status === "fail") };
  }, [states]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Pipeline Health Check
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Walks every step of the reply-automation pipeline end-to-end. Test data is marked and hidden from your real inbox.
            </div>
            {lastFullRunAt && (
              <div className="text-[10px] text-muted-foreground mt-1">Last full run: {relTime(lastFullRunAt)}</div>
            )}
          </div>
          <Button onClick={runAll} disabled={runningAll}>
            {runningAll
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Tests running…</>
              : <><Play className="mr-2 h-4 w-4" /> Run All Tests</>}
          </Button>
        </CardContent>
      </Card>

      {/* Summary banner */}
      {summary && (
        <Card className={summary.failed.length === 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}>
          <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="font-medium">
              {summary.pass}/{summary.total} passed
              {summary.failed.length > 0 && <> · {summary.failed.length} failed</>}
            </div>
            {summary.failed.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {summary.failed.map((s) => (
                  <button
                    key={s.key}
                    className="text-[11px] underline text-red-600"
                    onClick={() => cardRefs.current[s.key]?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  >{s.title}</button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step cards */}
      <div className="grid gap-3">
        {STEPS.map(({ key, title, desc, Icon }) => {
          const st = states[key];
          return (
            <Card key={key} ref={(el) => (cardRefs.current[key] = el)} className="transition-all">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[st.status]}`} />
                        {title}
                        {st.duration_ms != null && (
                          <Badge variant="outline" className="h-4 text-[10px]">{st.duration_ms}ms</Badge>
                        )}
                        {st.status === "pass" && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                        {st.status === "fail" && <X className="h-3.5 w-3.5 text-red-500" />}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {st.status === "idle" ? "Not tested yet" : `Tested ${relTime(st.tested_at)}`}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => runStep(key)} disabled={st.status === "running" || runningAll}>
                    {st.status === "running"
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RotateCw className="h-3.5 w-3.5" />}
                    <span className="ml-1.5">Run Test</span>
                  </Button>
                </div>

                {st.error && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/5 text-red-600 text-xs p-2">
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
                      <span className={`h-1.5 w-1.5 rounded-full ${h.status === "pass" ? "bg-emerald-500" : "bg-red-500"}`} />
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