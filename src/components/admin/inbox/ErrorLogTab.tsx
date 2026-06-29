// Error Log: failures-only feed.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertCircle, ChevronDown, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type Err = {
  id: string; source: string; message: string; stack: string | null;
  message_id: string | null; prospect_id: string | null;
  acknowledged: boolean; created_at: string;
};

export default function ErrorLogTab({ onJump }: { onJump?: (prospectId: string) => void }) {
  const [rows, setRows] = useState<Err[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unack">("unack");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("error_events")
      .select("*").order("created_at", { ascending: false }).limit(200);
    setRows((data as Err[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("error-events-tab")
      .on("postgres_changes", { event: "*", schema: "public", table: "error_events" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const ack = async (id: string) => {
    const { error } = await supabase.from("error_events").update({ acknowledged: true }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Acknowledged");
  };

  const filtered = filter === "unack" ? rows.filter((r) => !r.acknowledged) : rows;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-500" /> Error Log</div>
            <div className="text-xs text-muted-foreground">Live feed of pipeline failures. Click an entry to jump to its conversation.</div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={filter === "unack" ? "default" : "outline"} onClick={() => setFilter("unack")}>Unacknowledged</Button>
            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
          </div>
        </div>

        <ScrollArea className="h-[500px]">
          {loading ? (
            <div className="space-y-2">{Array.from({length: 4}).map((_, i) => <div key={i} className="h-12 rounded bg-muted/40 animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No errors 🎉</div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((r) => (
                <li key={r.id}>
                  <Collapsible>
                    <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-muted/40 text-left border border-red-500/30 bg-red-500/5">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                        <Badge variant="outline" className="h-4 text-[10px] capitalize">{r.source}</Badge>
                        <span className="text-xs truncate">{r.message}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {r.acknowledged && <Badge variant="secondary" className="h-4 text-[10px]">ack</Badge>}
                        <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                        <ChevronDown className="h-3 w-3" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-2 space-y-2">
                        {r.stack && (
                          <pre className="text-[10px] bg-muted/60 rounded p-2 overflow-auto max-h-48">{r.stack}</pre>
                        )}
                        <div className="flex gap-2">
                          {r.prospect_id && onJump && (
                            <Button size="sm" variant="outline" onClick={() => onJump(r.prospect_id!)}>
                              <ArrowRight className="mr-1 h-3 w-3" /> Jump to conversation
                            </Button>
                          )}
                          {!r.acknowledged && (
                            <Button size="sm" variant="ghost" onClick={() => ack(r.id)}>
                              <Check className="mr-1 h-3 w-3" /> Acknowledge
                            </Button>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
