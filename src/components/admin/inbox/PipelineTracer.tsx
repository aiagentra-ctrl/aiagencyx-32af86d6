// Per-message pipeline tracer: webhook → stored → classified → demo → reply → sent
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Check, X, MinusCircle, ChevronDown, Loader2 } from "lucide-react";

type Event = {
  id: string; step: string; status: "ok" | "skipped" | "failed";
  details: any; error: string | null; created_at: string;
};

const STEPS = [
  { key: "webhook_received", label: "Webhook" },
  { key: "stored", label: "Stored" },
  { key: "classified", label: "Classified" },
  { key: "demo", label: "Demo" },
  { key: "reply_generated", label: "Reply" },
  { key: "sent", label: "Sent" },
];

const statusIcon = (s?: string) => {
  if (s === "ok") return <Check className="h-3 w-3 text-emerald-500" />;
  if (s === "failed") return <X className="h-3 w-3 text-red-500" />;
  if (s === "skipped") return <MinusCircle className="h-3 w-3 text-muted-foreground" />;
  return <Loader2 className="h-3 w-3 text-muted-foreground animate-spin opacity-50" />;
};

export default function PipelineTracer({ messageId, prospectId }: { messageId?: string | null; prospectId?: string | null }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!messageId && !prospectId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      let q = supabase.from("pipeline_events").select("*").order("created_at", { ascending: true });
      if (messageId) q = q.eq("message_id", messageId);
      else if (prospectId) q = q.eq("prospect_id", prospectId);
      const { data } = await q;
      if (!cancelled) { setEvents((data as Event[]) || []); setLoading(false); }
    };
    load();
    const ch = supabase
      .channel(`tracer-${messageId || prospectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_events" }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [messageId, prospectId]);

  const byStep: Record<string, Event | undefined> = {};
  for (const e of events) byStep[e.step] = e;

  return (
    <div className="rounded-lg border bg-card/40 p-3 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Pipeline Tracer</div>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {STEPS.map((s, i) => {
          const e = byStep[s.key];
          const failed = e?.status === "failed";
          return (
            <div key={s.key} className="flex items-center gap-1.5">
              <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border ${
                failed ? "border-red-500/50 bg-red-500/10 animate-pulse" :
                e?.status === "ok" ? "border-emerald-500/40 bg-emerald-500/5" :
                e?.status === "skipped" ? "border-muted bg-muted/40 text-muted-foreground" :
                "border-dashed border-muted-foreground/30 text-muted-foreground"
              }`}>
                {statusIcon(e?.status)}
                <span className="font-medium">{s.label}</span>
                {e && <span className="opacity-60">{new Date(e.created_at).toLocaleTimeString()}</span>}
              </div>
              {i < STEPS.length - 1 && <span className="text-muted-foreground/40 text-xs">→</span>}
            </div>
          );
        })}
      </div>
      <div className="space-y-1">
        {events.map((e) => (
          <Collapsible key={e.id}>
            <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-muted/40 text-left">
              <div className="flex items-center gap-2 text-xs">
                {statusIcon(e.status)}
                <span className="font-mono">{e.step}</span>
                <Badge variant="outline" className="h-4 text-[10px]">{e.status}</Badge>
                {e.error && <span className="text-red-500 truncate max-w-xs">{e.error}</span>}
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="text-[10px] bg-muted/60 rounded p-2 mt-1 overflow-auto max-h-64 leading-relaxed">
                {JSON.stringify({ details: e.details, error: e.error, at: e.created_at }, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        ))}
        {!events.length && !loading && (
          <div className="text-xs text-muted-foreground italic px-2">No pipeline events yet for this message.</div>
        )}
      </div>
    </div>
  );
}
