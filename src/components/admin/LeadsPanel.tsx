import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, UserCheck, Clock, Flame, Snowflake, Eye, Phone, Inbox, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; dotColor: string }> = {
  needs_follow_up: { label: "Needs Follow-up", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: <Clock className="h-3.5 w-3.5" />, dotColor: "bg-yellow-500" },
  interested: { label: "Interested", color: "bg-green-100 text-green-800 border-green-300", icon: <Flame className="h-3.5 w-3.5" />, dotColor: "bg-green-500" },
  awaiting_response: { label: "Awaiting Response", color: "bg-blue-100 text-blue-800 border-blue-300", icon: <Eye className="h-3.5 w-3.5" />, dotColor: "bg-blue-500" },
  engaged: { label: "Engaged", color: "bg-purple-100 text-purple-800 border-purple-300", icon: <UserCheck className="h-3.5 w-3.5" />, dotColor: "bg-purple-500" },
  call_scheduled: { label: "Call Scheduled", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: <Phone className="h-3.5 w-3.5" />, dotColor: "bg-emerald-500" },
  cold_lead: { label: "Cold Lead", color: "bg-gray-100 text-gray-600 border-gray-300", icon: <Snowflake className="h-3.5 w-3.5" />, dotColor: "bg-gray-400" },
};

const SIDEBAR_ITEMS = [
  { key: "all", label: "All Leads", icon: Inbox },
  { key: "needs_follow_up", label: "Needs Follow-up", icon: Clock },
  { key: "interested", label: "Interested", icon: Flame },
  { key: "awaiting_response", label: "Awaiting Response", icon: Eye },
  { key: "engaged", label: "Engaged", icon: UserCheck },
  { key: "cold_lead", label: "Cold Leads", icon: Snowflake },
] as const;

const LeadsPanel = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [search, setSearch] = useState("");

  const fetchLeads = useCallback(async () => {
    const d = await adminFetchSafe("leads_legacy", { leads: [] as any[], link_events: [] as any[] });
    const leadsData = (d.leads || []) as unknown as Lead[];
    setLeads(leadsData);
    // Refresh selected lead if it's still in the list
    setSelectedLead((prev) => (prev ? leadsData.find((l) => l.id === prev.id) ?? prev : prev));
    setLoading(false);
  }, []);


  // Regions to exclude from qualified leads (still tracked in analytics)
  const EXCLUDED_COUNTRY_CODES = ["NP", "IN", "BD"];

  const syncLeads = async () => {
    setSyncing(true);
    try {
      const { data: events } = await supabase.from("link_events").select("slug, business_name, event_type, country_code, metadata");
      if (!events || events.length === 0) { setSyncing(false); return; }

      const slugMap = new Map<string, { business_name: string; events: string[]; countryCodes: string[]; hasOwnerTraffic: boolean }>();
      for (const e of events) {
        const entry = slugMap.get(e.slug) || { business_name: e.business_name, events: [], countryCodes: [], hasOwnerTraffic: false };
        entry.events.push(e.event_type);
        if (e.country_code) entry.countryCodes.push(e.country_code);
        const meta = e.metadata as Record<string, unknown> | null;
        if (meta?.is_owner) entry.hasOwnerTraffic = true;
        slugMap.set(e.slug, entry);
      }

      const { data: existingLeads } = await supabase.from("leads").select("slug, status, follow_up_count");
      const existingMap = new Map((existingLeads || []).map((l: any) => [l.slug, l]));

      let processed = 0;
      let skipped = 0;

      for (const [slug, info] of slugMap) {
        // Filter: skip leads where ALL traffic is from excluded regions or marked as owner
        const validCountries = info.countryCodes.filter(c => !EXCLUDED_COUNTRY_CODES.includes(c));
        const allExcluded = info.countryCodes.length > 0 && validCountries.length === 0;
        const isOnlyOwner = info.hasOwnerTraffic && !info.countryCodes.some(c => !EXCLUDED_COUNTRY_CODES.includes(c));

        if ((allExcluded || isOnlyOwner) && !existingMap.has(slug)) {
          skipped++;
          continue; // Don't create lead for excluded-region-only traffic
        }

        const existing = existingMap.get(slug) as any;
        if (existing && existing.status === "call_scheduled") continue;

        let status = "needs_follow_up";
        const evts = info.events;
        if (evts.includes("voice_call_started")) status = "interested";
        else if (evts.includes("chatbot_opened") || evts.includes("chatbot_message")) status = "awaiting_response";
        const totalClicks = evts.filter(e => e === "click" || e === "cta_click").length;
        if (totalClicks >= 3 || evts.length >= 5) status = "engaged";
        if (existing && existing.follow_up_count >= 3 && status === "needs_follow_up") status = "cold_lead";

        if (existing) {
          if (existing.status !== status && existing.status !== "call_scheduled") {
            await supabase.from("leads").update({ status }).eq("slug", slug);
          }
        } else {
          await supabase.from("leads").insert({ slug, business_name: info.business_name, status });
        }
        processed++;
      }

      await fetchLeads();
      toast({ title: "Leads synced", description: `${processed} qualified leads processed${skipped > 0 ? `, ${skipped} excluded (regional)` : ""}` });
    } catch (err: any) {
      toast({ title: "Sync error", description: err.message, variant: "destructive" });
    }
    setSyncing(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  const filtered = leads
    .filter(l => filter === "all" || l.status === filter)
    .filter(l => !search || l.business_name.toLowerCase().includes(search.toLowerCase()));

  const countByStatus = (s: string) => s === "all" ? leads.length : leads.filter(l => l.status === s).length;

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="flex h-[calc(100vh-180px)] rounded-lg border bg-card overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-56 shrink-0 border-r bg-muted/30 flex flex-col">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Leads</h2>
            <Button onClick={syncLeads} disabled={syncing} variant="ghost" size="icon" className="h-7 w-7">
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            </Button>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {SIDEBAR_ITEMS.map(item => {
            const count = countByStatus(item.key);
            const isActive = filter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors text-left",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {count > 0 && (
                  <span className={cn(
                    "text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center",
                    isActive ? "bg-primary/20 text-primary" : "bg-muted-foreground/10 text-muted-foreground"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Middle Panel - Lead List */}
      <div className={cn(
        "flex flex-col border-r",
        selectedLead ? "w-80 shrink-0" : "flex-1"
      )}>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No leads found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Click sync to import from analytics</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(lead => {
                const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.needs_follow_up;
                const isSelected = selectedLead?.id === lead.id;
                return (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={cn(
                      "w-full text-left px-4 py-3 transition-colors hover:bg-muted/50",
                      isSelected && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("h-2.5 w-2.5 rounded-full mt-1.5 shrink-0", cfg.dotColor)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate text-foreground">{lead.business_name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(lead.updated_at)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-medium", cfg.color)}>
                            {cfg.label}
                          </span>
                        </div>
                        {lead.follow_up_count > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {lead.follow_up_count} follow-up{lead.follow_up_count > 1 ? "s" : ""} sent
                            {lead.last_follow_up_at && ` · Last ${timeAgo(lead.last_follow_up_at)}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Lead Detail */}
      {selectedLead ? (
        <div className="flex-1 overflow-hidden">
          <LeadDetailView
            lead={selectedLead}
            onUpdated={fetchLeads}
            onClose={() => setSelectedLead(null)}
          />
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-center p-8">
          <div>
            <Inbox className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">Select a lead to view details</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Click on any lead from the list</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsPanel;
