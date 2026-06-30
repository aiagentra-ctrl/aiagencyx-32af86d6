// Read-only Webhook URL with copy + test buttons.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Send, Loader2, Webhook } from "lucide-react";
import { toast } from "sonner";

export default function WebhookUrlCard() {
  const [url, setUrl] = useState<string>("");
  const [testing, setTesting] = useState(false);
  const [last, setLast] = useState<{ ok: boolean; status?: number; ms?: number } | null>(null);

  useEffect(() => {
    // The publishable client exposes the project URL; the secret query param
    // is intentionally not embedded client-side — the user pastes the URL
    // they were given separately. We still show the function endpoint so they
    // know where to point ManyReach.
    const base = (supabase as any).supabaseUrl || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co`;
    setUrl(`${base.replace(/\/$/, "")}/functions/v1/webhook-manyreach-reply`);
  }, []);

  const copy = () => {
    navigator.clipboard.writeText(url);
    toast.success("Webhook URL copied");
  };

  const runTest = async () => {
    setTesting(true); setLast(null);
    try {
      const { data, error } = await supabase.functions.invoke("inbox-dev-test-webhook", { body: {} });
      if (error) throw error;
      setLast({ ok: !!data?.ok, status: data?.status_code, ms: data?.response_ms });
      toast.success(`Test webhook: ${data?.status_code} in ${data?.response_ms}ms`);
    } catch (e: any) {
      setLast({ ok: false });
      toast.error(`Test failed: ${e.message || e}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Webhook className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-sm">Your Webhook URL</div>
              <div className="text-[11px] text-muted-foreground">
                Paste this into ManyReach → Settings → Webhooks → Reply Webhook
              </div>
            </div>
          </div>
          {last && (
            <Badge variant={last.ok ? "default" : "destructive"} className="h-5 text-[10px]">
              Last test: {last.status || "ERR"}{last.ms != null ? ` · ${last.ms}ms` : ""}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Button size="sm" variant="outline" onClick={copy} aria-label="Copy webhook URL">
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
          </Button>
          <Button size="sm" onClick={runTest} disabled={testing}>
            {testing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Test
          </Button>
        </div>
        <div className="text-[10px] text-muted-foreground">
          Append your <code className="px-1 rounded bg-muted">?key=…</code> secret when pasting into ManyReach.
        </div>
      </CardContent>
    </Card>
  );
}
