import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageSquare, Sparkles, TrendingUp, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

type Session = {
  id: string;
  chatbot_id: string;
  business_name: string | null;
  session_id: string;
  started_at: string;
  last_message_at: string | null;
  total_messages: number;
  products_shown: number;
  products_clicked: number;
  outcome: string | null;
  sentiment: string | null;
  sentiment_score: number | null;
  flagged_for_review: boolean;
  analyzed_at: string | null;
  analysis: any;
  topics: string[] | null;
  ended_at?: string | null;
};
type Msg = {
  id: string; role: string; content: string; created_at: string;
  products_shown: number | null; query_intent: string | null;
};
type Suggestion = {
  id: string; chatbot_id: string | null; industry: string | null;
  suggestion_type: string | null; summary: string | null;
  suggestions: any; status: string; created_at: string;
  sessions_analyzed: number | null; outcomes: any;
};

function outcomeTone(o: string | null) {
  if (!o) return "bg-slate-100 text-slate-600";
  if (/purchas|convert|success/i.test(o)) return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (/abandon|drop|frustrat|fail/i.test(o)) return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  return "bg-slate-100 text-slate-600";
}
function sentimentTone(s: string | null) {
  if (!s) return "bg-slate-100 text-slate-600";
  if (/pos/i.test(s)) return "bg-emerald-50 text-emerald-700";
  if (/neg/i.test(s)) return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

export default function ConversationsPage() {
  const [tab, setTab] = useState("live");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function loadSessions() {
    setLoading(true);
    const { data } = await supabase
      .from("chatbot_sessions")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(100);
    setSessions((data as any) || []);
    setLoading(false);
  }
  async function loadSuggestions() {
    const { data } = await supabase
      .from("prompt_improvement_suggestions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setSuggestions((data as any) || []);
  }
  async function loadMessages(sess: Session) {
    setSelected(sess);
    const { data } = await supabase
      .from("chatbot_messages")
      .select("*")
      .eq("session_id", sess.session_id)
      .order("created_at", { ascending: true });
    setMsgs((data as any) || []);
  }

  useEffect(() => {
    loadSessions();
    loadSuggestions();
    const ch = supabase
      .channel("conv-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "chatbot_sessions" }, () => loadSessions())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const stats = useMemo(() => {
    const total = sessions.length;
    const active = sessions.filter(s => !s.ended_at).length;
    const withOutcome = sessions.filter(s => s.outcome).length;
    const flagged = sessions.filter(s => s.flagged_for_review).length;
    const avgSent =
      sessions.filter(s => s.sentiment_score != null)
        .reduce((a, s) => a + (s.sentiment_score || 0), 0) /
        Math.max(1, sessions.filter(s => s.sentiment_score != null).length);
    return { total, active, withOutcome, flagged, avgSent };
  }, [sessions]);

  async function runAnalyze() {
    setRefreshing(true);
    try {
      await supabase.functions.invoke("analyze-chat-session", { body: { limit: 20 } });
      toast.success("Analysis run queued");
      await loadSessions();
    } catch (e: any) {
      toast.error(e?.message || "Failed to trigger analysis");
    } finally { setRefreshing(false); }
  }
  async function runImprovements() {
    setRefreshing(true);
    try {
      await supabase.functions.invoke("generate-prompt-improvements", { body: {} });
      toast.success("Improvement suggestions generated");
      await loadSuggestions();
    } catch (e: any) {
      toast.error(e?.message || "Failed to trigger improvements");
    } finally { setRefreshing(false); }
  }
  async function setSuggestionStatus(id: string, status: "approved" | "rejected") {
    await supabase.from("prompt_improvement_suggestions").update({ status }).eq("id", id);
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    toast.success(`Suggestion ${status}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Conversations</h2>
          <p className="text-sm text-muted-foreground">Live chat monitoring, session analysis and AI prompt tuning.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runAnalyze} disabled={refreshing}>
            <Sparkles className="h-4 w-4 mr-1.5" /> Analyze recent
          </Button>
          <Button size="sm" onClick={runImprovements} disabled={refreshing}>
            <TrendingUp className="h-4 w-4 mr-1.5" /> Generate improvements
          </Button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total sessions" value={stats.total} />
        <StatCard label="Active now" value={stats.active} tone="emerald" />
        <StatCard label="Analyzed" value={stats.withOutcome} />
        <StatCard label="Flagged" value={stats.flagged} tone="rose" />
        <StatCard label="Avg sentiment" value={isFinite(stats.avgSent) ? stats.avgSent.toFixed(2) : "—"} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="live"><MessageSquare className="h-4 w-4 mr-1.5" />Live monitor</TabsTrigger>
          <TabsTrigger value="suggestions"><TrendingUp className="h-4 w-4 mr-1.5" />Improvements</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 min-h-[520px]">
            {/* Session list */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-sm">Recent sessions</CardTitle>
                <Button variant="ghost" size="icon" onClick={loadSessions} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </CardHeader>
              <CardContent className="p-0 max-h-[560px] overflow-y-auto">
                {sessions.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">No sessions yet.</div>
                )}
                <AnimatePresence initial={false}>
                  {sessions.map(s => (
                    <motion.button
                      key={s.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => loadMessages(s)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition ${
                        selected?.id === s.id ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-slate-800 truncate">
                          {s.business_name || "Chatbot"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(s.last_message_at || s.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px] py-0">{s.total_messages} msgs</Badge>
                        {s.products_shown > 0 && (
                          <Badge variant="outline" className="text-[10px] py-0">{s.products_shown} products</Badge>
                        )}
                        {s.outcome && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${outcomeTone(s.outcome)}`}>{s.outcome}</span>
                        )}
                        {s.sentiment && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${sentimentTone(s.sentiment)}`}>{s.sentiment}</span>
                        )}
                        {s.flagged_for_review && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> flagged
                          </span>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Detail */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm">
                  {selected ? `Session ${selected.session_id.slice(0, 8)}` : "Select a session"}
                </CardTitle>
                {selected && (
                  <CardDescription className="text-xs">
                    Started {new Date(selected.started_at).toLocaleString()}
                    {selected.topics?.length ? ` · Topics: ${selected.topics.join(", ")}` : ""}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {!selected && (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    Click a session on the left to view the transcript.
                  </div>
                )}
                {selected && msgs.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground">No messages logged.</div>
                )}
                {msgs.map(m => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-slate-50 border border-slate-200 text-slate-800"
                      }`}
                      style={{
                        borderRadius: m.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                      }}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      <div className="mt-1 text-[10px] opacity-60 flex gap-2">
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {m.query_intent && <span>· {m.query_intent}</span>}
                        {m.products_shown ? <span>· {m.products_shown} products</span> : null}
                      </div>
                    </div>
                  </div>
                ))}
                {selected?.analysis && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> AI analysis
                    </div>
                    <pre className="text-[11px] text-slate-700 whitespace-pre-wrap font-mono max-h-56 overflow-y-auto">
{JSON.stringify(selected.analysis, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suggestions" className="mt-4 space-y-3">
          {suggestions.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No suggestions yet. Click <b>Generate improvements</b> to analyze recent sessions and propose prompt tweaks.
              </CardContent>
            </Card>
          )}
          {suggestions.map(s => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {s.suggestion_type || "prompt-improvement"}
                    {s.industry ? <span className="ml-2 text-xs font-normal text-muted-foreground">· {s.industry}</span> : null}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        s.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : s.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                      }
                    >
                      {s.status}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Based on {s.sessions_analyzed ?? "—"} sessions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {s.summary && <p className="text-sm text-slate-700">{s.summary}</p>}
                {s.suggestions && (
                  <pre className="text-[11px] bg-slate-50 border rounded p-2 max-h-64 overflow-y-auto whitespace-pre-wrap">
{typeof s.suggestions === "string" ? s.suggestions : JSON.stringify(s.suggestions, null, 2)}
                  </pre>
                )}
                {s.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setSuggestionStatus(s.id, "approved")}>
                      <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSuggestionStatus(s.id, "rejected")}>
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: "emerald" | "rose" }) {
  const toneCls =
    tone === "emerald" ? "text-emerald-600"
    : tone === "rose" ? "text-rose-600"
    : "text-slate-800";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}