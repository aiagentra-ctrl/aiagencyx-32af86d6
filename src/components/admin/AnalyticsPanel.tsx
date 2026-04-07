import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Eye, MessageCircle, Phone, MousePointer, Users, Globe, Filter,
  ExternalLink, CheckCircle2, XCircle, RefreshCw, Monitor, Smartphone,
  Tablet, AlertTriangle, TrendingUp, Send, Clock, Copy
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

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

const DeviceIcon = ({ type }: { type: string }) => {
  if (type === "mobile") return <Smartphone className="h-3.5 w-3.5" />;
  if (type === "tablet") return <Tablet className="h-3.5 w-3.5" />;
  return <Monitor className="h-3.5 w-3.5" />;
};

// === 3 CLEAR STATES ===
type FollowUpProblem = "no_click" | "clicked_no_action" | "multiple_clicks";

type EngagementDetail = "not_opened" | "opened_no_chat" | "tried_chatbot" | "tried_voice" | "tried_both";

interface FollowUpResult {
  problem: FollowUpProblem;
  problemLabel: string;
  message: string;
  action: string;
  detail: EngagementDetail;
}

interface ClientRow {
  business_name: string;
  slug: string;
  linkOpened: boolean;
  websiteViewed: boolean;
  chatbotClicked: boolean;
  voiceClicked: boolean;
  totalClicks: number;
  lastActivity: string;
  firstActivity: string;
  country: string | null;
  city: string | null;
  sessions: Set<string>;
  device_type: string;
  browser: string;
  os: string;
  followUp: FollowUpResult;
  totalDuration: number;
  totalActiveTime: number;
  sessionCount: number;
}

function getEngagementDetail(row: { linkOpened: boolean; chatbotClicked: boolean; voiceClicked: boolean }): EngagementDetail {
  if (!row.linkOpened) return "not_opened";
  if (row.chatbotClicked && row.voiceClicked) return "tried_both";
  if (row.voiceClicked) return "tried_voice";
  if (row.chatbotClicked) return "tried_chatbot";
  return "opened_no_chat";
}

function classifyFollowUp(row: { linkOpened: boolean; websiteViewed: boolean; chatbotClicked: boolean; voiceClicked: boolean; totalClicks: number; business_name: string }): FollowUpResult {
  const detail = getEngagementDetail(row);

  // STATE 3: Multiple clicks = Decision stage
  if (row.totalClicks >= 3) {
    if (row.voiceClicked) {
      return { problem: "multiple_clicks", problemLabel: "Decision", detail, message: `Looks like you checked it a few times — want me to set this up for you?`, action: "Close / schedule call" };
    }
    if (row.chatbotClicked) {
      return { problem: "multiple_clicks", problemLabel: "Decision", detail, message: `Want me to customize this fully for your business? Quick call?`, action: "Send customization offer" };
    }
    return { problem: "multiple_clicks", problemLabel: "Decision", detail, message: `I can customize this fully for your business, quick call?`, action: "Push gently + urgency" };
  }

  // STATE 2: Clicked but no action = Interest/Confusion
  if (row.linkOpened || row.websiteViewed) {
    if (row.voiceClicked) {
      return { problem: "clicked_no_action", problemLabel: "HOT LEAD 🔥", detail, message: `Let's set this up for your business — you've already seen it work.`, action: "Send closing CTA" };
    }
    if (row.chatbotClicked) {
      return { problem: "clicked_no_action", problemLabel: "Interest", detail, message: `Want me to customize it for you?`, action: "Offer customization" };
    }
    return { problem: "clicked_no_action", problemLabel: "Confusion", detail, message: `Did you get a chance to try the AI chatbot? It handles customer queries automatically.`, action: "Explain demo" };
  }

  // STATE 1: No click = Attention needed
  return { problem: "no_click", problemLabel: "Attention", detail, message: `Quick check — did you see the AI demo I made for your business?`, action: "Send hook message" };
}

// Engagement detail icons/labels
const DETAIL_CONFIG: Record<EngagementDetail, { icon: string; label: string }> = {
  not_opened: { icon: "❌", label: "Not opened" },
  opened_no_chat: { icon: "👀", label: "Opened, no interaction" },
  tried_chatbot: { icon: "🤖", label: "Tried chatbot" },
  tried_voice: { icon: "📞", label: "Tried voice agent" },
  tried_both: { icon: "🔥", label: "Tried both" },
};

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

  const filtered = useMemo(() => {
    let result = events;
    if (excludeOwner) result = result.filter(e => !(e.metadata as any)?.is_owner);
    if (excludeAsia) result = result.filter(e => !e.country_code || !ASIAN_COUNTRIES.includes(e.country_code));
    if (targetOnly) result = result.filter(e => e.country_code && TARGET_MARKETS.includes(e.country_code));
    if (slugFilter !== "all") result = result.filter(e => e.slug === slugFilter);
    return result;
  }, [events, excludeAsia, excludeOwner, targetOnly, slugFilter]);

  const uniqueSlugs = useMemo(() => [...new Set(events.map(e => e.slug))], [events]);
  const uniqueSessions = useMemo(() => new Set(filtered.map(e => e.session_id).filter(Boolean)).size, [filtered]);
  const countByType = (type: string) => filtered.filter(e => e.event_type === type).length;

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const clientRows = useMemo(() => {
    const map = new Map<string, Omit<ClientRow, "followUp">>();

    for (const e of filtered) {
      const meta = (e.metadata as any) || {};
      if (!map.has(e.slug)) {
        map.set(e.slug, {
          business_name: e.business_name, slug: e.slug,
          linkOpened: false, websiteViewed: false, chatbotClicked: false, voiceClicked: false,
          totalClicks: 0, lastActivity: e.created_at, firstActivity: e.created_at,
          country: e.country_code, city: e.city,
          sessions: new Set(),
          device_type: meta.device_type || "unknown",
          browser: meta.browser || "unknown", os: meta.os || "unknown",
          totalDuration: 0, totalActiveTime: 0, sessionCount: 0,
        });
      }
      const row = map.get(e.slug)!;
      row.totalClicks++;
      if (e.session_id) row.sessions.add(e.session_id);

      if (new Date(e.created_at) > new Date(row.lastActivity)) {
        row.lastActivity = e.created_at;
        row.country = e.country_code; row.city = e.city;
        if (meta.device_type) row.device_type = meta.device_type;
        if (meta.browser) row.browser = meta.browser;
        if (meta.os) row.os = meta.os;
      }
      if (new Date(e.created_at) < new Date(row.firstActivity)) {
        row.firstActivity = e.created_at;
      }

      // Accumulate duration from session_end events
      if (e.event_type === "session_end" && meta.duration_seconds > 0) {
        row.totalDuration += meta.duration_seconds;
        row.totalActiveTime += meta.active_time_seconds || 0;
        row.sessionCount++;
      }

      switch (e.event_type) {
        case "page_view": row.linkOpened = true; row.websiteViewed = true; break;
        case "chatbot_opened": case "chatbot_message": row.chatbotClicked = true; break;
        case "voice_call_started": row.voiceClicked = true; break;
        case "cta_clicked": row.linkOpened = true; break;
      }
    }

    return Array.from(map.values())
      .map(row => ({ ...row, followUp: classifyFollowUp(row) } as ClientRow))
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  }, [filtered]);

  // Aggregate time metrics
  const avgSessionDuration = useMemo(() => {
    const withDuration = clientRows.filter(r => r.sessionCount > 0);
    if (withDuration.length === 0) return 0;
    const total = withDuration.reduce((s, r) => s + r.totalDuration, 0);
    const count = withDuration.reduce((s, r) => s + r.sessionCount, 0);
    return Math.round(total / count);
  }, [clientRows]);

  const avgActiveTime = useMemo(() => {
    const withDuration = clientRows.filter(r => r.sessionCount > 0);
    if (withDuration.length === 0) return 0;
    const total = withDuration.reduce((s, r) => s + r.totalActiveTime, 0);
    const count = withDuration.reduce((s, r) => s + r.sessionCount, 0);
    return Math.round(total / count);
  }, [clientRows]);

  // Active sessions (session_start in last 5min without matching session_end)
  const activeSessions = useMemo(() => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const starts = new Set(filtered.filter(e => e.event_type === "session_start" && e.created_at >= fiveMinAgo).map(e => e.session_id));
    const ends = new Set(filtered.filter(e => e.event_type === "session_end" && e.created_at >= fiveMinAgo).map(e => e.session_id));
    for (const sid of ends) starts.delete(sid);
    return starts.size;
  }, [filtered]);

  const followUpCounts = useMemo(() => {
    const c = { no_click: 0, clicked_no_action: 0, multiple_clicks: 0 };
    for (const r of clientRows) c[r.followUp.problem]++;
    return c;
  }, [clientRows]);

  const getStatusBadge = (r: ClientRow) => {
    switch (r.followUp.problem) {
      case "multiple_clicks": return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">🔁 Deciding</Badge>;
      case "clicked_no_action": return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">👀 Clicked</Badge>;
      case "no_click": return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">❌ No Click</Badge>;
    }
  };

  const copyMessage = (msg: string) => {
    navigator.clipboard.writeText(msg);
    toast({ title: "Message copied!", description: "Paste it in your follow-up" });
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
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All businesses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All businesses</SelectItem>
                {uniqueSlugs.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2"><Switch checked={excludeOwner} onCheckedChange={setExcludeOwner} /><span className="text-sm">Exclude my traffic</span></div>
            <div className="flex items-center gap-2"><Switch checked={excludeAsia} onCheckedChange={setExcludeAsia} /><span className="text-sm">Exclude Asia</span></div>
            <div className="flex items-center gap-2"><Switch checked={targetOnly} onCheckedChange={(v) => { setTargetOnly(v); if (v) setExcludeAsia(false); }} /><span className="text-sm">NZ/AU/CA only</span></div>
            <Button variant="outline" size="sm" onClick={fetchEvents} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
        <Card><CardContent className="pt-6 text-center"><Users className="mx-auto mb-2 h-5 w-5 text-primary" /><div className="text-2xl font-bold">{uniqueSessions}</div><div className="text-xs text-muted-foreground">Unique Visitors</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Eye className="mx-auto mb-2 h-5 w-5 text-blue-500" /><div className="text-2xl font-bold">{countByType("page_view")}</div><div className="text-xs text-muted-foreground">Page Views</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><MessageCircle className="mx-auto mb-2 h-5 w-5 text-green-500" /><div className="text-2xl font-bold">{countByType("chatbot_opened") + countByType("chatbot_message")}</div><div className="text-xs text-muted-foreground">Chatbot Engagements</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Phone className="mx-auto mb-2 h-5 w-5 text-orange-500" /><div className="text-2xl font-bold">{countByType("voice_call_started")}</div><div className="text-xs text-muted-foreground">Voice Calls</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><MousePointer className="mx-auto mb-2 h-5 w-5 text-purple-500" /><div className="text-2xl font-bold">{countByType("cta_clicked")}</div><div className="text-xs text-muted-foreground">CTA Clicks</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Clock className="mx-auto mb-2 h-5 w-5 text-teal-500" /><div className="text-2xl font-bold">{formatDuration(avgSessionDuration)}</div><div className="text-xs text-muted-foreground">Avg Session</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><TrendingUp className="mx-auto mb-2 h-5 w-5 text-emerald-500" /><div className="text-2xl font-bold">{formatDuration(avgActiveTime)}</div><div className="text-xs text-muted-foreground">Avg Active Time</div></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><Globe className="mx-auto mb-2 h-5 w-5 text-rose-500" /><div className="text-2xl font-bold">{activeSessions}</div><div className="text-xs text-muted-foreground flex items-center justify-center gap-1">{activeSessions > 0 && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}Active Now</div></CardContent></Card>
      </div>

      {/* Client Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Client Activity Tracker</CardTitle>
          <CardDescription>Validated human interactions — bots, duplicates, and self-traffic filtered</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : clientRows.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No tracking data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead className="text-center">Users</TableHead>
                    <TableHead className="text-center">Opened</TableHead>
                    <TableHead className="text-center">Chatbot</TableHead>
                    <TableHead className="text-center">Voice</TableHead>
                    <TableHead className="text-center">Clicks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Problem</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientRows.map((row) => (
                    <TableRow key={row.slug} className={
                      row.followUp.problem === "multiple_clicks" ? "bg-blue-500/5" :
                      row.followUp.problem === "clicked_no_action" ? "bg-yellow-500/5" :
                      "bg-red-500/5"
                    }>
                      <TableCell className="font-medium">{row.business_name}</TableCell>
                      <TableCell>
                        <a href={getDemoUrl(row.slug)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          /{row.slug} <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.country && row.city ? `${row.city}, ${row.country}` : row.country || "—"}</TableCell>
                      <TableCell><div className="flex items-center gap-1 text-xs text-muted-foreground"><DeviceIcon type={row.device_type} /><span>{row.browser}</span></div></TableCell>
                      <TableCell className="text-center font-medium">{row.sessions.size}</TableCell>
                      <TableCell className="text-center"><YesNo value={row.linkOpened} /></TableCell>
                      <TableCell className="text-center"><YesNo value={row.chatbotClicked} /></TableCell>
                      <TableCell className="text-center"><YesNo value={row.voiceClicked} /></TableCell>
                      <TableCell className="text-center font-semibold">{row.totalClicks}</TableCell>
                      <TableCell>{getStatusBadge(row)}</TableCell>
                      <TableCell><span className="text-xs font-medium">{row.followUp.problemLabel}</span></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] cursor-pointer" onClick={() => copyMessage(row.followUp.message)}>
                          {row.followUp.action}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-up Helper — 3 Clear States */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Follow-up Helper</CardTitle>
              <CardDescription>3 states → Know problem → Send correct message</CardDescription>
            </div>
            <div className="flex gap-2 text-xs">
              <Badge className="bg-red-500/10 text-red-600 border-red-500/20">❌ {followUpCounts.no_click} No Click</Badge>
              <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">👀 {followUpCounts.clicked_no_action} Clicked</Badge>
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">🔁 {followUpCounts.multiple_clicks} Multi Click</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {clientRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No follow-up data available yet.</p>
          ) : (
            clientRows.map((r) => {
              const colors: Record<FollowUpProblem, string> = {
                no_click: "bg-red-500/5 border-red-500/15",
                clicked_no_action: "bg-yellow-500/5 border-yellow-500/15",
                multiple_clicks: "bg-blue-500/5 border-blue-500/15",
              };
              const detailInfo = DETAIL_CONFIG[r.followUp.detail];

              return (
                <div key={r.slug} className={`rounded-lg border p-4 ${colors[r.followUp.problem]}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-sm">{r.business_name}</span>
                        {getStatusBadge(r)}
                        <span className="text-xs text-muted-foreground">• {r.totalClicks} clicks • {r.sessions.size} user{r.sessions.size !== 1 ? "s" : ""}</span>
                      </div>

                      {/* Engagement Detail */}
                      <div className="flex items-center gap-3 mb-2 text-xs">
                        <span>{detailInfo.icon} {detailInfo.label}</span>
                        {r.country && <span className="text-muted-foreground">📍 {r.city ? `${r.city}, ` : ""}{r.country}</span>}
                        <span className="text-muted-foreground"><Clock className="h-3 w-3 inline mr-0.5" />{new Date(r.lastActivity).toLocaleString()}</span>
                      </div>

                      {/* Suggested Message */}
                      <div className="bg-background/80 rounded-md p-2.5 border">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Suggested message:</span>
                            <p className="text-sm mt-0.5 italic text-foreground">"{r.followUp.message}"</p>
                          </div>
                          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyMessage(r.followUp.message)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Problem + Action */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-xs font-medium">Problem: {r.followUp.problemLabel}</span>
                      <Badge variant="outline" className="text-[10px] cursor-pointer" onClick={() => copyMessage(r.followUp.message)}>
                        <Send className="h-3 w-3 mr-1" />{r.followUp.action}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPanel;
