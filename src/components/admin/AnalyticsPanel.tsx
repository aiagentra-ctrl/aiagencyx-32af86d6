import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye, MessageCircle, Phone, MousePointer, Users, Globe, Filter, ExternalLink, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

const ASIAN_COUNTRIES = ["NP", "IN", "BD", "PK", "LK", "MM", "TH", "VN", "PH", "ID", "MY", "CN", "JP", "KR", "TW", "HK", "SG", "KH", "LA", "BN", "MN", "AF"];
const TARGET_MARKETS = ["NZ", "AU", "CA"];

interface LinkEvent {
  id: string;
  slug: string;
  business_name: string;
  event_type: string;
  country_code: string | null;
  city: string | null;
  session_id: string | null;
  created_at: string;
  link_type: string;
  metadata: any;
  visitor_ip: string | null;
  user_agent: string | null;
}

type DateRange = "24h" | "7d" | "30d" | "all";

const YesNo = ({ value }: { value: boolean }) =>
  value ? (
    <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Yes</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground"><XCircle className="h-3.5 w-3.5" /> No</span>
  );

const AnalyticsPanel = () => {
  const [events, setEvents] = useState<LinkEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [excludeAsia, setExcludeAsia] = useState(true);
  const [excludeOwner, setExcludeOwner] = useState(true);
  const [targetOnly, setTargetOnly] = useState(false);
  const [slugFilter, setSlugFilter] = useState<string>("all");

  const fetchEvents = async () => {
    setLoading(true);
    let query = supabase.from("link_events").select("*").order("created_at", { ascending: false }).limit(1000);

    if (dateRange !== "all") {
      const now = new Date();
      const hoursMap: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };
      const since = new Date(now.getTime() - hoursMap[dateRange] * 60 * 60 * 1000);
      query = query.gte("created_at", since.toISOString());
    }

    const { data } = await query;
    setEvents((data as unknown as LinkEvent[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, [dateRange]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = events;
    // Exclude owner's own traffic (tagged by edge function)
    if (excludeOwner) result = result.filter(e => !(e.metadata as any)?.is_owner);
    if (excludeAsia) result = result.filter(e => !e.country_code || !ASIAN_COUNTRIES.includes(e.country_code));
    if (targetOnly) result = result.filter(e => e.country_code && TARGET_MARKETS.includes(e.country_code));
    if (slugFilter !== "all") result = result.filter(e => e.slug === slugFilter);
    return result;
  }, [events, excludeAsia, excludeOwner, targetOnly, slugFilter]);

  const uniqueSlugs = useMemo(() => [...new Set(events.map(e => e.slug))], [events]);
  const uniqueSessions = useMemo(() => new Set(filtered.map(e => e.session_id).filter(Boolean)).size, [filtered]);
  const countByType = (type: string) => filtered.filter(e => e.event_type === type).length;

  // Group by business/slug — one row per client
  const clientRows = useMemo(() => {
    const map = new Map<string, {
      business_name: string;
      slug: string;
      linkOpened: boolean;
      websiteViewed: boolean;
      chatbotClicked: boolean;
      voiceClicked: boolean;
      totalClicks: number;
      lastActivity: string;
      country: string | null;
      city: string | null;
      sessions: Set<string>;
    }>();

    for (const e of filtered) {
      if (!map.has(e.slug)) {
        map.set(e.slug, {
          business_name: e.business_name,
          slug: e.slug,
          linkOpened: false,
          websiteViewed: false,
          chatbotClicked: false,
          voiceClicked: false,
          totalClicks: 0,
          lastActivity: e.created_at,
          country: e.country_code,
          city: e.city,
          sessions: new Set(),
        });
      }
      const row = map.get(e.slug)!;
      row.totalClicks++;
      if (e.session_id) row.sessions.add(e.session_id);
      if (new Date(e.created_at) > new Date(row.lastActivity)) {
        row.lastActivity = e.created_at;
        row.country = e.country_code;
        row.city = e.city;
      }

      switch (e.event_type) {
        case "page_view":
          row.linkOpened = true;
          row.websiteViewed = true;
          break;
        case "chatbot_opened":
        case "chatbot_message":
          row.chatbotClicked = true;
          break;
        case "voice_call_started":
          row.voiceClicked = true;
          break;
        case "cta_clicked":
          row.linkOpened = true;
          break;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }, [filtered]);

  // Follow-up categories
  const followUp = useMemo(() => {
    const hot = clientRows.filter(r => r.chatbotClicked || r.voiceClicked);
    const warm = clientRows.filter(r => r.websiteViewed && !r.chatbotClicked && !r.voiceClicked);
    const cold = clientRows.filter(r => !r.websiteViewed);
    return { hot, warm, cold };
  }, [clientRows]);

  const getStatus = (r: typeof clientRows[0]) => {
    if (r.chatbotClicked || r.voiceClicked)
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Engaged</Badge>;
    if (r.websiteViewed)
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Viewed</Badge>;
    return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">No Activity</Badge>;
  };

  const getDemoUrl = (slug: string) => `${window.location.origin}/${slug}`;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <div className="flex gap-1">
              {(["24h", "7d", "30d", "all"] as DateRange[]).map(r => (
                <Button key={r} size="sm" variant={dateRange === r ? "default" : "outline"} onClick={() => setDateRange(r)}>
                  {r === "all" ? "All" : r === "24h" ? "24h" : r === "7d" ? "7 days" : "30 days"}
                </Button>
              ))}
            </div>
            <Select value={slugFilter} onValueChange={setSlugFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All businesses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All businesses</SelectItem>
                {uniqueSlugs.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={excludeOwner} onCheckedChange={setExcludeOwner} />
              <span className="text-sm">Exclude my traffic</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={excludeAsia} onCheckedChange={setExcludeAsia} />
              <span className="text-sm">Exclude Asia</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={targetOnly} onCheckedChange={(v) => { setTargetOnly(v); if (v) setExcludeAsia(false); }} />
              <span className="text-sm">NZ/AU/CA only</span>
            </div>
            <Button variant="outline" size="sm" onClick={fetchEvents} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="mx-auto mb-2 h-5 w-5 text-primary" />
            <div className="text-2xl font-bold">{uniqueSessions}</div>
            <div className="text-xs text-muted-foreground">Unique Visitors</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Eye className="mx-auto mb-2 h-5 w-5 text-blue-500" />
            <div className="text-2xl font-bold">{countByType("page_view")}</div>
            <div className="text-xs text-muted-foreground">Page Views</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <MessageCircle className="mx-auto mb-2 h-5 w-5 text-green-500" />
            <div className="text-2xl font-bold">{countByType("chatbot_opened") + countByType("chatbot_message")}</div>
            <div className="text-xs text-muted-foreground">Chatbot Engagements</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Phone className="mx-auto mb-2 h-5 w-5 text-orange-500" />
            <div className="text-2xl font-bold">{countByType("voice_call_started")}</div>
            <div className="text-xs text-muted-foreground">Voice Calls</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <MousePointer className="mx-auto mb-2 h-5 w-5 text-purple-500" />
            <div className="text-2xl font-bold">{countByType("cta_clicked")}</div>
            <div className="text-xs text-muted-foreground">CTA Clicks</div>
          </CardContent>
        </Card>
      </div>

      {/* Client Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Client Activity Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : clientRows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No tracking data yet. Share demo links to start tracking.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business Name</TableHead>
                    <TableHead>Website Link</TableHead>
                    <TableHead className="text-center">Link Opened</TableHead>
                    <TableHead className="text-center">Website Viewed</TableHead>
                    <TableHead className="text-center">Chatbot Clicked</TableHead>
                    <TableHead className="text-center">Voice Agent Clicked</TableHead>
                    <TableHead className="text-center">Total Clicks</TableHead>
                    <TableHead className="text-center">Location</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientRows.map((row) => (
                    <TableRow key={row.slug}>
                      <TableCell className="font-medium">{row.business_name}</TableCell>
                      <TableCell>
                        <a
                          href={getDemoUrl(row.slug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          /{row.slug}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-center"><YesNo value={row.linkOpened} /></TableCell>
                      <TableCell className="text-center"><YesNo value={row.websiteViewed} /></TableCell>
                      <TableCell className="text-center"><YesNo value={row.chatbotClicked} /></TableCell>
                      <TableCell className="text-center"><YesNo value={row.voiceClicked} /></TableCell>
                      <TableCell className="text-center font-semibold">{row.totalClicks}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {row.country && row.city ? `${row.city}, ${row.country}` : row.country || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(row.lastActivity).toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatus(row)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-up Helper */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" /> Follow-up Helper
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {followUp.hot.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-green-600">🔥 Hot Leads — Interacted with AI ({followUp.hot.length})</h4>
              <div className="space-y-1">
                {followUp.hot.map(r => (
                  <div key={r.slug} className="flex items-center justify-between rounded-md bg-green-500/5 px-3 py-2 text-sm">
                    <span className="font-medium">{r.business_name}</span>
                    <span className="text-muted-foreground">
                      {r.chatbotClicked && "💬 Chatbot"} {r.voiceClicked && "📞 Voice"} • {r.totalClicks} clicks
                    </span>
                    <Badge variant="outline" className="text-green-600">Send booking nudge</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          {followUp.warm.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-yellow-600">👀 Needs Follow-up — Viewed but no interaction ({followUp.warm.length})</h4>
              <div className="space-y-1">
                {followUp.warm.map(r => (
                  <div key={r.slug} className="flex items-center justify-between rounded-md bg-yellow-500/5 px-3 py-2 text-sm">
                    <span className="font-medium">{r.business_name}</span>
                    <span className="text-muted-foreground">{r.totalClicks} views</span>
                    <Badge variant="outline" className="text-yellow-600">Send reminder</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          {followUp.cold.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-red-600">❄️ Cold — Never opened ({followUp.cold.length})</h4>
              <div className="space-y-1">
                {followUp.cold.map(r => (
                  <div key={r.slug} className="flex items-center justify-between rounded-md bg-red-500/5 px-3 py-2 text-sm">
                    <span className="font-medium">{r.business_name}</span>
                    <span className="text-muted-foreground">No activity</span>
                    <Badge variant="outline" className="text-red-600">Send initial email</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          {followUp.hot.length === 0 && followUp.warm.length === 0 && followUp.cold.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No follow-up data available yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPanel;
