// Webhook Logs tab: every webhook hit + Test Webhook button.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, X, ChevronDown, Send, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import WebhookUrlCard from "./WebhookUrlCard";
import WebhookSecretsCard from "./WebhookSecretsCard";

type Log = {
  id: string; endpoint: string; method: string;
  status: "success" | "failed"; status_code: number | null;
  response_ms: number | null; payload: any; response: any;
  error: string | null; source: string | null; created_at: string;
};

export default function WebhookLogsTab() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("webhook_logs")
      .select("*").order("created_at", { ascending: false }).limit(100);
    setLogs((data as Log[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("webhook-logs")
      .on("postgres_changes", { event: "*", schema: "public", table: "webhook_logs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const runTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("inbox-dev-test-webhook", { body: {} });
      if (error) throw error;
      setTestResult(data);
      toast.success(`Test webhook: ${data?.status_code} in ${data?.response_ms}ms`);
    } catch (e: any) {
      toast.error(`Test failed: ${e.message || e}`);
      setTestResult({ error: String(e?.message || e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <WebhookUrlCard />
      <WebhookSecretsCard />
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold">Webhook Logs</div>
            <div className="text-xs text-muted-foreground">Every hit on the ManyReach reply webhook. Live updates.</div>
          </div>
          <Button size="sm" onClick={runTest} disabled={testing}>
            {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
            Send Test Webhook
          </Button>
        </div>

        {testResult && (
          <div className="rounded-md border bg-muted/30 p-3 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold flex items-center gap-2">
                Last Test Result
                <Badge variant={testResult.ok ? "default" : "destructive"} className="h-4 text-[10px]">
                  {testResult.status_code || "ERR"} · {testResult.response_ms ?? "?"}ms
                </Badge>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6"
                onClick={() => { navigator.clipboard.writeText(JSON.stringify(testResult, null, 2)); toast.success("Copied"); }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <pre className="text-[10px] overflow-auto max-h-48 leading-relaxed">{JSON.stringify(testResult, null, 2)}</pre>
          </div>
        )}

        <ScrollArea className="h-[480px]">
          {loading ? (
            <div className="space-y-2">{Array.from({length: 5}).map((_, i) => <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />)}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No webhook hits yet.</div>
          ) : (
            <ul className="space-y-1">
              {logs.map((l) => (
                <li key={l.id}>
                  <Collapsible>
                    <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-muted/40 text-left border">
                      <div className="flex items-center gap-2 min-w-0">
                        {l.status === "success" ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-red-500" />}
                        <span className="font-mono text-xs truncate">{l.endpoint}</span>
                        <Badge variant="outline" className="h-4 text-[10px]">{l.status_code || "—"}</Badge>
                        <Badge variant="outline" className="h-4 text-[10px]">{l.response_ms ?? "?"}ms</Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid md:grid-cols-2 gap-2 p-2">
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground mb-1">Payload</div>
                          <pre className="text-[10px] bg-muted/60 rounded p-2 overflow-auto max-h-64">{JSON.stringify(l.payload, null, 2)}</pre>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground mb-1">Response</div>
                          <pre className="text-[10px] bg-muted/60 rounded p-2 overflow-auto max-h-64">{JSON.stringify(l.response, null, 2)}</pre>
                        </div>
                        {l.error && (
                          <div className="md:col-span-2 text-[11px] text-red-500 bg-red-500/10 rounded p-2">{l.error}</div>
                        )}
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
    </div>
  );
}
