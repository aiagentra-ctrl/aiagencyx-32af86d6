import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminKey } from "@/lib/adminData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/primitives";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mailbox, Plus, Server, Trash2, Zap } from "lucide-react";

type Account = {
  id: string;
  name: string;
  use_env_key: boolean;
  api_key_masked: string | null;
  has_key: boolean;
  notes: string | null;
  active: boolean;
  is_default: boolean;
};

type MailboxRoute = {
  id: string;
  label: string;
  email: string;
  manyreach_account_id: string | null;
  account_name: string | null;
  uses_default_account: boolean;
  active: boolean;
};

async function call(fn: string, action: string, params: Record<string, unknown> = {}) {
  const admin_key = getAdminKey();
  const { data, error } = await supabase.functions.invoke(fn, {
    body: { action, params, admin_key },
    headers: admin_key ? { "x-admin-key": admin_key } : undefined,
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

const emptyAccount = { name: "", api_key: "", notes: "", is_default: false };
const emptyMailbox = { label: "", email: "", manyreach_account_id: "", uses_default_account: false };

export default function ManyReachRoutingCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxRoute[]>([]);
  const [envKey, setEnvKey] = useState(false);

  const [accForm, setAccForm] = useState({ ...emptyAccount });
  const [mbForm, setMbForm] = useState({ ...emptyMailbox });
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "account" | "mailbox"; id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, m] = await Promise.all([
        call("manage-manyreach-accounts", "list"),
        call("manage-manyreach-mailboxes", "list"),
      ]);
      setAccounts(a.data ?? []);
      setEnvKey(!!a.env_key_configured);
      setMailboxes(m.data ?? []);
    } catch (e: any) {
      setError(e.message || "Failed to load ManyReach configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); }
    catch (e: any) { toast({ title: "Something went wrong", description: e.message, variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const addAccount = () => run("add-account", async () => {
    if (!accForm.name.trim() || !accForm.api_key.trim()) {
      throw new Error("Give the account a name and an API key.");
    }
    await call("manage-manyreach-accounts", "create", { ...accForm, name: accForm.name.trim(), api_key: accForm.api_key.trim() });
    setAccForm({ ...emptyAccount });
    toast({ title: "Account added" });
    await load();
  });

  const patchAccount = (id: string, params: Record<string, unknown>) =>
    run(`acc-${id}`, async () => {
      await call("manage-manyreach-accounts", "update", { id, ...params });
      await load();
    });

  const testAccount = (a: Account) => run(`test-${a.id}`, async () => {
    const res = await call("manage-manyreach-accounts", "test", { id: a.id });
    const d = res.data;
    toast({
      title: d.ok ? `${a.name} is connected` : `${a.name} failed`,
      description: d.ok ? `ManyReach responded in ${d.ms}ms.` : (d.error || `HTTP ${d.status}`),
      variant: d.ok ? undefined : "destructive",
    });
  });

  const addMailbox = () => run("add-mailbox", async () => {
    if (!mbForm.email.trim()) throw new Error("Enter the mailbox email address.");
    await call("manage-manyreach-mailboxes", "create", { ...mbForm, email: mbForm.email.trim() });
    setMbForm({ ...emptyMailbox });
    toast({ title: "Mailbox routed" });
    await load();
  });

  const patchMailbox = (id: string, params: Record<string, unknown>) =>
    run(`mb-${id}`, async () => {
      await call("manage-manyreach-mailboxes", "update", { id, ...params });
      await load();
    });

  const testMailbox = (m: MailboxRoute) => run(`testmb-${m.id}`, async () => {
    const res = await call("manage-manyreach-mailboxes", "test", { email: m.email });
    const d = res.data;
    toast({
      title: d.ok ? `Routed to ${d.resolved.account_name}` : `Route failed`,
      description: d.ok
        ? `Matched via ${d.resolved.source} · key ${d.resolved.key}`
        : (d.error || `Resolved to ${d.resolved?.account_name} but the ping failed.`),
      variant: d.ok ? undefined : "destructive",
    });
  });

  const doDelete = () => {
    if (!confirm) return;
    const fn = confirm.kind === "account" ? "manage-manyreach-accounts" : "manage-manyreach-mailboxes";
    const target = confirm;
    setConfirm(null);
    run(`del-${target.id}`, async () => {
      await call(fn, "delete", { id: target.id });
      toast({ title: "Deleted" });
      await load();
    });
  };

  if (loading) {
    return <Card><CardContent className="space-y-3 p-6"><Skeleton className="h-6 w-48" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></CardContent></Card>;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState title="Can't load ManyReach settings" description={error} />
          <Button className="mt-4" variant="outline" onClick={load}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" /> ManyReach accounts</CardTitle>
          <CardDescription>
            Every outbound reply and follow-up is sent through one of these accounts.
            {envKey ? " The legacy environment key is configured and stays available as a fallback." : " No environment key is configured — add an account below."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 ? (
            <EmptyState title="No accounts yet" description="Add your first ManyReach account to start sending." />
          ) : (
            <div className="divide-y rounded-md border">
              {accounts.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{a.name}</p>
                      {a.is_default && <Badge variant="secondary">Default</Badge>}
                      <Badge variant={a.active ? "default" : "outline"}>{a.active ? "Active" : "Inactive"}</Badge>
                      {!a.has_key && <Badge variant="destructive">No key</Badge>}
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{a.api_key_masked || "no key stored"}</p>
                    {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={a.active}
                      disabled={busy === `acc-${a.id}`}
                      onCheckedChange={(v) => patchAccount(a.id, { active: v })}
                    />
                    {!a.is_default && (
                      <Button size="sm" variant="ghost" disabled={busy === `acc-${a.id}`} onClick={() => patchAccount(a.id, { is_default: true })}>
                        Make default
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={busy === `test-${a.id}`} onClick={() => testAccount(a)}>
                      {busy === `test-${a.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                      <span className="ml-1.5">Test</span>
                    </Button>
                    <Button
                      size="icon" variant="ghost" aria-label={`Delete ${a.name}`}
                      disabled={a.is_default || busy === `del-${a.id}`}
                      onClick={() => setConfirm({ kind: "account", id: a.id, name: a.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3 rounded-md border border-dashed p-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mr-acc-name">Account name</Label>
              <Input id="mr-acc-name" placeholder="Account 2" value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mr-acc-key">API key</Label>
              <Input id="mr-acc-key" type="password" placeholder="mr_live_…" value={accForm.api_key} onChange={(e) => setAccForm({ ...accForm, api_key: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mr-acc-notes">Notes (optional)</Label>
              <Input id="mr-acc-notes" placeholder="Which team or domain uses this account" value={accForm.notes} onChange={(e) => setAccForm({ ...accForm, notes: e.target.value })} />
            </div>
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={accForm.is_default} onCheckedChange={(v) => setAccForm({ ...accForm, is_default: v })} />
                Make this the default account
              </label>
              <Button onClick={addAccount} disabled={busy === "add-account"}>
                {busy === "add-account" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="ml-1.5">Add account</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">Keys are stored on the backend and masked after saving.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Mailbox className="h-4 w-4" /> Mailbox routing</CardTitle>
          <CardDescription>Map each sending mailbox to an account. Unmapped mailboxes use the default account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mailboxes.length === 0 ? (
            <EmptyState title="No mailbox routes" description="Every send currently uses the default account." />
          ) : (
            <div className="divide-y rounded-md border">
              {mailboxes.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{m.email}</p>
                      <Badge variant={m.active ? "default" : "outline"}>{m.active ? "Active" : "Inactive"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.label ? `${m.label} · ` : ""}
                      {m.uses_default_account ? "Uses default account" : (m.account_name || "No account assigned")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={m.active} disabled={busy === `mb-${m.id}`} onCheckedChange={(v) => patchMailbox(m.id, { active: v })} />
                    <Button size="sm" variant="outline" disabled={busy === `testmb-${m.id}`} onClick={() => testMailbox(m)}>
                      {busy === `testmb-${m.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                      <span className="ml-1.5">Test</span>
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${m.email}`} onClick={() => setConfirm({ kind: "mailbox", id: m.id, name: m.email })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3 rounded-md border border-dashed p-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mr-mb-email">Mailbox email</Label>
              <Input id="mr-mb-email" placeholder="sales@yourdomain.com" value={mbForm.email} onChange={(e) => setMbForm({ ...mbForm, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mr-mb-label">Label (optional)</Label>
              <Input id="mr-mb-label" placeholder="Outbound sales" value={mbForm.label} onChange={(e) => setMbForm({ ...mbForm, label: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Send through</Label>
              <Select
                value={mbForm.uses_default_account ? "__default__" : (mbForm.manyreach_account_id || "")}
                onValueChange={(v) => setMbForm({
                  ...mbForm,
                  uses_default_account: v === "__default__",
                  manyreach_account_id: v === "__default__" ? "" : v,
                })}
              >
                <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default account</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}{a.active ? "" : " (inactive)"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={addMailbox} disabled={busy === "add-mailbox"}>
                {busy === "add-mailbox" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span className="ml-1.5">Add mailbox</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirm?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. {confirm?.kind === "account"
                ? "Mailboxes pointing at this account will fall back to the default account."
                : "Sends from this mailbox will fall back to the default account."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
