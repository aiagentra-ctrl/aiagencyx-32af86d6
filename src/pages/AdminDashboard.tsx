import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Check, Code, Pencil, Eye } from "lucide-react";
import CreatePageDialog from "@/components/admin/CreatePageDialog";
import EditPageDialog from "@/components/admin/EditPageDialog";

interface DemoPage {
  id: string;
  slug: string;
  assistant_id: string;
  business_name: string;
  description: string | null;
  vapi_key: string;
  views: number;
  created_at: string;
  client_name: string | null;
  company_name: string | null;
  industry: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  calendly_url: string | null;
  cta_text: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  custom_subdomain: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const API_URL = `${SUPABASE_URL}/functions/v1/create-demo-page`;

const AdminDashboard = () => {
  const [pages, setPages] = useState<DemoPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editPage, setEditPage] = useState<DemoPage | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const fetchPages = async () => {
    const { data, error } = await supabase
      .from("demo_pages")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPages(data as unknown as DemoPage[]);
    if (error) console.error("Error fetching pages:", error);
    setLoading(false);
  };

  useEffect(() => { fetchPages(); }, []);

  const getDemoUrl = (slug: string) => `${window.location.origin}/demo/${slug}`;

  const copyLink = (slug: string, id: string) => {
    navigator.clipboard.writeText(getDemoUrl(slug));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Link copied!" });
  };

  const handleEdit = (page: DemoPage) => {
    setEditPage(page);
    setEditOpen(true);
  };

  const examplePayload = `{
  "assistantId": "your-assistant-id",
  "businessName": "Business Name",
  "clientName": "John",
  "companyName": "ABC Dental",
  "industry": "Healthcare",
  "description": "AI assistant for your business",
  "vapiKey": "your-vapi-key",
  "calendlyUrl": "https://calendly.com/you",
  "contactEmail": "email@example.com",
  "contactPhone": "+1234567890",
  "customSubdomain": "clientname"
}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-card-foreground">AI Voice Demo Pages</h1>
          <CreatePageDialog onCreated={fetchPages} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {/* API Integration */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">API Integration</CardTitle>
            </div>
            <CardDescription>Use this endpoint to create demo pages programmatically (e.g. from n8n).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Endpoint</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono text-foreground">POST {API_URL}</code>
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(API_URL); toast({ title: "API URL copied!" }); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Example Payload</Label>
                <pre className="mt-1 rounded-md bg-muted p-3 text-xs font-mono text-foreground overflow-x-auto">{examplePayload}</pre>
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
                    <TableHead>Business</TableHead>
                    <TableHead className="hidden md:table-cell">Client</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="hidden lg:table-cell">Industry</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{page.business_name}</span>
                          {page.company_name && <span className="ml-1 text-xs text-muted-foreground">({page.company_name})</span>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {page.client_name || "—"}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{page.slug}</code>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {page.industry || "—"}
                      </TableCell>
                      <TableCell className="text-right">{page.views}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {new Date(page.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(page)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => copyLink(page.slug, page.id)} title="Copy link">
                            {copiedId === page.id ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" asChild title="Preview">
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

      <EditPageDialog page={editPage} open={editOpen} onOpenChange={setEditOpen} onUpdated={fetchPages} />
    </div>
  );
};

export default AdminDashboard;
