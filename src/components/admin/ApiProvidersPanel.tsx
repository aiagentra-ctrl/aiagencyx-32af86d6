import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

interface ApiProvider {
  id: string;
  name: string;
  provider_type: string;
  api_key: string;
  endpoint_url: string | null;
  model: string | null;
  priority: number;
  is_enabled: boolean;
  category: string;
  created_at: string;
}

const ApiProvidersPanel = () => {
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    provider_type: "openai",
    api_key: "",
    endpoint_url: "",
    model: "",
    category: "llm",
  });

  const fetchProviders = async () => {
    const { data } = await supabase
      .from("api_providers")
      .select("*")
      .order("category", { ascending: true })
      .order("priority", { ascending: true });
    if (data) setProviders(data as unknown as ApiProvider[]);
    setLoading(false);
  };

  useEffect(() => { fetchProviders(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.api_key) {
      toast({ title: "Name and API Key are required", variant: "destructive" });
      return;
    }
    const maxPriority = providers.filter((p) => p.category === form.category).length;
    const { error } = await supabase.from("api_providers").insert({
      name: form.name,
      provider_type: form.provider_type,
      api_key: form.api_key,
      endpoint_url: form.endpoint_url || null,
      model: form.model || null,
      priority: maxPriority,
      category: form.category,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Provider added!" });
      setAddOpen(false);
      setForm({ name: "", provider_type: "openai", api_key: "", endpoint_url: "", model: "", category: "llm" });
      fetchProviders();
    }
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    await supabase.from("api_providers").update({ is_enabled: enabled }).eq("id", id);
    fetchProviders();
  };

  const deleteProvider = async (id: string) => {
    await supabase.from("api_providers").delete().eq("id", id);
    toast({ title: "Deleted" });
    fetchProviders();
  };

  const changePriority = async (id: string, direction: "up" | "down") => {
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;
    const sameCategory = providers.filter((p) => p.category === provider.category);
    const idx = sameCategory.findIndex((p) => p.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameCategory.length) return;

    await supabase.from("api_providers").update({ priority: sameCategory[swapIdx].priority }).eq("id", id);
    await supabase.from("api_providers").update({ priority: provider.priority }).eq("id", sameCategory[swapIdx].id);
    fetchProviders();
  };

  const llmProviders = providers.filter((p) => p.category === "llm");
  const firecrawlProviders = providers.filter((p) => p.category === "firecrawl");

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Provider</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add API Provider</DialogTitle>
              <DialogDescription>Add a backup AI or scraping API key for failover.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llm">LLM (AI Model)</SelectItem>
                    <SelectItem value="firecrawl">Firecrawl (Scraping)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. OpenRouter Backup" />
              </div>
              {form.category === "llm" && (
                <div>
                  <Label>Provider Type</Label>
                  <Select value={form.provider_type} onValueChange={(v) => setForm((f) => ({ ...f, provider_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="openrouter">OpenRouter</SelectItem>
                      <SelectItem value="custom">Custom Endpoint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>API Key</Label>
                <Input type="password" value={form.api_key} onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))} placeholder="sk-..." />
              </div>
              {form.category === "llm" && (
                <>
                  <div>
                    <Label>Model</Label>
                    <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="e.g. gpt-4, meta-llama/llama-3-70b" />
                  </div>
                  {form.provider_type === "custom" && (
                    <div>
                      <Label>Endpoint URL</Label>
                      <Input value={form.endpoint_url} onChange={(e) => setForm((f) => ({ ...f, endpoint_url: e.target.value }))} placeholder="https://api.custom.com/v1/chat/completions" />
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleAdd}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* LLM Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">LLM Providers (Failover Chain)</CardTitle>
          <CardDescription>
            Lovable AI is always used first. These providers are tried in priority order as fallbacks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {llmProviders.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No custom LLM providers. Lovable AI is used as the sole provider.</p>
          ) : (
            <ProviderTable
              providers={llmProviders}
              onToggle={toggleEnabled}
              onDelete={deleteProvider}
              onPriority={changePriority}
              showModel
            />
          )}
        </CardContent>
      </Card>

      {/* Firecrawl Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Firecrawl Accounts (Rotation)</CardTitle>
          <CardDescription>
            Default connected Firecrawl key is used first. Additional keys rotate when credits are exhausted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {firecrawlProviders.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No extra Firecrawl accounts. Using the default connected key.</p>
          ) : (
            <ProviderTable
              providers={firecrawlProviders}
              onToggle={toggleEnabled}
              onDelete={deleteProvider}
              onPriority={changePriority}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function ProviderTable({
  providers,
  onToggle,
  onDelete,
  onPriority,
  showModel,
}: {
  providers: ApiProvider[];
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onPriority: (id: string, dir: "up" | "down") => void;
  showModel?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="hidden md:table-cell">Type</TableHead>
          {showModel && <TableHead className="hidden lg:table-cell">Model</TableHead>}
          <TableHead>Enabled</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {providers.map((p, i) => (
          <TableRow key={p.id}>
            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
            <TableCell className="font-medium">{p.name}</TableCell>
            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.provider_type}</TableCell>
            {showModel && <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{p.model || "—"}</TableCell>}
            <TableCell>
              <Switch checked={p.is_enabled} onCheckedChange={(v) => onToggle(p.id, v)} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => onPriority(p.id, "up")} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => onPriority(p.id, "down")} disabled={i === providers.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default ApiProvidersPanel;
