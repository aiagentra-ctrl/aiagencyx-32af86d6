import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";

interface IndustryTemplate {
  id: string;
  industry_name: string;
  display_name: string;
  system_prompt_template: string;
  first_message_template: string;
  hero_subtitle_template: string | null;
  chatbot_config: any;
  voice_config: any;
  website_template: any;
  problem_statements: any[];
  chatbot_nav_items: any[];
  floating_bubbles: string[];
  status: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

const emptyTemplate: Partial<IndustryTemplate> = {
  industry_name: "",
  display_name: "",
  system_prompt_template: "",
  first_message_template: "Hi, thank you for calling {business_name}! How can I help you?",
  hero_subtitle_template: "",
  problem_statements: [],
  chatbot_nav_items: [],
  floating_bubbles: [],
  status: "active",
  priority: 0,
};

const TemplatesPanel = () => {
  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IndustryTemplate | null>(null);
  const [form, setForm] = useState<Partial<IndustryTemplate>>(emptyTemplate);
  const [saving, setSaving] = useState(false);

  // JSON text states for array fields
  const [problemsText, setProblemsText] = useState("[]");
  const [navItemsText, setNavItemsText] = useState("[]");
  const [bubblesText, setBubblesText] = useState("[]");
  const [voicePromptText, setVoicePromptText] = useState("");

  const fetchTemplates = async () => {
    const { data } = await supabase.from("industry_templates").select("*").order("priority", { ascending: true }) as any;
    if (data) setTemplates(data);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyTemplate);
    setProblemsText("[]");
    setNavItemsText("[]");
    setBubblesText("[]");
    setVoicePromptText("");
    setDialogOpen(true);
  };

  const openEdit = (t: IndustryTemplate) => {
    setEditing(t);
    setForm(t);
    setProblemsText(JSON.stringify(t.problem_statements || [], null, 2));
    setNavItemsText(JSON.stringify(t.chatbot_nav_items || [], null, 2));
    setBubblesText(JSON.stringify(t.floating_bubbles || [], null, 2));
    setVoicePromptText((t.voice_config as any)?.voice_prompt_template || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.industry_name || !form.display_name) {
      toast({ title: "Industry name and display name are required", variant: "destructive" });
      return;
    }

    let problems: any[], navItems: any[], bubbles: any[];
    try { problems = JSON.parse(problemsText); } catch { toast({ title: "Invalid JSON in problem statements", variant: "destructive" }); return; }
    try { navItems = JSON.parse(navItemsText); } catch { toast({ title: "Invalid JSON in chatbot nav items", variant: "destructive" }); return; }
    try { bubbles = JSON.parse(bubblesText); } catch { toast({ title: "Invalid JSON in floating bubbles", variant: "destructive" }); return; }

    setSaving(true);

    const payload = {
      industry_name: form.industry_name,
      display_name: form.display_name,
      system_prompt_template: form.system_prompt_template || "",
      first_message_template: form.first_message_template || "",
      hero_subtitle_template: form.hero_subtitle_template || null,
      problem_statements: problems,
      chatbot_nav_items: navItems,
      floating_bubbles: bubbles,
      status: form.status || "active",
      priority: form.priority || 0,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      const { error } = await supabase.from("industry_templates").update(payload).eq("id", editing.id) as any;
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Template updated" });
    } else {
      const { error } = await supabase.from("industry_templates").insert(payload) as any;
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Template created" });
    }

    setSaving(false);
    setDialogOpen(false);
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("industry_templates").delete().eq("id", id) as any;
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Template deleted" }); fetchTemplates(); }
  };

  const toggleStatus = async (t: IndustryTemplate) => {
    const newStatus = t.status === "active" ? "inactive" : "active";
    await supabase.from("industry_templates").update({ status: newStatus }).eq("id", t.id) as any;
    fetchTemplates();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Industry Templates</CardTitle>
              <CardDescription>Manage templates for different industries. API auto-selects the right template.</CardDescription>
            </div>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Template
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : templates.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No templates yet. Add one to get started.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Industry</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Priority</TableHead>
                <TableHead className="hidden md:table-cell">Nav Items</TableHead>
                <TableHead className="hidden md:table-cell">Problems</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{t.industry_name}</code></TableCell>
                  <TableCell className="font-medium">{t.display_name}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "active" ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus(t)}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{t.priority}</TableCell>
                  <TableCell className="hidden md:table-cell">{(t.chatbot_nav_items || []).length}</TableCell>
                  <TableCell className="hidden md:table-cell">{(t.problem_statements || []).length}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "Create Template"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Industry Name (key)</Label>
                <Input value={form.industry_name || ""} onChange={(e) => setForm({ ...form, industry_name: e.target.value })} placeholder="e.g. restaurant, salon, clinic" disabled={!!editing} />
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={form.display_name || ""} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="e.g. Restaurant" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input type="number" value={form.priority || 0} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.status === "active"} onCheckedChange={(c) => setForm({ ...form, status: c ? "active" : "inactive" })} />
                <Label>Active</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>System Prompt Template</Label>
              <Textarea rows={5} value={form.system_prompt_template || ""} onChange={(e) => setForm({ ...form, system_prompt_template: e.target.value })} placeholder="Use {business_name}, {calendar_url}, {industry}, {main_service} as variables" />
            </div>

            <div className="space-y-2">
              <Label>First Message Template</Label>
              <Input value={form.first_message_template || ""} onChange={(e) => setForm({ ...form, first_message_template: e.target.value })} placeholder="Hi, thank you for calling {business_name}!" />
            </div>

            <div className="space-y-2">
              <Label>Hero Subtitle Template</Label>
              <Input value={form.hero_subtitle_template || ""} onChange={(e) => setForm({ ...form, hero_subtitle_template: e.target.value })} placeholder="Answers calls, takes orders — 24/7" />
            </div>

            <div className="space-y-2">
              <Label>Problem Statements (JSON array)</Label>
              <Textarea rows={6} value={problemsText} onChange={(e) => setProblemsText(e.target.value)} className="font-mono text-xs" placeholder='[{"title":"...","desc":"...","stat":"67%","statLabel":"..."}]' />
            </div>

            <div className="space-y-2">
              <Label>Chatbot Nav Items (JSON array)</Label>
              <Textarea rows={4} value={navItemsText} onChange={(e) => setNavItemsText(e.target.value)} className="font-mono text-xs" placeholder='[{"label":"Menu","value":"Show me the full menu"}]' />
            </div>

            <div className="space-y-2">
              <Label>Floating Bubbles (JSON array of strings)</Label>
              <Textarea rows={2} value={bubblesText} onChange={(e) => setBubblesText(e.target.value)} className="font-mono text-xs" placeholder='["📞 \"Book a table\"", "💬 \"Get a quote\""]' />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TemplatesPanel;
