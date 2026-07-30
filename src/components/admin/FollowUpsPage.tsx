import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Play, X, Trash2, Send, Sparkles, GripVertical, Clock, MoveDown, Copy, Download, Upload, Eye, AlertTriangle, CheckCircle2 } from "lucide-react";
import SequenceAnalyticsPanel from "./followup/SequenceAnalyticsPanel";
import VariableFallbacksPanel from "./followup/VariableFallbacksPanel";

type Rule = { id: string; trigger_key: string; label: string; delay_hours: number; enabled: boolean; auto_send: boolean };
type Event = {
  id: string; prospect_id: string; trigger_key: string; status: string;
  scheduled_at: string; sent_at: string | null; attempt: number;
  message_subject: string | null; message_body: string | null; error: string | null;
  prospects?: { email: string; firstname: string | null; company: string | null };
};
type Seq = { id: string; name: string; trigger_type: string; is_active: boolean; created_at: string };
type Step = { id?: string; sequence_template_id?: string; step_number: number; delay_value: number; delay_unit: "hours"|"days"|"weeks"; message_subject: string; message_body: string; include_demo_link: boolean };


const TRIGGERS = [
  { key: "no_click", label: "No Link Click" },
  { key: "clicked_no_open", label: "Clicked, No Page Open" },
  { key: "opened_no_interaction", label: "Opened, No Interaction" },
  { key: "tried_voice_only", label: "Tried Voice Only" },
  { key: "tried_chat_only", label: "Tried Chat Only" },
  { key: "full_engage_no_reply", label: "Full Engagement, No Reply" },
  { key: "custom", label: "Custom" },
];

const VARIABLES: { name: string; desc: string }[] = [
  { name: "firstname", desc: "prospect's first name" },
  { name: "lastname", desc: "prospect's last name" },
  { name: "company", desc: "company name" },
  { name: "website", desc: "prospect website" },
  { name: "demo_url", desc: "personalized demo link" },
  { name: "sender_name", desc: "your name" },
  { name: "sender_email", desc: "your email" },
  { name: "campaign_name", desc: "campaign name" },
  { name: "days_since_demo", desc: "days since demo was sent" },
  { name: "days_since_click", desc: "days since they clicked" },
  { name: "days_since_open", desc: "days since they opened" },
];

function unitHours(u: string) { return u === "weeks" ? 168 : u === "hours" ? 1 : 24; }
function totalDays(steps: Step[]) {
  const h = steps.reduce((s, x) => s + x.delay_value * unitHours(x.delay_unit), 0);
  return Math.round(h / 24);
}

function sampleSubstitute(t: string) {
  return (t || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => ({
    firstname: "John", lastname: "Smith", company: "Acme Inc", website: "https://acme.com",
    demo_url: "https://aiagentfor.lovable.app/acme-inc",
    sender_name: "Alex", sender_email: "alex@agency.com", campaign_name: "Q3 SaaS",
    days_since_demo: "3", days_since_click: "2", days_since_open: "1",
  } as Record<string, string>)[k] ?? `{{${k}}}`);
}

export default function FollowUpsPage() {
  return (
    <Tabs defaultValue="rules" className="space-y-4">
      <TabsList>
        <TabsTrigger value="rules">Rules & Queue</TabsTrigger>
        <TabsTrigger value="sequences">Sequences</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="variables">Variables</TabsTrigger>
      </TabsList>
      <TabsContent value="rules"><RulesAndQueue /></TabsContent>
      <TabsContent value="sequences"><SequenceBuilder /></TabsContent>
      <TabsContent value="analytics"><SequenceAnalyticsPanel /></TabsContent>
      <TabsContent value="variables"><VariableFallbacksPanel /></TabsContent>
    </Tabs>
  );
}

// ─────────────────── Rules & Queue ───────────────────
function RulesAndQueue() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const [r, e] = await Promise.all([
      supabase.from("followup_rules").select("*").order("delay_hours"),
      supabase.from("followup_events").select("*, prospects(email, firstname, company)").order("scheduled_at", { ascending: false }).limit(60),
    ]);
    setRules((r.data as any) || []);
    setEvents((e.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const saveRule = async (r: Rule, patch: Partial<Rule>) => {
    await supabase.from("followup_rules").update(patch).eq("id", r.id);
    load();
  };

  const runEvaluator = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("followup-evaluator", { body: {} });
      if (error) throw error;
      toast.success(`Evaluator scheduled ${(data as any)?.created ?? 0} follow-ups`);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setRunning(false); }
  };

  const sendNow = async (ev: Event) => {
    const { data, error } = await supabase.functions.invoke("followup-send", { body: { event_id: ev.id } });
    if (error || !(data as any)?.ok) { toast.error((data as any)?.error || error?.message || "Send failed"); return; }
    toast.success("Follow-up sent"); load();
  };
  const skip = async (ev: Event) => {
    await supabase.from("followup_events").update({ status: "skipped" }).eq("id", ev.id);
    load();
  };

  const cols = useMemo(() => ({
    pending: events.filter((e) => e.status === "pending"),
    sent: events.filter((e) => e.status === "sent"),
    responded: events.filter((e) => e.status === "responded"),
  }), [events]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Rules</CardTitle>
            <CardDescription>Configure delays and auto-send per trigger.</CardDescription>
          </div>
          <Button size="sm" onClick={runEvaluator} disabled={running}>
            <Play className="h-3.5 w-3.5 mr-1.5" /> Run evaluator now
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {rules.map((r) => (
              <div key={r.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{r.label}</div>
                  <Switch checked={r.enabled} onCheckedChange={(v) => saveRule(r, { enabled: v })} />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Delay (h)</span>
                  <Input type="number" className="h-8 w-20" value={r.delay_hours}
                    onChange={(e) => setRules(rules.map((x) => x.id === r.id ? { ...x, delay_hours: parseInt(e.target.value || "0") } : x))}
                    onBlur={(e) => saveRule(r, { delay_hours: parseInt(e.target.value || "0") })} />
                  <span className="ml-auto flex items-center gap-2"><span className="text-muted-foreground">Auto-send</span>
                    <Switch checked={r.auto_send} onCheckedChange={(v) => saveRule(r, { auto_send: v })} />
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">key: <code>{r.trigger_key}</code></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Queue</CardTitle>
          <CardDescription>Pending · Sent · Responded</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {(["pending","sent","responded"] as const).map((col) => (
              <div key={col} className="rounded-md border bg-muted/30 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{col}</div>
                  <Badge variant="secondary">{(cols as any)[col].length}</Badge>
                </div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {(cols as any)[col].map((ev: Event) => (
                    <div key={ev.id} className="rounded-md bg-background border p-2 text-xs space-y-1">
                      <div className="font-medium">{ev.prospects?.firstname || ev.prospects?.email} · {ev.prospects?.company || "—"}</div>
                      <div className="text-muted-foreground">{ev.trigger_key} · attempt #{ev.attempt}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(ev.scheduled_at).toLocaleString()}</div>
                      {ev.error && <div className="text-destructive">{ev.error}</div>}
                      {col === "pending" && (
                        <div className="flex gap-1 pt-1">
                          <Button size="sm" variant="secondary" onClick={() => sendNow(ev)} className="h-7 text-[11px]"><Send className="h-3 w-3 mr-1" /> Send</Button>
                          <Button size="sm" variant="ghost" onClick={() => skip(ev)} className="h-7 text-[11px]">Skip</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────── Sequence Builder ───────────────────
function SequenceBuilder() {
  const [seqs, setSeqs] = useState<Seq[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [name, setName] = useState(""); const [trigger, setTrigger] = useState("custom"); const [active, setActive] = useState(true);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const loadSeqs = async () => {
    const { data } = await supabase.from("follow_up_sequences_templates").select("*").order("created_at", { ascending: false });
    setSeqs((data as any) || []);
  };
  const loadSteps = async (id: string) => {
    const { data } = await supabase.from("follow_up_steps").select("*").eq("sequence_template_id", id).order("step_number");
    setSteps(((data as any[]) || []).map((s) => ({ ...s })) as Step[]);

  };
  useEffect(() => { loadSeqs(); }, []);
  useEffect(() => {
    if (!selectedId) { setSteps([]); return; }
    const s = seqs.find((x) => x.id === selectedId);
    if (s) { setName(s.name); setTrigger(s.trigger_type); setActive(s.is_active); }
    loadSteps(selectedId);
  }, [selectedId, seqs.length]);

  const newSeq = async () => {
    const { data, error } = await supabase.from("follow_up_sequences_templates").insert({ name: "New Sequence", trigger_type: "custom" }).select("*").single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("follow_up_steps").insert({ sequence_template_id: (data as any).id, step_number: 1, delay_value: 0, delay_unit: "hours", message_subject: "Re: {{firstname}} overview", message_body: "Hi {{firstname}},\n\n{{demo_link}}\n" });
    await loadSeqs(); setSelectedId((data as any).id);
  };
  const deleteSeq = async (id: string) => {
    await supabase.from("follow_up_sequences_templates").delete().eq("id", id);
    if (selectedId === id) setSelectedId(null);
    loadSeqs();
  };
  const saveSeq = async () => {
    if (!selectedId) return;
    await supabase.from("follow_up_sequences_templates").update({ name, trigger_type: trigger, is_active: active }).eq("id", selectedId);
    // upsert steps: delete removed then insert/update
    const { data: existing } = await supabase.from("follow_up_steps").select("id").eq("sequence_template_id", selectedId);
    const keep = new Set(steps.filter((s) => s.id).map((s) => s.id!));
    const toDelete = (existing || []).filter((e: any) => !keep.has(e.id)).map((e: any) => e.id);
    if (toDelete.length) await supabase.from("follow_up_steps").delete().in("id", toDelete);
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]; const step_number = i + 1;
      if (s.id) await supabase.from("follow_up_steps").update({ ...s, step_number, sequence_template_id: selectedId }).eq("id", s.id);
      else await supabase.from("follow_up_steps").insert({ ...s, step_number, sequence_template_id: selectedId });
    }
    toast.success("Sequence saved");
    loadSeqs(); loadSteps(selectedId);
  };

  const bodyRefs = useRef<(HTMLTextAreaElement | null)[]>([]);


  const addStep = () => setSteps([...steps, { step_number: steps.length + 1, delay_value: 2, delay_unit: "days", message_subject: "Re: {{firstname}} overview", message_body: "", include_demo_link: true }]);
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));
  const updateStep = (i: number, patch: Partial<Step>) => setSteps(steps.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  // Insert the variable at the caret position of the step's body textarea (falls back to append).
  const insertVar = (i: number, v: string) => {
    const token = `{{${v}}}`;
    const el = bodyRefs.current[i];
    const body = steps[i].message_body || "";
    if (!el) { updateStep(i, { message_body: body + token }); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? start;
    const next = body.slice(0, start) + token + body.slice(end);
    updateStep(i, { message_body: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };


  // Health check — detect unresolved chips, over-long delays, empty body, missing subject, duplicate step delays
  const healthIssues = useMemo(() => {
    const issues: { level: "warn" | "error"; msg: string }[] = [];
    const knownVars = new Set(VARIABLES.map((v) => v.name));
    steps.forEach((s, i) => {
      if (!s.message_body?.trim()) issues.push({ level: "error", msg: `Step ${i + 1}: message body is empty.` });
      if (!s.message_subject?.trim()) issues.push({ level: "warn", msg: `Step ${i + 1}: missing subject line.` });
      const chips = [...(s.message_body || "").matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
      chips.forEach((c) => { if (!knownVars.has(c)) issues.push({ level: "warn", msg: `Step ${i + 1}: unknown variable {{${c}}} — add a fallback.` }); });
      if (s.delay_value * unitHours(s.delay_unit) > 720) issues.push({ level: "warn", msg: `Step ${i + 1}: delay > 30 days — sequence may go stale.` });
    });
    if (steps.length > 7) issues.push({ level: "warn", msg: "More than 7 steps — reply rate typically drops after step 5." });
    if (steps.length && steps[0].delay_value * unitHours(steps[0].delay_unit) === 0 && steps[0].step_number !== 1) issues.push({ level: "warn", msg: "First step has zero delay." });
    return issues;
  }, [steps]);

  const duplicateSequence = async () => {
    if (!selectedId) return;
    const src = seqs.find((s) => s.id === selectedId); if (!src) return;
    const { data: newSeq } = await supabase.from("follow_up_sequences_templates")
      .insert({ name: `${src.name} (copy)`, trigger_type: src.trigger_type, is_active: false }).select("*").single();
    if (!newSeq) return;
    if (steps.length) {
      await supabase.from("follow_up_steps").insert(steps.map((s, i) => ({
        sequence_template_id: (newSeq as any).id, step_number: i + 1,
        delay_value: s.delay_value, delay_unit: s.delay_unit,
        message_subject: s.message_subject, message_body: s.message_body, include_demo_link: s.include_demo_link,
      })));
    }
    toast.success("Duplicated");
    await loadSeqs(); setSelectedId((newSeq as any).id);
  };

  const exportJson = () => {
    const payload = { name, trigger, steps: steps.map(({ id, sequence_template_id, ...rest }) => rest) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${name || "sequence"}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = () => {
    try {
      const parsed = JSON.parse(importText);
      if (parsed.name) setName(parsed.name);
      if (parsed.trigger) setTrigger(parsed.trigger);
      if (Array.isArray(parsed.steps)) setSteps(parsed.steps.map((s: any, i: number) => ({
        step_number: i + 1,
        delay_value: s.delay_value ?? 1, delay_unit: s.delay_unit ?? "days",
        message_subject: s.message_subject || "", message_body: s.message_body || "",
        include_demo_link: !!s.include_demo_link,
      })));

      setImportOpen(false); setImportText("");
      toast.success("Imported — click Save to persist.");
    } catch (e: any) { toast.error("Invalid JSON"); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[35%_1fr]">
      {/* Left: list */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">My Sequences</CardTitle>
          <Button size="sm" onClick={newSeq}><Plus className="h-3.5 w-3.5 mr-1" /> New</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {seqs.length === 0 && <p className="text-xs text-muted-foreground">No sequences yet — click + New to build your first one.</p>}
          {seqs.map((s) => (
            <button key={s.id} onClick={() => setSelectedId(s.id)}
              className={`w-full rounded-md border p-2 text-left text-sm hover:bg-muted/50 ${selectedId === s.id ? "border-primary bg-muted/40" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate">{s.name}</div>
                <div className="flex items-center gap-1">
                  <Badge variant={s.is_active ? "default" : "outline"} className="text-[10px]">{s.is_active ? "active" : "off"}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteSeq(s.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{s.trigger_type}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Right: editor */}
      <Card>
        {!selectedId ? (
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Select a sequence on the left, or create a new one.
          </CardContent>
        ) : (
          <>
            <CardHeader className="pb-3">
              <div className="grid gap-2 md:grid-cols-[1fr_220px_auto_auto]">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sequence name" />
                <Select value={trigger} onValueChange={setTrigger}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TRIGGERS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex items-center gap-2 text-xs"><Switch checked={active} onCheckedChange={setActive} /> Active</div>
                <Button onClick={saveSeq}>Save Sequence</Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}><Eye className="h-3.5 w-3.5 mr-1" /> Preview</Button>
                <Button size="sm" variant="outline" onClick={duplicateSequence}><Copy className="h-3.5 w-3.5 mr-1" /> Duplicate</Button>
                <Button size="sm" variant="outline" onClick={exportJson}><Download className="h-3.5 w-3.5 mr-1" /> Export</Button>
                <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-3.5 w-3.5 mr-1" /> Import</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {healthIssues.length > 0 ? (
                <div className="rounded-md border bg-amber-500/5 border-amber-500/30 p-2 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /> Sequence health</div>
                  {healthIssues.map((h, i) => (
                    <div key={i} className={`text-[11px] ${h.level === "error" ? "text-red-600" : "text-amber-700 dark:text-amber-300"}`}>• {h.msg}</div>
                  ))}
                </div>
              ) : steps.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Sequence looks healthy.</div>
              )}

              {/* Timeline */}
              <div className="rounded-md border bg-muted/30 p-3 text-xs overflow-x-auto">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="font-medium">Day 0: Trigger</span>
                  {steps.map((s, i) => (
                    <span key={i} className="flex items-center gap-2">
                      <MoveDown className="h-3 w-3 rotate-[-90deg]" />
                      <span className="rounded bg-background border px-2 py-1">
                        <Clock className="inline h-3 w-3 mr-1" />{s.delay_value}{s.delay_unit[0]} · Step {i + 1}
                      </span>
                    </span>
                  ))}
                  <span className="ml-2 text-muted-foreground">Total ≈ {totalDays(steps)}d</span>
                </div>
              </div>

              {/* Steps */}
              {steps.map((s, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2 bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <GripVertical className="h-4 w-4 text-muted-foreground" /> Step {i + 1}
                    </div>
                    {i > 0 && (
                      <Button variant="ghost" size="icon" onClick={() => removeStep(i)}><X className="h-4 w-4" /></Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{i === 0 ? "Send" : "Then wait"}</span>
                    <Input type="number" className="h-8 w-20" value={s.delay_value} onChange={(e) => updateStep(i, { delay_value: parseInt(e.target.value || "0") })} />
                    <Select value={s.delay_unit} onValueChange={(v) => updateStep(i, { delay_unit: v as any })}>
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hours">hours</SelectItem>
                        <SelectItem value="days">days</SelectItem>
                        <SelectItem value="weeks">weeks</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">{i === 0 ? "after trigger fires" : "before this step"}</span>
                  </div>
                  <Input value={s.message_subject} onChange={(e) => updateStep(i, { message_subject: e.target.value })} placeholder="Email Subject" />
                  <div className="flex flex-wrap gap-1">
                    {VARIABLES.map((v) => (
                      <button key={v.name} type="button" title={`{{${v.name}}} → ${v.desc}`}
                        onClick={() => insertVar(i, v.name)}
                        className="rounded-full border bg-muted px-2 py-0.5 text-[10px] hover:bg-muted-foreground/20">
                        {`{{${v.name}}}`}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    ref={(el) => { bodyRefs.current[i] = el; }}
                    value={s.message_body}
                    onChange={(e) => updateStep(i, { message_body: e.target.value })}
                    rows={7}
                    placeholder="Write the full message, including your own link or CTA. Click a variable chip to insert it at the cursor."
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Free text — nothing is appended automatically. Insert <code>{"{{demo_link}}"}</code> wherever you want the personalized demo link.
                  </p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Preview with sample data</summary>
                    <div className="mt-2 rounded border bg-muted/30 p-2 whitespace-pre-wrap">
                      <div className="font-medium">{sampleSubstitute(s.message_subject)}</div>
                      <div className="mt-1">{sampleSubstitute(s.message_body)}</div>

                    </div>
                  </details>
                </div>
              ))}

              <Button variant="outline" onClick={addStep}><Plus className="h-3.5 w-3.5 mr-1" /> Add Step</Button>
              {steps.length >= 6 && <p className="text-xs text-muted-foreground">Most sequences perform best with 3-5 steps.</p>}

              <div className="pt-2">
                <Button variant="secondary" onClick={() => setEnrollOpen(true)}>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Enroll a prospect
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>

      <EnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} sequenceId={selectedId} onEnrolled={() => toast.success("Enrolled")} />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Sequence Preview · sample data</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {steps.map((s, i) => (
              <div key={i} className="rounded border p-3 bg-muted/30">
                <div className="text-[10px] uppercase text-muted-foreground">Step {i + 1} · after {s.delay_value}{s.delay_unit[0]}</div>
                <div className="font-medium text-sm mt-1">{sampleSubstitute(s.message_subject)}</div>
                <div className="text-xs whitespace-pre-wrap mt-2">{sampleSubstitute(s.message_body)}</div>
                
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import sequence JSON</DialogTitle></DialogHeader>
          <Textarea rows={12} placeholder='{ "name": "...", "trigger": "custom", "steps": [...] }'
            value={importText} onChange={(e) => setImportText(e.target.value)} />
          <div className="flex justify-end"><Button onClick={importJson}>Import</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────── Enroll Dialog ───────────────────
function EnrollDialog({ open, onOpenChange, sequenceId, onEnrolled }: { open: boolean; onOpenChange: (v: boolean) => void; sequenceId: string | null; onEnrolled: () => void; }) {
  const [prospects, setProspects] = useState<any[]>([]);
  const [prospectId, setProspectId] = useState<string>("");
  const [startStep, setStartStep] = useState(1);

  useEffect(() => {
    if (!open) return;
    supabase.from("prospects").select("id, email, firstname, company").eq("is_test_data", false).order("last_message_at", { ascending: false }).limit(100).then(({ data }) => setProspects((data as any) || []));
  }, [open]);

  const enroll = async () => {
    if (!sequenceId || !prospectId) return;
    const { data: firstStep } = await supabase.from("follow_up_steps").select("delay_value, delay_unit").eq("sequence_template_id", sequenceId).eq("step_number", startStep).maybeSingle();
    const hours = firstStep ? (firstStep as any).delay_value * unitHours((firstStep as any).delay_unit) : 0;
    const nextAt = new Date(Date.now() + hours * 3600_000).toISOString();
    const { error } = await supabase.from("follow_up_enrollments").insert({
      prospect_id: prospectId, sequence_template_id: sequenceId,
      current_step: startStep, status: "active", next_step_at: nextAt,
    });
    if (error) { toast.error(error.message); return; }
    onOpenChange(false); onEnrolled();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Enroll prospect in sequence</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={prospectId} onValueChange={setProspectId}>
            <SelectTrigger><SelectValue placeholder="Select prospect" /></SelectTrigger>
            <SelectContent>
              {prospects.map((p) => <SelectItem key={p.id} value={p.id}>{p.firstname || p.email} — {p.company || "—"}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm"><span>Start from step</span>
            <Input type="number" min={1} className="h-8 w-20" value={startStep} onChange={(e) => setStartStep(parseInt(e.target.value || "1"))} />
          </div>
          <div className="flex justify-end"><Button onClick={enroll} disabled={!prospectId}>Enroll</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}