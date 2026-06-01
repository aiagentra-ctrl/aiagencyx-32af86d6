import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Database, RefreshCw, Loader2, Trash2, Sparkles } from "lucide-react";

interface Chatbot { id: string; business_name: string; website_url: string | null; kb_chatbot_md?: string | null; kb_voice_text?: string | null; prompt_core?: any; industry?: string | null; store_platform?: string | null; product_count?: number; }
interface Job { id: string; chatbot_id: string; status: string; pages_scraped: number; entries_created: number; error: string | null; created_at: string; completed_at: string | null; }
interface Product { id: string; name: string; description: string | null; price: number | null; currency: string | null; image_url: string | null; product_url: string | null; category: string | null; }

const KnowledgeBasePanel = () => {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [entryCount, setEntryCount] = useState<number>(0);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);

  const fetchAll = async () => {
    const { data: cbs } = await supabase.from("chatbots").select("id,business_name,website_url,kb_chatbot_md,kb_voice_text,prompt_core").order("created_at", { ascending: false });
    setChatbots((cbs as Chatbot[]) || []);
    if (cbs && cbs.length > 0 && !selected) setSelected(cbs[0].id);
  };

  const refresh = async (chatbotId: string) => {
    if (!chatbotId) return;
    setLoading(true);
    const [{ count }, { data: jobsData }, { data: cbRow }] = await Promise.all([
      supabase.from("knowledge_base_entries").select("*", { count: "exact", head: true }).eq("chatbot_id", chatbotId),
      supabase.from("knowledge_base_jobs").select("*").eq("chatbot_id", chatbotId).order("created_at", { ascending: false }).limit(5),
      supabase.from("chatbots").select("id,business_name,website_url,kb_chatbot_md,kb_voice_text,prompt_core").eq("id", chatbotId).maybeSingle(),
    ]);
    setEntryCount(count || 0);
    setJobs((jobsData as Job[]) || []);
    if (cbRow) {
      setChatbots((prev) => prev.map((c) => (c.id === chatbotId ? { ...c, ...(cbRow as Chatbot) } : c)));
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { if (selected) refresh(selected); }, [selected]);

  const handleBuild = async () => {
    const cb = chatbots.find((c) => c.id === selected);
    if (!cb) return;
    if (!cb.website_url) {
      toast({ title: "No website URL", description: "This chatbot has no website to scrape.", variant: "destructive" });
      return;
    }
    setBuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke("build-knowledge-base", {
        body: { chatbotId: cb.id, websiteUrl: cb.website_url },
      });
      if (error) throw error;
      toast({ title: "Knowledge base build started", description: `Job ${data.jobId} queued.` });
      setTimeout(() => refresh(cb.id), 2000);
    } catch (e: any) {
      toast({ title: "Build failed", description: e.message, variant: "destructive" });
    } finally { setBuilding(false); }
  };

  const handleClear = async () => {
    if (!selected || !confirm("Delete all knowledge base entries for this chatbot?")) return;
    await supabase.from("knowledge_base_entries").delete().eq("chatbot_id", selected);
    refresh(selected);
    toast({ title: "Knowledge base cleared" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Knowledge Base</CardTitle>
          <CardDescription>
            Scrape a chatbot's website with Firecrawl, embed the content, and store it in a vector knowledge base.
            The chatbot will dynamically retrieve relevant context for every user message.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Chatbot</label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select chatbot...</option>
                {chatbots.map((c) => (
                  <option key={c.id} value={c.id}>{c.business_name}{c.website_url ? "" : " (no URL)"}</option>
                ))}
              </select>
            </div>
            <Button onClick={() => refresh(selected)} variant="outline" disabled={!selected || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button onClick={handleBuild} disabled={!selected || building}>
              {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Rebuild knowledge base
            </Button>
            <Button onClick={handleClear} variant="destructive" disabled={!selected || entryCount === 0}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {selected && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-xs uppercase text-muted-foreground">Entries</div>
                <div className="text-2xl font-bold">{entryCount}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-xs uppercase text-muted-foreground">Last job</div>
                <div className="text-sm font-medium">{jobs[0]?.status || "—"}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="text-xs uppercase text-muted-foreground">Pages scraped</div>
                <div className="text-2xl font-bold">{jobs[0]?.pages_scraped || 0}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (() => {
        const cb = chatbots.find((c) => c.id === selected);
        if (!cb) return null;
        const hasAny = cb.kb_chatbot_md || cb.kb_voice_text || cb.prompt_core;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Generated Knowledge</CardTitle>
              <CardDescription>
                Auto-generated by the KB Architect. Core facts are injected directly into the chatbot and voice agent prompts for instant answers; the full KB powers RAG retrieval for deeper questions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!hasAny ? (
                <p className="text-sm text-muted-foreground">No generated knowledge yet. Click <strong>Rebuild knowledge base</strong> to generate.</p>
              ) : (
                <Tabs defaultValue="core">
                  <TabsList>
                    <TabsTrigger value="core">Core Facts</TabsTrigger>
                    <TabsTrigger value="chatbot">Chatbot KB</TabsTrigger>
                    <TabsTrigger value="voice">Voice Agent KB</TabsTrigger>
                  </TabsList>
                  <TabsContent value="core">
                    <pre className="max-h-[500px] overflow-auto rounded-md bg-muted/40 p-4 text-xs">
{cb.prompt_core ? JSON.stringify(cb.prompt_core, null, 2) : "—"}
                    </pre>
                  </TabsContent>
                  <TabsContent value="chatbot">
                    <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-4 text-xs">
{cb.kb_chatbot_md || "—"}
                    </pre>
                  </TabsContent>
                  <TabsContent value="voice">
                    <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-4 text-xs">
{cb.kb_voice_text || "—"}
                    </pre>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {jobs.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent jobs</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell><Badge variant={j.status === "done" ? "default" : j.status === "failed" ? "destructive" : "secondary"}>{j.status}</Badge></TableCell>
                    <TableCell>{j.pages_scraped}</TableCell>
                    <TableCell>{j.entries_created}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-destructive">{j.error || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default KnowledgeBasePanel;
