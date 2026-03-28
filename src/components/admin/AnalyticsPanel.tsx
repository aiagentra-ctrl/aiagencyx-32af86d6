import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Eye, MessageCircle, Phone, MousePointer, Users, ChevronDown, Globe, Filter } from "lucide-react";

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
}

type DateRange = "24h" | "7d" | "30d" | "all";

const AnalyticsPanel = () => {
  const [events, setEvents] = useState<LinkEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [excludeAsia, setExcludeAsia] = useState(true);
  const [targetOnly, setTargetOnly] = useState(false);
  const [slugFilter, setSlugFilter] = useState<string>("all");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    let result = events;
    if (excludeAsia) result = result.filter(e => !e.country_code || !ASIAN_COUNTRIES.includes(e.country_code));
    if (targetOnly) result = result.filter(e => e.country_code && TARGET_MARKETS.includes(e.country_code));
    if (slugFilter !== "all") result = result.filter(e => e.slug === slugFilter);
    return result;
  }, [events, excludeAsia, targetOnly, slugFilter]);

  const uniqueSlugs = useMemo(() => [...new Set(events.map(e => e.slug))], [events]);
  const uniqueSessions = useMemo(() => new Set(filtered.map(e => e.session_id).filter(Boolean)).size, [filtered]);

  const countByType = (type: string) => filtered.filter(e => e.event_type === type).length;

  // Group by slug for the table
  const slugStats = useMemo(() => {
    const map = new Map<string, { business_name: string; views: number; chatbot_opens: number; voice_calls: number; cta_clicks: number; last_activity: string; sessions: Set<string>; events: LinkEvent[] }>();
    for (const e of filtered) {
      if (!map.has(e.slug)) {
        map.set(e.slug, { business_name: e.business_name, views: 0, chatbot_opens: 0, voice_calls: 0, cta_clicks: 0, last_activity: e.created_at, sessions: new Set(), events: [] });
      }
      const s = map.get(e.slug)!;
      s.events.push(e);
      if (e.session_id) s.sessions.add(e.session_id);
      if (new Date(e.created_at) > new Date(s.last_activity)) s.last_activity = e.created_at;
      switch (e.event_type) {
        case "page_view": s.views++; break;
        case "chatbot_opened": s.chatbot_opens++; break;
        case "chatbot_message": s.chatbot_opens++; break;
        case "voice_call_started": s.voice_calls++; break;
        case "cta_clicked": s.cta_clicks++; break;
      }
    }
    return Array.from(map.entries()).sort((a, b) => new Date(b[1].last_activity).getTime() - new Date(a[1].last_activity).getTime());
  }, [filtered]);

  // Follow-up categories from all demos (not just filtered events)
  const followUpData = useMemo(() => {
    const allSlugs = [...new Set(events.map(e => e.slug))];
    const slugEventsMap = new Map<string, LinkEvent[]>();
    for (const e of filtered) {
      if (!slugEventsMap.has(e.slug)) slugEventsMap.set(e.slug, []);
      slugEventsMap.get(e.slug)!.push(e);
    }

    const hot: typeof slugStats = [];
    const needsFollowUp: typeof slugStats = [];
    const cold: typeof slugStats = [];

    for (const [slug, stats] of slugStats) {
      if (stats.chatbot_opens > 0 || stats.voice_calls > 0) {
        hot.push([slug, stats]);
      } else if (stats.views > 0) {
        needsFollowUp.push([slug, stats]);
      }
    }
    // Cold = slugs with zero events in filtered
    const activeSlugs = new Set(slugStats.map(([s]) => s));
    for (const slug of allSlugs) {
      if (!activeSlugs.has(slug)) {
        const anyEvent = events.find(e => e.slug === slug);
        if (anyEvent) cold.push([slug, { business_name: anyEvent.business_name, views: 0, chatbot_opens: 0, voice_calls: 0, cta_clicks: 0, last_activity: anyEvent.created_at, sessions: new Set(), events: [] }]);
      }
    }

    return { hot, needsFollowUp, cold };
  }, [slugStats, events, filtered]);

  const getStatus = (s: typeof slugStats[0][1]) => {
    if (s.chatbot_opens > 0 || s.voice_calls > 0) return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Engaged</Badge>;
    if (s.views > 0) return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Viewed</Badge>;
    return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">No Activity</Badge>;
  };

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
              <Switch checked={excludeAsia} onCheckedChange={setExcludeAsia} />
              <span className="text-sm">Exclude Asia</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={targetOnly} onCheckedChange={(v) => { setTargetOnly(v); if (v) setExcludeAsia(false); }} />
              <span className="text-sm">NZ/AU/CA only</span>
            </div>
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

      {/* Per-Link Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Per-Link Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : slugStats.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No tracking data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Chat</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">CTAs</TableHead>
                  <TableHead className="hidden md:table-cell">Last Activity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slugStats.map(([slug, stats]) => (
                  <Collapsible key={slug} asChild open={expandedSlug === slug} onOpenChange={(o) => setExpandedSlug(o ? slug : null)}>
                    <>
                      <TableRow className="cursor-pointer" onClick={() => setExpandedSlug(expandedSlug === slug ? null : slug)}>
                        <TableCell className="font-medium">{stats.business_name}</TableCell>
                        <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{slug}</code></TableCell>
                        <TableCell className="text-right">{stats.views}</TableCell>
                        <TableCell className="text-right">{stats.chatbot_opens}</TableCell>
                        <TableCell className="text-right">{stats.voice_calls}</TableCell>
                        <TableCell className="text-right">{stats.cta_clicks}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{new Date(stats.last_activity).toLocaleString()}</TableCell>
                        <TableCell>{getStatus(stats)}</TableCell>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6"><ChevronDown className="h-3 w-3" /></Button>
                          </CollapsibleTrigger>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={9} className="bg-muted/30 p-0">
                            <div className="max-h-48 overflow-auto p-3">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b">
                                    <th className="pb-1 text-left font-medium">Event</th>
                                    <th className="pb-1 text-left font-medium">Country</th>
                                    <th className="pb-1 text-left font-medium">City</th>
                                    <th className="pb-1 text-left font-medium">Time</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {stats.events.slice(0, 20).map(e => (
                                    <tr key={e.id} className="border-b border-border/50">
                                      <td className="py-1">{e.event_type}</td>
                                      <td className="py-1">{e.country_code || "—"}</td>
                                      <td className="py-1">{e.city || "—"}</td>
                                      <td className="py-1 text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
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
          {followUpData.hot.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-green-600">🔥 Hot Leads — Interacted with AI</h4>
              <div className="space-y-1">
                {followUpData.hot.map(([slug, s]) => (
                  <div key={slug} className="flex items-center justify-between rounded-md bg-green-500/5 px-3 py-2 text-sm">
                    <span className="font-medium">{s.business_name}</span>
                    <span className="text-muted-foreground">Chat: {s.chatbot_opens} • Calls: {s.voice_calls}</span>
                    <Badge variant="outline" className="text-green-600">Send booking nudge</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          {followUpData.needsFollowUp.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-yellow-600">👀 Needs Follow-up — Viewed but no interaction</h4>
              <div className="space-y-1">
                {followUpData.needsFollowUp.map(([slug, s]) => (
                  <div key={slug} className="flex items-center justify-between rounded-md bg-yellow-500/5 px-3 py-2 text-sm">
                    <span className="font-medium">{s.business_name}</span>
                    <span className="text-muted-foreground">{s.views} views</span>
                    <Badge variant="outline" className="text-yellow-600">Send reminder</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          {followUpData.cold.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-red-600">❄️ Cold — Never opened</h4>
              <div className="space-y-1">
                {followUpData.cold.map(([slug, s]) => (
                  <div key={slug} className="flex items-center justify-between rounded-md bg-red-500/5 px-3 py-2 text-sm">
                    <span className="font-medium">{s.business_name}</span>
                    <span className="text-muted-foreground">No activity</span>
                    <Badge variant="outline" className="text-red-600">Send initial email</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          {followUpData.hot.length === 0 && followUpData.needsFollowUp.length === 0 && followUpData.cold.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No follow-up data available yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPanel;
