import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Plus, Check, Code } from "lucide-react";

interface DemoPage {
  id: string;
  slug: string;
  assistant_id: string;
  business_name: string;
  description: string | null;
  vapi_key: string;
  views: number;
  created_at: string;
}

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const API_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/create-demo-page`;

const AdminDashboard = () => {
  const [pages, setPages] = useState<DemoPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [vapiKey, setVapiKey] = useState("");

  const fetchPages = async () => {
    const { data, error } = await supabase
      .from("demo_pages")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setPages(data);
    if (error) console.error("Error fetching pages:", error);
    setLoading(false);
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const handleCreate = async () => {
    if (!businessName || !assistantId || !vapiKey) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setCreating(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantId,
          businessName,
          description,
          vapiKey,
        }),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Failed to create demo page");

      toast({ title: "Demo page created!", description: result.url });
      setDialogOpen(false);
      setBusinessName("");
      setDescription("");
      setAssistantId("");
      setVapiKey("");
      fetchPages();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const getDemoUrl = (slug: string) => {
    return `${window.location.origin}/demo/${slug}`;
  };

  const copyLink = (slug: string, id: string) => {
    navigator.clipboard.writeText(getDemoUrl(slug));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Link copied!" });
  };

  const examplePayload = `{
  "assistantId": "your-assistant-id",
  "businessName": "Business Name",
  "description": "AI assistant for your business",
  "vapiKey": "your-vapi-key"
}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-card-foreground">AI Voice Demo Pages</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Demo Page
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Demo Page</DialogTitle>
                <DialogDescription>Fill in the details to create a new AI voice demo page.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Denat Clinic" />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. AI assistant for Denat Clinic" />
                </div>
                <div>
                  <Label htmlFor="assistantId">Assistant ID *</Label>
                  <Input id="assistantId" value={assistantId} onChange={(e) => setAssistantId(e.target.value)} placeholder="Vapi Assistant ID" />
                </div>
                <div>
                  <Label htmlFor="vapiKey">Vapi Key *</Label>
                  <Input id="vapiKey" value={vapiKey} onChange={(e) => setVapiKey(e.target.value)} placeholder="Vapi Public Key" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {/* API Integration Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">API Integration</CardTitle>
            </div>
            <CardDescription>Use this endpoint to create demo pages programmatically (e.g., from n8n).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Endpoint</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono text-foreground">
                    POST {API_URL}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(API_URL);
                      toast({ title: "API URL copied!" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Example Payload</Label>
                <pre className="mt-1 rounded-md bg-muted p-3 text-xs font-mono text-foreground overflow-x-auto">
                  {examplePayload}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Demo Pages Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Demo Pages</CardTitle>
            <CardDescription>{pages.length} page{pages.length !== 1 ? "s" : ""} created</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : pages.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No demo pages yet. Create your first one!</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="hidden md:table-cell">Assistant ID</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className="font-medium">{page.business_name}</TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{page.slug}</code>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <code className="text-xs text-muted-foreground">{page.assistant_id.slice(0, 12)}...</code>
                      </TableCell>
                      <TableCell className="text-right">{page.views}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {new Date(page.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => copyLink(page.slug, page.id)}>
                            {copiedId === page.id ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <a href={getDemoUrl(page.slug)} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminDashboard;
