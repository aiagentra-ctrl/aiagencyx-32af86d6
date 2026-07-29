// Webhook endpoint registry — create, copy, regenerate, test, disable, delete.
// URLs are clean and direct: {SUPABASE_URL}/functions/v1/hook/<token>
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Copy, Loader2, Plus, RefreshCw, Send, Trash2, Power, Webhook, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface Endpoint {
  id: string;
  label: string;
  token: string;
  provider: string;
  active: boolean;
  hit_count: number;
  last_used_at: string | null;
  last_status: number | null;
  url: string;
}

type Confirm = { kind: "regenerate" | "delete"; ep: Endpoint } | null;

const relative = (iso: string | null) => {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function WebhookEndpointsCard() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [tests, setTests] = useState<Record<string, { ok: boolean; status?: number; ms?: number }>>({});

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("manage-webhook-endpoints", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await call({ action: "list" });
      setEndpoints(data.endpoints ?? []);
    } catch (e: any) {
      toast.error(`Could not load webhooks: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => { void load(); }, [load]);

  const run = async (id: string, body: Record<string, unknown>, msg: string) => {
    setBusy(id);
    try {
      await call(body);
      await load();
      toast.success(msg);
    } catch (e: any) {
      toast.error(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      await call({ action: "create", label: newLabel.trim() || "New webhook" });
      setNewLabel("");
      await load();
      toast.success("Webhook created — copy the URL into your provider");
    } catch (e: any) {
      toast.error(e.message || String(e));
    } finally {
      setCreating(false);
    }
  };

  const test = async (ep: Endpoint) => {
    setBusy(ep.id);
    try {
      const data = await call({ action: "test", id: ep.id });
      setTests((t) => ({ ...t, [ep.id]: { ok: !!data.ok, status: data.status_code, ms: data.response_ms } }));
      if (data.ok) toast.success(`Delivered · ${data.status_code} in ${data.response_ms}ms`);
      else toast.error(`Test failed · ${data.status_code}`);
      await load();
    } catch (e: any) {
      setTests((t) => ({ ...t, [ep.id]: { ok: false } }));
      toast.error(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Webhook className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">Webhook endpoints</CardTitle>
            <CardDescription>
              Clean, direct URLs. Paste one into ManyReach → Settings → Webhooks → Reply Webhook.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading endpoints…
          </div>
        ) : endpoints.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No webhooks yet — create one below.
          </p>
        ) : (
          <div className="space-y-3">
            {endpoints.map((ep) => {
              const t = tests[ep.id];
              return (
                <div
                  key={ep.id}
                  className="rounded-lg border bg-surface-1 p-3 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{ep.label}</span>
                    <Badge variant={ep.active ? "default" : "secondary"} className="h-5 text-[10px]">
                      {ep.active ? "Active" : "Disabled"}
                    </Badge>
                    <Badge variant="outline" className="h-5 text-[10px] capitalize">{ep.provider}</Badge>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {ep.hit_count} deliveries · last {relative(ep.last_used_at)}
                      {ep.last_status ? ` · ${ep.last_status}` : ""}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Input
                      readOnly
                      value={ep.url}
                      className="min-w-[16rem] flex-1 font-mono text-xs"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { navigator.clipboard.writeText(ep.url); toast.success("Webhook URL copied"); }}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                    </Button>
                    <Button size="sm" onClick={() => test(ep)} disabled={busy === ep.id || !ep.active}>
                      {busy === ep.id
                        ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        : <Send className="mr-1.5 h-3.5 w-3.5" />}
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Regenerate token"
                      onClick={() => setConfirm({ kind: "regenerate", ep })}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={ep.active ? "Disable" : "Enable"}
                      onClick={() => run(ep.id, { action: "toggle", id: ep.id }, ep.active ? "Webhook disabled" : "Webhook enabled")}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Delete"
                      onClick={() => setConfirm({ kind: "delete", ep })}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>

                  {t && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CheckCircle2 className={`h-3.5 w-3.5 ${t.ok ? "text-success" : "text-destructive"}`} />
                      Last test: {t.status ?? "error"}{t.ms != null ? ` · ${t.ms}ms` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 border-t pt-3">
          <Input
            placeholder="Label (e.g. ManyReach — Reply)"
            value={newLabel}
            maxLength={80}
            onChange={(e) => setNewLabel(e.target.value)}
            className="text-sm"
          />
          <Button size="sm" onClick={create} disabled={creating}>
            {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            New webhook
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          A <code className="font-mono">GET</code> on any of these URLs returns a health response, so providers
          that validate the URL before saving will succeed. <code className="font-mono">POST</code> accepts JSON,
          form-encoded and raw bodies, plus query parameters and custom headers.
        </p>
      </CardContent>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "delete" ? "Delete this webhook?" : "Regenerate the URL?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "delete"
                ? `"${confirm?.ep.label}" will stop accepting deliveries immediately and cannot be restored.`
                : `A brand-new URL is issued for "${confirm?.ep.label}". The current URL stops working right away — update it in your provider afterwards.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                const { kind, ep } = confirm;
                setConfirm(null);
                void run(
                  ep.id,
                  { action: kind === "delete" ? "delete" : "regenerate", id: ep.id },
                  kind === "delete" ? "Webhook deleted" : "New URL generated — copy it into your provider",
                );
              }}
            >
              {confirm?.kind === "delete" ? "Delete" : "Regenerate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
