import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = { name: string; configured: boolean };

export default function WebhookSecretsCard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("get-secret-status", { body: {} });
      setRows((data as any)?.status || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Configured Secrets</CardTitle>
            <CardDescription>Names only — values are never displayed.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center justify-between rounded-md border px-3 py-2">
              <code className="text-xs">{r.name}</code>
              {r.configured ? (
                <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Configured</Badge>
              ) : (
                <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Missing</Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}