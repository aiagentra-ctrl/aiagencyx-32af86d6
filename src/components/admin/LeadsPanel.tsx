import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, UserCheck, Clock, Flame, Snowflake, Eye, Phone } from "lucide-react";
import LeadDetailView from "./LeadDetailView";

interface Lead {
  id: string;
  slug: string;
  business_name: string;
  status: string;
  follow_up_count: number;
  last_follow_up_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  needs_follow_up: { label: "Needs Follow-up", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: <Clock className="h-3 w-3" /> },
  interested: { label: "Interested", color: "bg-green-100 text-green-800 border-green-300", icon: <Flame className="h-3 w-3" /> },
  awaiting_response: { label: "Awaiting Response", color: "bg-blue-100 text-blue-800 border-blue-300", icon: <Eye className="h-3 w-3" /> },
  engaged: { label: "Engaged", color: "bg-purple-100 text-purple-800 border-purple-300", icon: <UserCheck className="h-3 w-3" /> },
  call_scheduled: { label: "Call Scheduled", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: <Phone className="h-3 w-3" /> },
  cold_lead: { label: "Cold Lead", color: "bg-gray-100 text-gray-600 border-gray-300", icon: <Snowflake className="h-3 w-3" /> },
};

const FILTERS = ["all", "needs_follow_up", "interested", "engaged", "cold_lead"] as const;

const LeadsPanel = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchLeads = async () => {
    const { data } = await supabase.from("leads").select("*").order("updated_at", { ascending: false });
    if (data) setLeads(data as unknown as Lead[]);
    setLoading(false);
  };

  const syncLeads = async () => {
    setSyncing(true);
    try {
      // Get unique slugs from link_events
      const { data: events } = await supabase.from("link_events").select("slug, business_name, event_type");
      if (!events || events.length === 0) { setSyncing(false); return; }

      const slugMap = new Map<string, { business_name: string; events: string[] }>();
      for (const e of events) {
        const entry = slugMap.get(e.slug) || { business_name: e.business_name, events: [] };
        entry.events.push(e.event_type);
        slugMap.set(e.slug, entry);
      }

      // Get existing leads
      const { data: existingLeads } = await supabase.from("leads").select("slug, status, follow_up_count");
      const existingMap = new Map((existingLeads || []).map((l: any) => [l.slug, l]));

      for (const [slug, info] of slugMap) {
        const existing = existingMap.get(slug) as any;
        
        // Don't auto-downgrade manually set statuses
        if (existing && (existing.status === "call_scheduled")) continue;

        // Auto-classify
        let status = "needs_follow_up";
        const evts = info.events;
        if (evts.includes("voice_call_started")) status = "interested";
        else if (evts.includes("chatbot_opened") || evts.includes("chatbot_message")) status = "awaiting_response";
        
        const totalClicks = evts.filter(e => e === "click" || e === "cta_click").length;
        if (totalClicks >= 3 || evts.length >= 5) status = "engaged";

        if (existing && existing.follow_up_count >= 3 && status === "needs_follow_up") status = "cold_lead";

        if (existing) {
          // Only update status if it changed and wasn't manually set
          if (existing.status !== status && existing.status !== "call_scheduled") {
            await supabase.from("leads").update({ status }).eq("slug", slug);
          }
        } else {
          await supabase.from("leads").insert({ slug, business_name: info.business_name, status });
        }
      }

      await fetchLeads();
      toast({ title: "Leads synced", description: `${slugMap.size} leads processed` });
    } catch (err: any) {
      toast({ title: "Sync error", description: err.message, variant: "destructive" });
    }
    setSyncing(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  const filtered = filter === "all" ? leads : leads.filter(l => l.status === filter);

  const statusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.needs_follow_up;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
        {cfg.icon} {cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Lead Management</CardTitle>
              <CardDescription>{leads.length} total leads</CardDescription>
            </div>
            <Button onClick={syncLeads} disabled={syncing} size="sm" className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Auto-Sync"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filter tabs */}
          <div className="mb-4 flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : STATUS_CONFIG[f]?.label || f}
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No leads found. Click Auto-Sync to import from analytics.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Follow-ups</TableHead>
                  <TableHead className="hidden md:table-cell">Last Follow-up</TableHead>
                  <TableHead className="hidden md:table-cell">Next Reminder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(lead => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { setSelectedLead(lead); setDetailOpen(true); }}
                  >
                    <TableCell className="font-medium">{lead.business_name}</TableCell>
                    <TableCell>{statusBadge(lead.status)}</TableCell>
                    <TableCell className="text-center">{lead.follow_up_count}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {lead.last_follow_up_at ? new Date(lead.last_follow_up_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LeadDetailView
        lead={selectedLead}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={fetchLeads}
      />
    </div>
  );
};

export default LeadsPanel;
