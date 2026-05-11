import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Mail, Save } from "lucide-react";

type Condition = "not_tried" | "tried_voice_agent" | "tried_chatbot";

interface Template {
  id?: string;
  condition: Condition;
  subject: string;
  body: string;
}

const VARIABLES = [
  "FirstName", "Company", "CampaignName", "Industry",
  "LeadSource", "DemoURL", "VisitorCountry",
];

const SAMPLE: Record<string, string> = {
  FirstName: "John",
  Company: "Acme Corp",
  CampaignName: "Q3 Outreach",
  Industry: "Real Estate",
  LeadSource: "cold-email",
  DemoURL: "https://demo.example.com/abc123",
  VisitorCountry: "United States",
};

const CONDITIONS: { key: Condition; label: string; desc: string }[] = [
  { key: "not_tried", label: "Did Not Try Demo", desc: "Visitor opened the page but didn't interact." },
  { key: "tried_voice_agent", label: "Tried Voice Agent", desc: "Visitor interacted with the AI Voice Agent." },
  { key: "tried_chatbot", label: "Tried AI Chatbot", desc: "Visitor interacted with the AI Chatbot." },
];

const inject = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => SAMPLE[k] ?? `{${k}}`);

const FollowUpTemplatesPanel = () => {
  const [templates, setTemplates] = useState<Record<Condition, Template>>({
    not_tried: { condition: "not_tried", subject: "", body: "" },
    tried_voice_agent: { condition: "tried_voice_agent", subject: "", body: "" },
    tried_chatbot: { condition: "tried_chatbot", subject: "", body: "" },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Condition | null>(null);
  const [active, setActive] = useState<Condition>("not_tried");
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const lastFocused = useRef<"body" | "subject">("body");

  const fetchAll = async () => {
    const { data } = await supabase.from("follow_up_templates" as any).select("*");
    if (data) {
      const next = { ...templates };
      for (const row of data as any[]) {
        if (row.condition in next) next[row.condition as Condition] = row;
      }
      setTemplates(next);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);

  const current = templates[active];

  const update = (patch: Partial<Template>) => {
    setTemplates({ ...templates, [active]: { ...current, ...patch } });
  };

  const insertVar = (name: string) => {
    const token = `{${name}}`;
    if (lastFocused.current === "subject") {
      const el = subjectRef.current; if (!el) return;
      const s = el.selectionStart ?? current.subject.length;
      const e = el.selectionEnd ?? s;
      const next = current.subject.slice(0, s) + token + current.subject.slice(e);
      update({ subject: next });
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length); });
    } else {
      const el = bodyRef.current; if (!el) return;
      const s = el.selectionStart ?? current.body.length;
      const e = el.selectionEnd ?? s;
      const next = current.body.slice(0, s) + token + current.body.slice(e);
      update({ body: next });
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length); });
    }
  };

  const save = async () => {
    setSaving(active);
    const payload = {
      condition: active,
      subject: current.subject,
      body: current.body,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("follow_up_templates" as any).upsert(payload, { onConflict: "condition" });
    setSaving(null);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Template saved" }); fetchAll(); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-lg">Follow-Up Templates</CardTitle>
            <CardDescription>Customize the email sent after a visitor opens a demo, based on what they did.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : (
          <Tabs value={active} onValueChange={(v) => setActive(v as Condition)}>
            <TabsList className="flex-wrap">
              {CONDITIONS.map(c => <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>)}
            </TabsList>

            {CONDITIONS.map(c => (
              <TabsContent key={c.key} value={c.key} className="space-y-4 pt-4">
                <p className="text-xs text-muted-foreground">{c.desc}</p>

                <div className="space-y-2">
                  <Label>Subject Line</Label>
                  <Input
                    ref={subjectRef}
                    value={templates[c.key].subject}
                    onFocus={() => (lastFocused.current = "subject")}
                    onChange={(e) => setTemplates({ ...templates, [c.key]: { ...templates[c.key], subject: e.target.value } })}
                    placeholder="e.g. Quick follow-up for {Company}"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Available Variables (click to insert)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLES.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVar(v)}
                        className="rounded-md border bg-muted px-2 py-1 text-xs font-mono hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        {`{${v}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Message Body (HTML supported)</Label>
                    <Textarea
                      ref={bodyRef}
                      rows={16}
                      className="font-mono text-xs"
                      value={templates[c.key].body}
                      onFocus={() => (lastFocused.current = "body")}
                      onChange={(e) => setTemplates({ ...templates, [c.key]: { ...templates[c.key], body: e.target.value } })}
                      placeholder="<p>Hi {FirstName},</p>..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Live Preview (with sample data)</Label>
                    <div className="rounded-md border bg-card p-4 min-h-[16rem]">
                      <div className="border-b pb-2 mb-3 text-sm">
                        <span className="text-muted-foreground">Subject: </span>
                        <span className="font-medium">{inject(templates[c.key].subject) || <em className="text-muted-foreground">No subject</em>}</span>
                      </div>
                      <div
                        className="prose prose-sm max-w-none text-sm text-foreground [&_a]:text-primary"
                        dangerouslySetInnerHTML={{ __html: inject(templates[c.key].body) || "<em class='text-muted-foreground'>No body</em>" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={save} disabled={saving === c.key} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    {saving === c.key ? "Saving..." : "Save Template"}
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default FollowUpTemplatesPanel;
