// Manage default fallback values for template variables (avoids "Hi ," on missing firstname).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save, Plus, Trash2 } from "lucide-react";

type Fallback = { id: string; variable_key: string; fallback_value: string; description: string | null };

export default function VariableFallbacksPanel() {
  const [rows, setRows] = useState<Fallback[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [newKey, setNewKey] = useState(""); const [newVal, setNewVal] = useState("");

  const load = async () => {
    const { data } = await supabase.from("variable_fallbacks").select("*").order("variable_key");
    setRows((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const save = async (r: Fallback) => {
    setSaving(r.id);
    const { error } = await supabase.from("variable_fallbacks")
      .update({ fallback_value: r.fallback_value, description: r.description }).eq("id", r.id);
    setSaving(null);
    if (error) toast.error(error.message); else toast.success(`Saved {{${r.variable_key}}}`);
  };
  const add = async () => {
    if (!newKey.trim()) return;
    const { error } = await supabase.from("variable_fallbacks").insert({ variable_key: newKey.trim(), fallback_value: newVal });
    if (error) toast.error(error.message);
    else { setNewKey(""); setNewVal(""); load(); }
  };
  const remove = async (id: string) => {
    await supabase.from("variable_fallbacks").delete().eq("id", id);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Variable Fallbacks</CardTitle>
        <CardDescription>
          If a prospect is missing a field, these values replace <code>{"{{variable}}"}</code> before sending — so nobody ever gets "Hi ,".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-[180px_1fr_1fr_auto] gap-2 text-[11px] font-semibold text-muted-foreground px-1">
          <div>Variable</div><div>Fallback value</div><div>Description</div><div></div>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[180px_1fr_1fr_auto] gap-2 items-center">
            <code className="text-xs bg-muted rounded px-2 py-1.5">{`{{${r.variable_key}}}`}</code>
            <Input value={r.fallback_value}
              onChange={(e) => setRows(rows.map((x) => x.id === r.id ? { ...x, fallback_value: e.target.value } : x))} />
            <Input value={r.description || ""} placeholder="optional"
              onChange={(e) => setRows(rows.map((x) => x.id === r.id ? { ...x, description: e.target.value } : x))} />
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" disabled={saving === r.id} onClick={() => save(r)}><Save className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[180px_1fr_1fr_auto] gap-2 pt-3 border-t items-center">
          <Input placeholder="new_variable" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <Input placeholder="Fallback value" value={newVal} onChange={(e) => setNewVal(e.target.value)} />
          <div />
          <Button size="sm" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
        </div>
      </CardContent>
    </Card>
  );
}