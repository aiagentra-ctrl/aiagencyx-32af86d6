import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Check, Pencil, Bot, Trash2, Activity, Cog, Zap, Code, BarChart3, Layers, Lock, UserCheck, Mail } from "lucide-react";
import EditPageDialog from "@/components/admin/EditPageDialog";
import AnalyticsPanel from "@/components/admin/AnalyticsPanel";
import EditChatbotDialog from "@/components/admin/EditChatbotDialog";
import SiteSettingsPanel from "@/components/admin/SiteSettingsPanel";
import ActivityLogViewer from "@/components/admin/ActivityLogViewer";
import { Link } from "react-router-dom";
import TemplatesPanel from "@/components/admin/TemplatesPanel";
import LeadsPanel from "@/components/admin/LeadsPanel";
import FollowUpTemplatesPanel from "@/components/admin/FollowUpTemplatesPanel";
import { Input } from "@/components/ui/input";

const ADMIN_EMAIL = "aiagentron@gmail.com";
const ADMIN_PASSWORD = "Abhiraj@123";

interface DemoPage {
  id: string;
  slug: string;
  assistant_id: string;
  business_name: string;
  views: number;
  created_at: string;
  client_name: string | null;
  company_name: string | null;
  calendly_url: string | null;
  cta_text: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  industry: string | null;
  description: string | null;
  vapi_key: string;
  custom_subdomain: string | null;
}

interface Chatbot {
  id: string;
  business_name: string;
  website_url: string | null;
  slug: string;
  status: string;
  industry: string | null;
  ai_provider: string;
  ai_model: string;
  created_at: string;
  system_prompt: string;
  api_key_encrypted: string | null;
  brand_tone: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("admin_auth") === "true";
  });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [pages, setPages] = useState<DemoPage[]>([]);
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editPage, setEditPage] = useState<DemoPage | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editChatbot, setEditChatbot] = useState<Chatbot | null>(null);
  const [editChatbotOpen, setEditChatbotOpen] = useState(false);

  const fetchData = async () => {
    const [pagesRes, chatbotsRes] = await Promise.all([
      supabase.from("demo_pages").select("*").order("created_at", { ascending: false }),
      supabase.from("chatbots").select("*").order("created_at", { ascending: false }),
    ]);
    if (pagesRes.data) setPages(pagesRes.data as unknown as DemoPage[]);
    if (chatbotsRes.data) setChatbots(chatbotsRes.data as unknown as Chatbot[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getDemoUrl = (slug: string) => `${window.location.origin}/${slug}`;
  const getChatbotUrl = (slug: string) => `${window.location.origin}/chatbot/${slug}`;

  const copyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Link copied!" });
  };

  const handleDeleteChatbot = async (id: string) => {
    const { error } = await supabase.from("chatbots").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Chatbot deleted" }); fetchData(); }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginEmail === ADMIN_EMAIL && loginPassword === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem("admin_auth", "true");
      setLoginError("");
    } else {
      setLoginError("Invalid email or password");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Admin Login</CardTitle>
            <CardDescription>Enter your credentials to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="admin@example.com" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              {loginError && <p className="text-sm text-destructive">{loginError}</p>}
              <Button type="submit" className="w-full">Sign In</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-card-foreground">AI Agency Dashboard</h1>
          <Link to="/api-docs">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Code className="h-3.5 w-3.5" /> API Docs
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Tabs defaultValue="demos" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="demos">
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              Demos
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Cog className="mr-1.5 h-3.5 w-3.5" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="leads">
              <UserCheck className="mr-1.5 h-3.5 w-3.5" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="templates">
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="followups">
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Follow-Ups
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Activity className="mr-1.5 h-3.5 w-3.5" />
              Logs
            </TabsTrigger>
          </TabsList>

          {/* Demos Tab — shows both pages and chatbots */}
          <TabsContent value="demos" className="space-y-6">
            {/* API Quick Reference */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Create Demo (Single API)</CardTitle>
                </div>
                <CardDescription>One call creates voice agent + chatbot + demo website.</CardDescription>
              </CardHeader>
              <CardContent>
                <code className="block rounded-md bg-muted px-3 py-2 text-sm font-mono text-foreground">
                  POST {SUPABASE_URL}/functions/v1/create-demo
                </code>
                <pre className="mt-2 rounded-md bg-muted p-3 text-xs font-mono text-foreground">{`{
  "business_name": "Mario's Pizza",
  "website_url": "https://mariospizza.com",
  "calendar_link": "https://calendly.com/your-link",
  "industry": "restaurant"  // optional — auto-detected if omitted
}`}</pre>
                <p className="mt-2 text-xs text-muted-foreground">
                  Returns: <code className="bg-muted px-1 rounded">{`{ "demo_url": "..." }`}</code> — that's it.
                </p>
              </CardContent>
            </Card>

            {/* Demo Pages Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generated Demos</CardTitle>
                <CardDescription>{pages.length} demo{pages.length !== 1 ? "s" : ""} • {chatbots.length} chatbot{chatbots.length !== 1 ? "s" : ""}</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                ) : pages.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">No demos yet. Use the API to create one.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="hidden md:table-cell">Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pages.map((page) => (
                        <TableRow key={page.id}>
                          <TableCell className="font-medium">{page.business_name}</TableCell>
                          <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{page.slug}</code></TableCell>
                          <TableCell className="text-right">{page.views}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{new Date(page.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => { setEditPage(page); setEditOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => copyLink(getDemoUrl(page.slug), page.id)}>
                                {copiedId === page.id ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" asChild><a href={getDemoUrl(page.slug)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Chatbots Table */}
            {chatbots.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Linked Chatbots</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead className="hidden md:table-cell">Industry</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chatbots.map((bot) => (
                        <TableRow key={bot.id}>
                          <TableCell className="font-medium">{bot.business_name}</TableCell>
                          <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{bot.slug}</code></TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{bot.industry || "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => { setEditChatbot(bot); setEditChatbotOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => copyLink(getChatbotUrl(bot.slug), `bot-${bot.id}`)}>
                                {copiedId === `bot-${bot.id}` ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" asChild><a href={getChatbotUrl(bot.slug)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteChatbot(bot.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <SiteSettingsPanel />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <AnalyticsPanel />
          </TabsContent>

          {/* Leads Tab */}
          <TabsContent value="leads">
            <LeadsPanel />
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <TemplatesPanel />
          </TabsContent>

          {/* Follow-Up Templates Tab */}
          <TabsContent value="followups">
            <FollowUpTemplatesPanel />
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <ActivityLogViewer />
          </TabsContent>
        </Tabs>
      </main>

      <EditPageDialog page={editPage} open={editOpen} onOpenChange={setEditOpen} onUpdated={fetchData} />
      <EditChatbotDialog chatbot={editChatbot} open={editChatbotOpen} onOpenChange={setEditChatbotOpen} onUpdated={fetchData} />
    </div>
  );
};

export default AdminDashboard;
