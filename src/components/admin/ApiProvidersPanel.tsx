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
import { Plus, Trash2, ArrowUp, ArrowDown, CheckCircle, XCircle, Loader2 } from "lucide-react";

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

const DEFAULT_MODELS: Record<string, string> = {
  openrouter: "openai/gpt-4o-mini-search-preview",
  openai: "gpt-4o-mini",
};

const PROVIDER_LABELS: Record<string, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  custom: "Custom Endpoint",
};

const ApiProvidersPanel = () => {
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    provider_type: "openrouter",
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

  // Auto-fill name when provider type changes
  const updateProviderType = (type: string) => {
    const count = providers.filter(p => p.provider_type === type && p.category === form.category).length;
    const label = PROVIDER_LABELS[type] || type;
    setForm(f => ({
      ...f,
      provider_type: type,
      name: f.name || `${label}${count > 0 ? ` ${count + 1}` : ""}`,
      model: DEFAULT_MODELS[type] || "",
    }));
  };

  const updateCategory = (cat: string) => {
    setForm(f => ({
      ...f,
      category: cat,
      name: cat === "firecrawl" ? `Firecrawl Account ${providers.filter(p => p.category === "firecrawl").length + 1}` : "",
      provider_type: cat === "firecrawl" ? "firecrawl" : "openrouter",
      model: cat === "firecrawl" ? "" : DEFAULT_MODELS["openrouter"] || "",
    }));
  };

  const validateApiKey = async (): Promise<boolean> => {
    setValidating(true);
    try {
      if (form.category === "firecrawl") {
        // Test Firecrawl key with a lightweight request
        const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${form.api_key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://example.com", formats: ["markdown"], onlyMainContent: true }),
        });
        if (res.status === 401) { toast({ title: "Invalid Firecrawl API key", variant: "destructive" }); return false; }
        if (res.status === 402) { toast({ title: "⚠️ Firecrawl key valid but credits exhausted", description: "Added anyway — will be used when topped up." }); return true; }
        if (res.ok || res.status === 429) return true;
        toast({ title: "Firecrawl validation failed", description: `Status: ${res.status}`, variant: "destructive" });
        return false;
      }

      // Validate LLM key
      let url: string;
      switch (form.provider_type) {
        case "openai": url = "https://api.openai.com/v1/models"; break;
        case "openrouter": url = "https://openrouter.ai/api/v1/models"; break;
        default: return true; // Skip validation for custom endpoints
      }
      const res = await fetch(url, { headers: { Authorization: `Bearer ${form.api_key}` } });
      if (res.status === 401) { toast({ title: "Invalid API key", variant: "destructive" }); return false; }
      if (res.ok || res.status === 429) return true;
      toast({ title: "API key validation failed", description: `Status: ${res.status}`, variant: "destructive" });
      return false;
    } catch (err) {
      toast({ title: "Validation error", description: "Could not reach API. Key saved anyway.", variant: "destructive" });
      return true; // Allow saving even if validation network fails
    } finally {
      setValidating(false);
    }
  };

  const handleAdd = async () => {
    if (!form.api_key) {
      toast({ title: "API Key is required", variant: "destructive" });
      return;
    }

    // Auto-fill name if empty
    const name = form.name || (form.category === "firecrawl"
      ? `Firecrawl Account ${providers.filter(p => p.category === "firecrawl").length + 1}`
      : `${PROVIDER_LABELS[form.provider_type] || form.provider_type} Key`);

    const isValid = await validateApiKey();
    if (!isValid) return;

    const maxPriority = providers.filter(p => p.category === form.category).length;
    const { error } = await supabase.from("api_providers").insert({
      name,
      provider_type: form.provider_type,
      api_key: form.api_key,
      endpoint_url: form.endpoint_url || null,
      model: form.model || null,
      priority: maxPriority,
      category: form.category,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "✅ Provider added!", description: `${name} is ready for failover.` });
      setAddOpen(false);
      setForm({ name: "", provider_type: "openrouter", api_key: "", endpoint_url: "", model: "", category: "llm" });
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
    const provider = providers.find(p => p.id === id);
    if (!provider) return;
    const sameCategory = providers.filter(p => p.category === provider.category);
    const idx = sameCategory.findIndex(p => p.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameCategory.length) return;

    await supabase.from("api_providers").update({ priority: sameCategory[swapIdx].priority }).eq("id", id);
    await supabase.from("api_providers").update({ priority: provider.priority }).eq("id", sameCategory[swapIdx].id);
    fetchProviders();
  };

  const llmProviders = providers.filter(p => p.category === "llm");
  const firecrawlProviders = providers.filter(p => p.category === "firecrawl");

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add API Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add API Key</DialogTitle>
              <DialogDescription>Just paste your API key — everything else is auto-configured.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Type</Label>
                <Select value={form.category} onValueChange={updateCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llm">🤖 AI Model (LLM)</SelectItem>
                    <SelectItem value="firecrawl">🔥 Firecrawl (Scraping)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.category === "llm" && (
                <div>
                  <Label>Provider</Label>
                  <Select value={form.provider_type} onValueChange={updateProviderType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openrouter">OpenRouter (Recommended)</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="custom">Custom Endpoint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={form.api_key}
                  onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                  placeholder={form.category === "firecrawl" ? "fc-..." : "sk-or-..."}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {form.category === "firecrawl"
                    ? "Get your key from firecrawl.dev/app/api-keys"
                    : form.provider_type === "openrouter"
                      ? "Get your key from openrouter.ai/keys"
                      : "Get your key from platform.openai.com/api-keys"}
                </p>
              </div>

              {form.category === "llm" && (
                <div>
                  <Label>Model <span className="text-muted-foreground text-xs">(auto-filled)</span></Label>
                  <Input
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                    placeholder="e.g. openai/gpt-4o-mini-search-preview"
                  />
                </div>
              )}

              {form.category === "llm" && form.provider_type === "custom" && (
                <div>
                  <Label>Endpoint URL</Label>
                  <Input
                    value={form.endpoint_url}
                    onChange={e => setForm(f => ({ ...f, endpoint_url: e.target.value }))}
                    placeholder="https://api.custom.com/v1/chat/completions"
                  />
                </div>
              )}

              <div>
                <Label>Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Auto-generated if empty"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAdd} disabled={validating}>
                {validating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validating...</>
                ) : (
                  "Add & Validate"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* LLM Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🤖 AI Providers (Failover Chain)</CardTitle>
          <CardDescription>
            Lovable AI is used first. These providers are tried in order as fallbacks when credits are exhausted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {llmProviders.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No custom AI providers. Lovable AI is the sole provider.</p>
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
          <CardTitle className="text-lg">🔥 Firecrawl Accounts (Auto-Rotation)</CardTitle>
          <CardDescription>
            Default connected key is used first. When credits run out, the next account is used automatically.
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
  providers, onToggle, onDelete, onPriority, showModel,
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
            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{PROVIDER_LABELS[p.provider_type] || p.provider_type}</TableCell>
            {showModel && <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{p.model || "—"}</TableCell>}
            <TableCell>
              <Switch checked={p.is_enabled} onCheckedChange={v => onToggle(p.id, v)} />
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
