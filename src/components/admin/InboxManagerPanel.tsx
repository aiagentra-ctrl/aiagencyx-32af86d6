import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Search, Send, Sparkles, Pencil, ExternalLink, Copy, ArrowLeft, RefreshCw, Inbox, Globe,
  Code2, User, Webhook, AlertCircle, ChevronDown, Mic, MessageSquare, Eye,
} from "lucide-react";
import SmartReplyEditor, { SmartReplyEditorHandle } from "./inbox/SmartReplyEditor";
import PipelineTracer from "./inbox/PipelineTracer";
import WebhookLogsTab from "./inbox/WebhookLogsTab";
import ErrorLogTab from "./inbox/ErrorLogTab";
import ErrorBell from "./inbox/ErrorBell";
import NotificationBell from "./inbox/NotificationBell";
import HealthCheckTab from "./inbox/HealthCheckTab";
import { ShieldCheck, Flame } from "lucide-react";

type Prospect = {
  id: string; email: string; firstname: string | null; company: string | null;
  website_url: string | null; campaign_id: string | null; campaign_name: string | null;
  sender_email: string | null; reply_to_email: string | null;
  automation_paused: boolean; last_message_at: string | null;
  last_classification: "Positive" | "Negative" | "Objection" | null;
  demo_sent_at: string | null;
  created_at: string;
  is_hot_lead?: boolean | null;
  hot_lead_open_count?: number | null;
  hot_lead_detected_at?: string | null;
};
type Msg = {
  id: string; prospect_id: string; direction: "incoming" | "outgoing";
  subject: string | null; body: string;
  classification: "Positive" | "Negative" | "Objection" | null;
  classified_by: "ai" | "human" | null; created_at: string;
  manyreach_message_id: string | null;
};
type Demo = { id: string; prospect_id: string; demo_url: string; created_at: string };
type PipelineEvent = { id: string; message_id: string | null; step: string; status: string; details: any; created_at: string };

type Filter = "all" | "Positive" | "Negative" | "Objection" | "paused";
type ViewMode = "user" | "dev";

const VIEW_STORAGE_KEY = "inbox_view_mode";
const REPLY_VARS = ["firstname", "company", "sender_name", "sender_email", "demo_url"];

const dotClass = (c?: string | null) =>
  c === "Positive" ? "bg-emerald-500"
  : c === "Negative" ? "bg-red-500"
  : c === "Objection" ? "bg-amber-500"
  : "bg-muted-foreground/40";

const badgeVariant = (c?: string | null): "default" | "secondary" | "destructive" | "outline" =>
  c === "Positive" ? "default" : c === "Negative" ? "destructive" : c === "Objection" ? "secondary" : "outline";

function relTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

async function invoke(name: string, body: any) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data;
}

const InboxManagerPanel = () => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [genDemo, setGenDemo] = useState(false);
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode) || "user");
  const [activeTab, setActiveTab] = useState<string>("inbox");
  const editorRef = useRef<SmartReplyEditorHandle | null>(null);

  useEffect(() => { localStorage.setItem(VIEW_STORAGE_KEY, view); }, [view]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: ps }, { data: ms }, { data: ds }, { data: pe }] = await Promise.all([
      supabase.from("prospects").select("*").eq("is_test_data", false).order("last_message_at", { ascending: false, nullsFirst: false }),
      supabase.from("inbox_messages").select("*").eq("is_test_data", false).order("created_at", { ascending: true }),
      supabase.from("inbox_demos").select("*").order("created_at", { ascending: false }),
      supabase.from("pipeline_events").select("id, message_id, step, status, details, created_at").order("created_at", { ascending: false }).limit(500),
    ]);
    setProspects((ps as Prospect[]) || []);
    setMessages((ms as Msg[]) || []);
    setDemos((ds as Demo[]) || []);
    setPipelineEvents((pe as PipelineEvent[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const ch = supabase
      .channel("inbox-manager")
      .on("postgres_changes", { event: "*", schema: "public", table: "inbox_messages" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "inbox_demos" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_events" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prospects.filter((p) => {
      if (filter === "paused" && !p.automation_paused) return false;
      if (filter !== "all" && filter !== "paused" && p.last_classification !== filter) return false;
      if (q) {
        const hay = `${p.firstname || ""} ${p.company || ""} ${p.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [prospects, filter, search]);

  const selected = prospects.find((p) => p.id === selectedId) || null;
  const thread = useMemo(() =>
    messages.filter((m) => m.prospect_id === selectedId)
      .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    [messages, selectedId]);
  const selectedDemo = demos.find((d) => d.prospect_id === selectedId) || null;
  const lastIncoming = useMemo(() => [...thread].reverse().find((m) => m.direction === "incoming"), [thread]);

  // Classify event details per message id (last classified event)
  const classifyDetailsByMsg = useMemo(() => {
    const map: Record<string, PipelineEvent> = {};
    for (const e of pipelineEvents) {
      if (e.step === "classified" && e.message_id && !map[e.message_id]) map[e.message_id] = e;
    }
    return map;
  }, [pipelineEvents]);

  const stats = useMemo(() => {
    const now = Date.now();
    const inWeek = (iso: string) => now - +new Date(iso) < 7 * 86400000;
    const inToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
    const incoming = messages.filter((m) => m.direction === "incoming");
    const todayConv = new Set(incoming.filter((m) => inToday(m.created_at)).map((m) => m.prospect_id)).size;
    const weekConv = new Set(incoming.filter((m) => inWeek(m.created_at)).map((m) => m.prospect_id)).size;
    const total = incoming.length || 1;
    const pos = incoming.filter((m) => m.classification === "Positive").length;
    const neg = incoming.filter((m) => m.classification === "Negative").length;
    const obj = incoming.filter((m) => m.classification === "Objection").length;
    const out = messages.filter((m) => m.direction === "outgoing").length;
    const replyRate = incoming.length ? Math.round((out / incoming.length) * 100) : 0;
    return {
      todayConv, weekConv,
      pPos: Math.round((pos / total) * 100),
      pNeg: Math.round((neg / total) * 100),
      pObj: Math.round((obj / total) * 100),
      demos: demos.length, replyRate,
    };
  }, [messages, demos]);

  const togglePause = async (paused: boolean) => {
    if (!selected) return;
    await invoke("inbox-actions", { action: "pause", prospect_id: selected.id, paused });
    toast.success(paused ? "Automation paused" : "Automation resumed");
  };
  const relabel = async (msgId: string, cls: "Positive" | "Negative" | "Objection") => {
    if (!selected) return;
    await invoke("inbox-actions", { action: "relabel", prospect_id: selected.id, message_id: msgId, classification: cls });
    toast.success("Relabeled");
  };
  const sendManual = async () => {
    const text = editorRef.current?.getValue().trim() || draft.trim();
    if (!selected || !text) return;
    setSending(true);
    const optimistic: Msg = {
      id: `tmp-${Date.now()}`, prospect_id: selected.id, direction: "outgoing",
      subject: null, body: text, classification: null, classified_by: "human",
      created_at: new Date().toISOString(), manyreach_message_id: null,
    };
    setMessages((m) => [...m, optimistic]);
    try {
      await invoke("inbox-manual-reply", { prospect_id: selected.id, body: text });
      toast.success("Reply sent");
      editorRef.current?.setValue("");
      setDraft("");
    } catch (e: any) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      toast.error(`Send failed: ${e.message || e}`);
    } finally {
      setSending(false);
    }
  };
  const regenerate = async () => {
    if (!selected) return;
    setRegenerating(true);
    try {
      const r = await invoke("inbox-actions", { action: "regenerate", prospect_id: selected.id });
      editorRef.current?.setValue(r.reply || "");
      setDraft(r.reply || "");
      toast.success("AI draft ready — review before sending");
    } catch (e: any) {
      toast.error(`Regenerate failed: ${e.message || e}`);
    } finally {
      setRegenerating(false);
    }
  };
  const generateDemo = async () => {
    if (!selected) return;
    setGenDemo(true);
    try {
      const r = await invoke("inbox-actions", { action: "generate_demo", prospect_id: selected.id });
      if (r?.demo_url) toast.success("Demo generated");
      else toast.error("No demo URL returned");
    } catch (e: any) {
      toast.error(`Demo failed: ${e.message || e}`);
    } finally {
      setGenDemo(false);
    }
  };

  const jumpToProspect = (pid: string) => {
    setSelectedId(pid);
    setActiveTab("inbox");
  };

  const isDev = view === "dev";

  return (
    <div className="space-y-4">
      {/* Header with view toggle + bell */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border bg-card p-1">
          <button
            onClick={() => setView("user")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${view === "user" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <User className="h-3.5 w-3.5" /> User View
          </button>
          <button
            onClick={() => setView("dev")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${view === "dev" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Code2 className="h-3.5 w-3.5" /> Developer View
          </button>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell onJump={jumpToProspect} />
          <ErrorBell onJump={jumpToProspect} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox"><Inbox className="mr-1.5 h-3.5 w-3.5" /> Inbox</TabsTrigger>
          <TabsTrigger value="prompts"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Prompts</TabsTrigger>
          
          {isDev && <TabsTrigger value="webhooks"><Webhook className="mr-1.5 h-3.5 w-3.5" /> Webhook Logs</TabsTrigger>}
          {isDev && <TabsTrigger value="errors"><AlertCircle className="mr-1.5 h-3.5 w-3.5" /> Error Log</TabsTrigger>}
          {isDev && <TabsTrigger value="health"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Health Check</TabsTrigger>}
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <StatCard label="Today" value={stats.todayConv} />
            <StatCard label="This Week" value={stats.weekConv} />
            <StatCard label="% Positive" value={`${stats.pPos}%`} accent="text-emerald-500" />
            <StatCard label="% Negative" value={`${stats.pNeg}%`} accent="text-red-500" />
            <StatCard label="% Objection" value={`${stats.pObj}%`} accent="text-amber-500" />
            <StatCard label="Demos / Reply Rate" value={`${stats.demos} / ${stats.replyRate}%`} />
          </div>

          <Card className="overflow-hidden">
            <div className="grid md:grid-cols-[340px_1fr] min-h-[600px]">
              <div className={`border-r ${selectedId ? "hidden md:block" : "block"}`}>
                <div className="p-3 space-y-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Search name / company / email"
                      value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(["all", "Positive", "Negative", "Objection", "paused"] as Filter[]).map((f) => (
                      <Button key={f} size="sm" variant={filter === f ? "default" : "outline"}
                        className="h-7 px-2 text-xs capitalize" onClick={() => setFilter(f)}>{f}</Button>
                    ))}
                  </div>
                </div>
                <ScrollArea className="h-[540px]">
                  {loading ? (
                    <div className="p-4 space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-14 rounded-md bg-muted/40 animate-pulse" />
                      ))}
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">No conversations yet.</div>
                  ) : (
                    <ul className="divide-y">
                      {filtered.map((p) => {
                        const last = [...messages].reverse().find((m) => m.prospect_id === p.id);
                        const active = selectedId === p.id;
                        return (
                          <li key={p.id}>
                            <button
                              onClick={() => setSelectedId(p.id)}
                              className={`w-full text-left p-3 hover:bg-muted/40 transition relative ${active ? "bg-muted/60" : ""} ${p.is_hot_lead ? "bg-orange-500/5 border-l-2 border-orange-500" : ""}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass(p.last_classification)}`} />
                                  <span className="font-medium text-sm truncate">
                                    {p.firstname || p.email.split("@")[0]}
                                    {p.company ? <span className="text-muted-foreground"> · {p.company}</span> : null}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0">{relTime(p.last_message_at || p.created_at)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {last?.body?.slice(0, 80) || p.email}
                              </div>
                              <div className="flex items-center flex-wrap gap-1 mt-1.5">
                                {p.last_classification === "Objection" && (
                                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20">🟡 Objection</span>
                                )}
                                {p.last_classification === "Positive" && (
                                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">🟢 Positive</span>
                                )}
                                {p.last_classification === "Negative" && (
                                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] bg-red-500/10 text-red-600 border border-red-500/20">🔴 Negative</span>
                                )}
                                {p.demo_sent_at && (
                                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary border border-primary/20"><Eye className="h-2.5 w-2.5" /> demo sent</span>
                                )}
                                {p.automation_paused && (
                                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground border">⏸ Paused</span>
                                )}
                                {p.is_hot_lead && (
                                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] bg-orange-500/10 text-orange-600 border border-orange-500/30 animate-pulse">
                                    <Flame className="h-2.5 w-2.5" /> Hot · {p.hot_lead_open_count || 0} opens
                                  </span>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </ScrollArea>
              </div>

              <div className={`flex flex-col ${selectedId ? "block" : "hidden md:flex"}`}>
                {!selected ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                    Select a conversation to begin.
                  </div>
                ) : (
                  <>
                    <div className="p-4 border-b flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setSelectedId(null)}>
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {selected.firstname || "—"} {selected.company && <span className="text-muted-foreground font-normal">· {selected.company}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{selected.email}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {selected.campaign_name && <>Campaign: {selected.campaign_name} · </>}
                            {selected.sender_email && <>From: {selected.sender_email}</>}
                          </div>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs shrink-0">
                        <span className="text-muted-foreground">Pause</span>
                        <Switch checked={selected.automation_paused} onCheckedChange={togglePause} />
                      </label>
                    </div>

                    {selected.is_hot_lead && (
                      <div className="px-4 py-3 border-b bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent border-orange-500/30 animate-fade-in">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Flame className="h-5 w-5 text-orange-500 relative" />
                              <span className="absolute inset-0 rounded-full bg-orange-500/30 animate-ping" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-orange-700 dark:text-orange-400">🔥 Hot lead detected</div>
                              <div className="text-[11px] text-muted-foreground">
                                {selected.hot_lead_open_count || 0} demo opens · sequence auto-paused
                                {selected.hot_lead_detected_at && ` · ${relTime(selected.hot_lead_detected_at)}`}
                              </div>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="border-orange-500/40 text-orange-600 hover:bg-orange-500/10"
                            onClick={async () => {
                              try {
                                await invoke("resume-hot-lead-sequence", { prospect_id: selected.id });
                                toast.success("Sequence resumed");
                                fetchAll();
                              } catch (e: any) { toast.error(e.message || "Failed"); }
                            }}>
                            Resume sequence
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="px-4 py-3 border-b bg-muted/20">
                      {selectedDemo ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Globe className="h-4 w-4 text-primary shrink-0" />
                            <a href={selectedDemo.demo_url} target="_blank" rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline truncate">{selectedDemo.demo_url}</a>
                            <span className="text-[11px] text-muted-foreground shrink-0">· {relTime(selectedDemo.created_at)}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(selectedDemo.demo_url); toast.success("Copied"); }}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" asChild>
                              <a href={selectedDemo.demo_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm text-muted-foreground">No demo generated yet.</div>
                          <Button size="sm" onClick={generateDemo} disabled={genDemo || !selected.website_url}>
                            {genDemo ? "Generating…" : "Generate Demo Now"}
                          </Button>
                        </div>
                      )}
                    </div>

                    {isDev && lastIncoming && (
                      <div className="px-4 py-3 border-b animate-fade-in">
                        <PipelineTracer messageId={lastIncoming.id} prospectId={selected.id} />
                      </div>
                    )}

                    <ScrollArea className="flex-1 px-4 py-4 max-h-[460px]">
                      <div className="space-y-3">
                        {thread.map((m) => {
                          const ce = m.direction === "incoming" ? classifyDetailsByMsg[m.id] : undefined;
                          return (
                            <div key={m.id} className={`flex ${m.direction === "outgoing" ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words
                                ${m.direction === "outgoing" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                <div>{m.body}</div>
                                <div className="mt-1 flex items-center gap-2 text-[10px] opacity-70 flex-wrap">
                                  <span>{new Date(m.created_at).toLocaleString()}</span>
                                  {m.direction === "incoming" && (
                                    <>
                                      <Badge variant={badgeVariant(m.classification)} className="h-4 text-[10px]">
                                        {m.classification === "Positive" ? "🟢 Positive" :
                                         m.classification === "Negative" ? "🔴 Negative" :
                                         m.classification === "Objection" ? "🟡 Objection" : "unlabeled"}
                                      </Badge>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button className="hover:opacity-100 opacity-70"><Pencil className="h-3 w-3" /></button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                          <DropdownMenuItem onClick={() => relabel(m.id, "Positive")}>🟢 Positive</DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => relabel(m.id, "Negative")}>🔴 Negative</DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => relabel(m.id, "Objection")}>🟡 Objection</DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </>
                                  )}
                                  {m.classified_by === "human" && <span>· human</span>}
                                </div>
                                {isDev && ce && (
                                  <Collapsible className="mt-2">
                                    <CollapsibleTrigger className="flex items-center gap-1 text-[10px] opacity-70 hover:opacity-100">
                                      <ChevronDown className="h-3 w-3" /> AI classifier output
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <pre className="text-[10px] bg-background/40 text-foreground rounded p-2 mt-1 overflow-auto max-h-32">
{JSON.stringify(ce.details, null, 2)}
                                      </pre>
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>

                    <Separator />
                    <div className="p-3 space-y-2">
                      <SmartReplyEditor
                        ref={editorRef}
                        variables={REPLY_VARS}
                        placeholder="Type a manual reply… use {{variable}} chips for safe placeholders"
                        onChange={setDraft}
                      />
                      <div className="flex flex-wrap justify-between gap-2">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={regenerate} disabled={regenerating}>
                            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
                            Regenerate AI
                          </Button>
                        </div>
                        <Button size="sm" onClick={sendManual} disabled={sending || !draft.trim()}>
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          {sending ? "Sending…" : "Send"}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="prompts"><PromptsEditor /></TabsContent>
        
        <TabsContent value="webhooks"><WebhookLogsTab /></TabsContent>
        <TabsContent value="errors"><ErrorLogTab onJump={jumpToProspect} /></TabsContent>
        <TabsContent value="health"><HealthCheckTab /></TabsContent>
      </Tabs>
    </div>
  );
};

const StatCard = ({ label, value, accent }: { label: string; value: string | number; accent?: string }) => (
  <Card>
    <CardContent className="p-3">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-semibold ${accent || ""}`}>{value}</div>
    </CardContent>
  </Card>
);

const PromptsEditor = () => {
  const [rows, setRows] = useState<{ id: string; classification: string; system_prompt: string }[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  useEffect(() => {
    supabase.from("inbox_prompts").select("*").order("classification")
      .then(({ data }) => setRows((data as any) || []));
  }, []);
  const save = async (id: string, classification: string, system_prompt: string) => {
    setSaving(id);
    const { error } = await supabase.from("inbox_prompts").update({ system_prompt }).eq("id", id);
    setSaving(null);
    if (error) toast.error(error.message); else toast.success(`Saved ${classification} prompt`);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Classifier & Reply Prompts</CardTitle>
        <CardDescription>System prompts the AI uses. For reply body templates with locked chips, use the Templates tab.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {rows.map((r) => (
          <div key={r.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline">{r.classification}</Badge>
              <Button size="sm" disabled={saving === r.id} onClick={() => save(r.id, r.classification, r.system_prompt)}>
                {saving === r.id ? "Saving…" : "Save"}
              </Button>
            </div>
            <Textarea rows={8} value={r.system_prompt}
              onChange={(e) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, system_prompt: e.target.value } : x))} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default InboxManagerPanel;
