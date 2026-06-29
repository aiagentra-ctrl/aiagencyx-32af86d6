// Reply Templates editor — 6 slots: (Positive|Negative|Objection) × (pre_demo|post_demo)
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import SmartReplyEditor, { SmartReplyEditorHandle } from "./SmartReplyEditor";

type Tpl = {
  id: string; classification: string; phase: "pre_demo" | "post_demo";
  body: string; locked_vars: string[];
};

const ALL_VARS = ["firstname", "company", "sender_name", "sender_email", "demo_url"];

export default function ReplyTemplatesTab() {
  const [rows, setRows] = useState<Tpl[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const editorRefs = useRef<Record<string, SmartReplyEditorHandle | null>>({});

  useEffect(() => {
    supabase.from("reply_templates").select("*")
      .order("phase").order("classification")
      .then(({ data }) => setRows((data as Tpl[]) || []));
  }, []);

  const save = async (t: Tpl) => {
    setSaving(t.id);
    const body = editorRefs.current[t.id]?.getValue() ?? t.body;
    const { error } = await supabase.from("reply_templates").update({ body }).eq("id", t.id);
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success(`Saved ${t.classification} · ${t.phase.replace("_", "-")}`);
  };

  const render = (phase: "pre_demo" | "post_demo") => (
    <div className="space-y-4">
      {rows.filter((r) => r.phase === phase).map((t) => (
        <Card key={t.id} className="animate-fade-in">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={t.classification === "Positive" ? "default" : t.classification === "Negative" ? "destructive" : "secondary"}>
                  {t.classification}
                </Badge>
                <Badge variant="outline" className="text-[10px]">{t.phase.replace("_", "-")}</Badge>
              </div>
              <Button size="sm" disabled={saving === t.id} onClick={() => save(t)}>
                {saving === t.id ? "Saving…" : "Save"}
              </Button>
            </div>
            <SmartReplyEditor
              ref={(el) => { editorRefs.current[t.id] = el; }}
              variables={ALL_VARS}
              initial={t.body}
            />
            <div className="text-[10px] text-muted-foreground">
              Locked variables: {t.locked_vars.map((v) => `{{${v}}}`).join(", ")}
            </div>
          </CardContent>
        </Card>
      ))}
      {!rows.filter((r) => r.phase === phase).length && (
        <div className="text-center py-8 text-sm text-muted-foreground">Loading…</div>
      )}
    </div>
  );

  return (
    <Tabs defaultValue="pre_demo" className="space-y-3">
      <TabsList>
        <TabsTrigger value="pre_demo">Pre-Demo (first reply)</TabsTrigger>
        <TabsTrigger value="post_demo">Post-Demo (link already sent)</TabsTrigger>
      </TabsList>
      <TabsContent value="pre_demo">{render("pre_demo")}</TabsContent>
      <TabsContent value="post_demo">{render("post_demo")}</TabsContent>
    </Tabs>
  );
}
