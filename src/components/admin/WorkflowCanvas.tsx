import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, Chip } from "@/components/primitives";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Webhook, Save, Brain, Bot, Mail, Send, Zap, Play } from "lucide-react";

type NodeDef = { key: string; label: string; icon: any; step: string; x: number; y: number };

const NODES: NodeDef[] = [
  { key: "webhook",  label: "Webhook",   icon: Webhook, step: "webhook_received", x: 40,  y: 130 },
  { key: "store",    label: "Store",     icon: Save,    step: "stored",           x: 210, y: 130 },
  { key: "classify", label: "Classify",  icon: Brain,   step: "classified",       x: 380, y: 60  },
  { key: "demo",     label: "Demo",      icon: Zap,     step: "demo",             x: 380, y: 200 },
  { key: "reply",    label: "Reply Gen", icon: Bot,     step: "reply_generated",  x: 570, y: 130 },
  { key: "send",     label: "Send",      icon: Send,    step: "sent",             x: 740, y: 130 },
];

const EDGES: [string, string][] = [
  ["webhook", "store"], ["store", "classify"], ["store", "demo"],
  ["classify", "reply"], ["demo", "reply"], ["reply", "send"],
];

type Event = { id: string; step: string; status: string; created_at: string; error: string | null; details: any };

export default function WorkflowCanvas() {
  const [events, setEvents] = useState<Event[]>([]);
  const [active, setActive] = useState<Record<string, "ok" | "failed" | "skipped" | undefined>>({});
  const [selected, setSelected] = useState<NodeDef | null>(null);
  const [replay, setReplay] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("pipeline_events")
      .select("id,step,status,created_at,error,details")
      .order("created_at", { ascending: false })
      .limit(80);
    setEvents((data ?? []) as Event[]);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("wf-canvas")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pipeline_events" }, (p) => {
        const e = p.new as Event;
        setEvents((prev) => [e, ...prev].slice(0, 80));
        setActive((prev) => ({ ...prev, [e.step]: e.status as any }));
        setTimeout(() => setActive((prev) => { const n = { ...prev }; delete n[e.step]; return n; }), 1600);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const runReplay = () => {
    setReplay(true);
    NODES.forEach((n, i) => {
      setTimeout(() => setActive((prev) => ({ ...prev, [n.step]: "ok" })), i * 400);
      setTimeout(() => setActive((prev) => { const x = { ...prev }; delete x[n.step]; return x; }), i * 400 + 1500);
    });
    setTimeout(() => setReplay(false), NODES.length * 400 + 1600);
  };

  const nodeMap = useMemo(() => Object.fromEntries(NODES.map((n) => [n.key, n])), []);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Pipeline"
        title="Workflow"
        description="Live n8n-style view of your inbox pipeline. Nodes glow as events fire."
        actions={<Button size="sm" variant="outline" onClick={runReplay} disabled={replay}><Play className="h-3.5 w-3.5 mr-1" /> Replay</Button>}
      />

      <Card>
        <CardContent className="p-0">
          <div className="relative w-full overflow-x-auto">
            <svg viewBox="0 0 860 300" className="w-full min-w-[860px] h-[300px]">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="hsl(var(--muted-foreground))" />
                </marker>
              </defs>
              {EDGES.map(([a, b], i) => {
                const na = nodeMap[a], nb = nodeMap[b];
                const x1 = na.x + 110, y1 = na.y + 30, x2 = nb.x, y2 = nb.y + 30;
                const glow = active[na.step] === "ok";
                return (
                  <g key={i}>
                    <path d={`M ${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}`}
                      fill="none" stroke={glow ? "hsl(var(--primary))" : "hsl(var(--border))"} strokeWidth={glow ? 2 : 1.5}
                      markerEnd="url(#arrow)" />
                    {glow && (
                      <motion.circle r="4" fill="hsl(var(--primary))"
                        initial={{ offsetDistance: "0%" }} animate={{ offsetDistance: "100%" }}
                        transition={{ duration: 1.1, ease: "easeInOut" }}
                        style={{ offsetPath: `path("M ${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}")` } as any} />
                    )}
                  </g>
                );
              })}
              {NODES.map((n) => {
                const st = active[n.step];
                const tone = st === "failed" ? "danger" : st === "skipped" ? "muted" : st === "ok" ? "success" : "default";
                return (
                  <g key={n.key} transform={`translate(${n.x}, ${n.y})`} className="cursor-pointer" onClick={() => setSelected(n)}>
                    <motion.rect
                      width="110" height="60" rx="10"
                      className={cn(
                        "transition-all",
                        st === "ok" && "drop-shadow-[0_0_12px_hsl(var(--primary)/.55)]",
                        st === "failed" && "drop-shadow-[0_0_12px_hsl(var(--danger)/.55)]",
                      )}
                      fill="hsl(var(--card))"
                      stroke={st === "failed" ? "hsl(var(--danger))" : st === "ok" ? "hsl(var(--primary))" : "hsl(var(--border))"}
                      strokeWidth={st ? 2 : 1}
                      animate={st ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                      transition={{ duration: 0.6 }}
                    />
                    <foreignObject x="8" y="10" width="94" height="40">
                      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                        <n.icon className="h-3.5 w-3.5 text-primary" />
                        <span>{n.label}</span>
                      </div>
                      <div className="mt-1"><Chip tone={tone as any}>{st ?? "idle"}</Chip></div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Execution replay strip */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Recent events</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <AnimatePresence initial={false}>
              {events.slice(0, 30).map((e) => (
                <motion.div key={e.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className={cn(
                    "shrink-0 rounded-md border px-2.5 py-1 text-[11px]",
                    e.status === "failed" && "border-danger/40 bg-danger-soft text-danger",
                    e.status === "ok" && "border-success/30 bg-success-soft text-success",
                    e.status === "skipped" && "text-muted-foreground",
                  )}>
                  {e.step}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      <NodeDrawer node={selected} onClose={() => setSelected(null)} events={events} />
    </div>
  );
}

function NodeDrawer({ node, onClose, events }: { node: NodeDef | null; onClose: () => void; events: Event[] }) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("google/gemini-2.5-flash");
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!node) return;
    setPrompt(""); setTestOutput("");
    supabase.from("node_prompts").select("system_prompt,model").eq("node_name", node.key).maybeSingle()
      .then(({ data }: any) => { if (data) { setPrompt(data.system_prompt ?? ""); setModel(data.model ?? model); } });
  }, [node?.key]);

  if (!node) return null;
  const nodeEvents = events.filter((e) => e.step === node.step).slice(0, 20);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("node_prompts").upsert(
      { node_name: node.key, system_prompt: prompt, model }, { onConflict: "node_name" }
    );
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Prompt saved");
  };

  const runTest = async () => {
    setTesting(true); setTestOutput("");
    try {
      const { data, error } = await supabase.functions.invoke("inbox-classify", { body: { text: testInput, node_key: node.key } });
      if (error) throw error;
      setTestOutput(JSON.stringify(data, null, 2));
    } catch (e: any) { setTestOutput(`Error: ${e.message}`); }
    finally { setTesting(false); }
  };

  return (
    <Sheet open={!!node} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><node.icon className="h-4 w-4 text-primary" /> {node.label}</SheetTitle>
          <SheetDescription>Inspect events, tune the prompt, or run a live test for this node.</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="logs" className="mt-4">
          <TabsList><TabsTrigger value="logs">Logs</TabsTrigger><TabsTrigger value="prompt">Prompt</TabsTrigger><TabsTrigger value="test">Live Test</TabsTrigger></TabsList>
          <TabsContent value="logs" className="space-y-2">
            {nodeEvents.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No recent events.</p>}
            {nodeEvents.map((e) => (
              <div key={e.id} className="rounded border p-2 text-xs">
                <div className="flex items-center justify-between"><Chip tone={e.status === "ok" ? "success" : e.status === "failed" ? "danger" : "muted"}>{e.status}</Chip>
                  <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span></div>
                {e.error && <p className="mt-1 text-danger">{e.error}</p>}
                {e.details && <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[10px]">{JSON.stringify(e.details, null, 2)}</pre>}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="prompt" className="space-y-3">
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" />
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={14} placeholder="System prompt..." className="font-mono text-xs" />
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save prompt"}</Button>
          </TabsContent>
          <TabsContent value="test" className="space-y-3">
            <Textarea value={testInput} onChange={(e) => setTestInput(e.target.value)} rows={5} placeholder="Sample input text..." />
            <Button size="sm" onClick={runTest} disabled={testing}>{testing ? "Running..." : "Run test"}</Button>
            {testOutput && <pre className="max-h-60 overflow-auto rounded border bg-muted p-2 text-[11px] font-mono">{testOutput}</pre>}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}