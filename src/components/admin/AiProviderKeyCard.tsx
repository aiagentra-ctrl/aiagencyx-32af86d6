import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminData";
import { KeyRound, ShieldCheck, Loader2 } from "lucide-react";

type KeyStatus = {
  openrouter: { configured: boolean; masked: string | null; updated_at: string | null; source: string };
  lovable_fallback: boolean;
};

/**
 * Owner-managed OpenRouter key. When it runs dry the chatbot silently falls back
 * to the Lovable AI Gateway, so a dead key can no longer 503 a live demo.
 */
export default function AiProviderKeyCard() {
  const { toast } = useToast();
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [credit, setCredit] = useState<string | null>(null);

  const load = async () => {
    try { setStatus(await adminFetch<KeyStatus>("ai_keys")); } catch { /* unauthenticated */ }
  };
  useEffect(() => { load(); }, []);

  const test = async () => {
    setBusy("test"); setCredit(null);
    try {
      const r = await adminFetch<any>("test_openrouter_key", value.trim() ? { api_key: value.trim() } : {});
      if (!r.ok) { toast({ title: "Key check failed", description: r.error, variant: "destructive" }); return; }
      const remaining = r.limit_remaining;
      setCredit(remaining === null || remaining === undefined
        ? `Valid${r.label ? ` — ${r.label}` : ""}. No hard credit limit reported.`
        : `Valid${r.label ? ` — ${r.label}` : ""}. Remaining credit: $${Number(remaining).toFixed(2)}`);
      toast({ title: "Key is valid" });
    } finally { setBusy(null); }
  };

  const save = async () => {
    setBusy("save");
    try {
      const r = await adminFetch<any>("save_openrouter_key", { api_key: value.trim() });
      if (!r.ok) { toast({ title: "Not saved", description: r.error, variant: "destructive" }); return; }
      setValue("");
      await load();
      toast({ title: r.cleared ? "Key removed" : "Key saved", description: r.cleared ? "Falling back to the deployment secret." : "New chats use this key immediately." });
    } finally { setBusy(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> AI provider keys</CardTitle>
        <CardDescription>OpenRouter powers chat replies. If it fails or runs out of credit, the Lovable AI gateway answers instead.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">OpenRouter:</span>
          {status?.openrouter.configured
            ? <Badge variant="secondary">{status.openrouter.masked}</Badge>
            : <Badge variant="outline">using {status?.openrouter.source ?? "…"}</Badge>}
          {status?.lovable_fallback && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Lovable AI fallback active
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="password"
            placeholder="sk-or-v1-…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={test} disabled={busy !== null}>
              {busy === "test" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Test
            </Button>
            <Button onClick={save} disabled={busy !== null}>
              {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </Button>
          </div>
        </div>

        {credit && <p className="text-xs text-muted-foreground">{credit}</p>}
        <p className="text-xs text-muted-foreground">
          Leave the field empty and press Save to remove the stored key. The key is never shown again after saving.
        </p>
      </CardContent>
    </Card>
  );
}
