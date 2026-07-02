import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SiteSettingsPanel from "./SiteSettingsPanel";
import VariableFallbacksPanel from "./followup/VariableFallbacksPanel";
import { SectionHeader } from "@/components/primitives";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useShell } from "@/components/shell/ShellContext";
import { Key } from "lucide-react";
import { useEffect, useState } from "react";

const KEYS = {
  hot: "notif_hot_lead",
  reply: "notif_reply",
  error: "notif_error",
  digest: "notif_daily_digest",
};

function NotificationToggles() {
  const [state, setState] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const s: Record<string, boolean> = {};
    Object.values(KEYS).forEach((k) => { s[k] = localStorage.getItem(k) !== "false"; });
    setState(s);
  }, []);
  const toggle = (k: string) => {
    const next = { ...state, [k]: !state[k] };
    setState(next);
    localStorage.setItem(k, String(next[k]));
  };
  const items = [
    { k: KEYS.hot, label: "Hot lead detected", desc: "Ping me when a prospect opens their demo 3+ times." },
    { k: KEYS.reply, label: "New prospect reply", desc: "Notify me when a lead replies to the inbox." },
    { k: KEYS.error, label: "Pipeline errors", desc: "Alert me on webhook or edge function failures." },
    { k: KEYS.digest, label: "Daily digest", desc: "Summary email of activity once per day." },
  ];
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Notifications</CardTitle>
        <CardDescription>Choose which events raise a bell.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {items.map((i) => (
          <div key={i.k} className="flex items-center justify-between gap-4 py-3">
            <div><p className="text-sm font-medium">{i.label}</p><p className="text-xs text-muted-foreground">{i.desc}</p></div>
            <Switch checked={!!state[i.k]} onCheckedChange={() => toggle(i.k)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ApiKeysShortcut() {
  const { setSection } = useShell();
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> API keys & credentials</CardTitle>
        <CardDescription>Manage webhook URL, secrets and integrations from the Logs → Credentials tab.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setSection("logs")}>Open credentials</Button>
      </CardContent>
    </Card>
  );
}

function SequenceGlobalRules() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Global sequence rules</CardTitle>
        <CardDescription>Applies to every follow-up sequence unless overridden.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="rounded-md border p-3">Max sends per prospect per day: <strong>2</strong></div>
        <div className="rounded-md border p-3">Quiet hours (prospect local time): <strong>20:00 – 08:00</strong></div>
        <div className="rounded-md border p-3">Auto-pause on hot lead detection: <strong>Enabled</strong></div>
        <div className="rounded-md border p-3">Cancel on reply: <strong>Enabled</strong></div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Workspace" title="Settings" description="General configuration, variable fallbacks and notification preferences." />
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="bg-surface-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
          <TabsTrigger value="sequences">Sequences</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
        </TabsList>
        <TabsContent value="general"><SiteSettingsPanel /></TabsContent>
        <TabsContent value="variables"><VariableFallbacksPanel /></TabsContent>
        <TabsContent value="sequences"><SequenceGlobalRules /></TabsContent>
        <TabsContent value="notifications"><NotificationToggles /></TabsContent>
        <TabsContent value="keys"><ApiKeysShortcut /></TabsContent>
      </Tabs>
    </div>
  );
}