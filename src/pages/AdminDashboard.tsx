import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Check, Pencil, Bot, Trash2, Activity, Cog, Zap, Code, BarChart3, Layers, Lock, UserCheck, Mail, Database, Inbox } from "lucide-react";
import EditPageDialog from "@/components/admin/EditPageDialog";
import AnalyticsPanel from "@/components/admin/AnalyticsPanel";
import EditChatbotDialog from "@/components/admin/EditChatbotDialog";
import SiteSettingsPanel from "@/components/admin/SiteSettingsPanel";
import ActivityLogViewer from "@/components/admin/ActivityLogViewer";
import { Link } from "react-router-dom";
import TemplatesPanel from "@/components/admin/TemplatesPanel";
import LeadsPanel from "@/components/admin/LeadsPanel";
import TrackingPage from "@/components/admin/TrackingPage";
import FollowUpTemplatesPanel from "@/components/admin/FollowUpTemplatesPanel";
import KnowledgeBasePanel from "@/components/admin/KnowledgeBasePanel";
import InboxManagerPanel from "@/components/admin/InboxManagerPanel";
import ConversationsPage from "@/components/admin/ConversationsPage";
import FollowUpsPage from "@/components/admin/FollowUpsPage";
import DashboardHome from "@/components/admin/DashboardHome";
import LogsPage from "@/components/admin/LogsPage";
import SettingsPage from "@/components/admin/SettingsPage";
import HealthPage from "@/components/admin/HealthPage";
import WorkflowCanvas from "@/components/admin/WorkflowCanvas";
import { Input } from "@/components/ui/input";
import { ShellProvider, useShell } from "@/components/shell/ShellContext";
import { AppShell } from "@/components/shell/AppShell";
import { setAdminKey, clearAdminKey, getAdminKey } from "@/lib/adminData";



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
    // A stale session without an admin key can't read anything — force re-login.
    return sessionStorage.getItem("admin_auth") === "true" && !!getAdminKey();
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
      // The admin key unlocks the service-role `admin-data` read layer.
      setAdminKey(loginPassword);
      setLoginError("");
    } else {
      setLoginError("Invalid email or password");
    }
  };


  if (!isAuthenticated) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4"
      >
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
      </motion.div>
    );
  }

  return (
    <ShellProvider initialSection="home">
      <AppShell onSignOut={() => { sessionStorage.removeItem("admin_auth"); clearAdminKey(); setIsAuthenticated(false); }}>
        <AdminSections
          pages={pages}
          chatbots={chatbots}
          loading={loading}
          copiedId={copiedId}
          copyLink={copyLink}
          getDemoUrl={getDemoUrl}
          getChatbotUrl={getChatbotUrl}
          setEditPage={setEditPage}
          setEditOpen={setEditOpen}
          setEditChatbot={setEditChatbot}
          setEditChatbotOpen={setEditChatbotOpen}
          handleDeleteChatbot={handleDeleteChatbot}
        />
      </AppShell>
      <EditPageDialog page={editPage} open={editOpen} onOpenChange={setEditOpen} onUpdated={fetchData} />
      <EditChatbotDialog chatbot={editChatbot} open={editChatbotOpen} onOpenChange={setEditChatbotOpen} onUpdated={fetchData} />
    </ShellProvider>
  );
};

/**
 * AdminSections renders the tab content for whichever section the shell says is active.
 * We keep <Tabs> (controlled) so the existing TabsContent panels render exactly as before,
 * but the TabsList is hidden — the sidebar is now the primary nav.
 */
function AdminSections(props: {
  pages: DemoPage[];
  chatbots: Chatbot[];
  loading: boolean;
  copiedId: string | null;
  copyLink: (url: string, id: string) => void;
  getDemoUrl: (slug: string) => string;
  getChatbotUrl: (slug: string) => string;
  setEditPage: (p: DemoPage) => void;
  setEditOpen: (v: boolean) => void;
  setEditChatbot: (c: Chatbot) => void;
  setEditChatbotOpen: (v: boolean) => void;
  handleDeleteChatbot: (id: string) => void;
}) {
  const { section, setSection } = useShell();
  const {
    pages, chatbots, loading, copiedId, copyLink,
    getDemoUrl, getChatbotUrl, setEditPage, setEditOpen,
    setEditChatbot, setEditChatbotOpen, handleDeleteChatbot,
  } = props;
  return (
    <Tabs value={section} onValueChange={setSection} className="space-y-6">
      <TabsList className="sr-only">
        <TabsTrigger value="home">Home</TabsTrigger>
        <TabsTrigger value="demos">Demos</TabsTrigger>
        <TabsTrigger value="workflow">Workflow</TabsTrigger>
        <TabsTrigger value="health">Health</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="leads">Leads</TabsTrigger>
        <TabsTrigger value="tracking">Tracking</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="followups">Follow-Ups</TabsTrigger>
        <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
        <TabsTrigger value="inbox">Inbox</TabsTrigger>
        <TabsTrigger value="conversations">Conversations</TabsTrigger>
        <TabsTrigger value="sequences">Sequences</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
      </TabsList>


          {/* Home Tab */}
          <TabsContent value="home">
            <DashboardHome />
          </TabsContent>

          {/* Demos Tab — shows both pages and chatbots */}
          <TabsContent value="demos" className="space-y-6">
            {/* API Quick Reference */}
            <Card className="transition-all duration-300 hover:shadow-xl hover:border-primary/40">
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
            <Card className="transition-all duration-300 hover:shadow-xl">
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
                        <TableRow key={page.id} className="transition-colors hover:bg-muted/40">
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
              <Card className="transition-all duration-300 hover:shadow-xl">
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
                        <TableRow key={bot.id} className="transition-colors hover:bg-muted/40">
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
            <SettingsPage />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <AnalyticsPanel />
          </TabsContent>

          {/* Leads Tab */}
          <TabsContent value="tracking">
            <TrackingPage />
          </TabsContent>

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

          {/* Inbox Manager Tab */}
          <TabsContent value="inbox">
            <InboxManagerPanel />
          </TabsContent>

          {/* Conversations (Chat monitoring) */}
          <TabsContent value="conversations">
            <ConversationsPage />
          </TabsContent>

          {/* Follow-up Sequences Tab */}
          <TabsContent value="sequences">
            <FollowUpsPage />
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <LogsPage />
          </TabsContent>

          {/* Workflow Tab */}
          <TabsContent value="workflow">
            <WorkflowCanvas />
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health">
            <HealthPage />
          </TabsContent>

          {/* Settings override */}
    </Tabs>
  );
}

export default AdminDashboard;

