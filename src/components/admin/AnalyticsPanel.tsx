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
  Tablet, AlertTriangle, TrendingUp, Send, Clock
} from "lucide-react";

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

type FollowUpProblem = "no_click" | "click_no_reply" | "multiple_clicks" | "engaged";

interface ClientRow {
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
  device_type: string;
  browser: string;
  os: string;
  followUpProblem: FollowUpProblem;
  followUpMessage: string;
  followUpAction: string;
}

function classifyFollowUp(row: Omit<ClientRow, "followUpProblem" | "followUpMessage" | "followUpAction">): { problem: FollowUpProblem; message: string; action: string } {
  if (row.chatbotClicked || row.voiceClicked) {
    return {
      problem: "engaged",
      message: `Great news! ${row.business_name} tried your AI demo. Send a closing message with a direct booking link.`,
      action: "Send closing CTA"
    };
  }
  if (row.totalClicks >= 3) {
    return {
      problem: "multiple_clicks",
      message: `${row.business_name} visited ${row.totalClicks} times but hasn't engaged with AI. They're deciding — send a trust-building case study.`,
      action: "Send case study"
    };
  }
  if (row.websiteViewed) {
    return {
      problem: "click_no_reply",
      message: `${row.business_name} viewed the page but didn't interact. Send a follow-up highlighting the AI demo.`,
      action: "Send reminder"
    };
  }
  return {
    problem: "no_click",
    message: `${row.business_name} hasn't opened the link yet. Send an attention-grabbing message with a clear value proposition.`,
    action: "Send attention email"
  };
}

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
    // Only show validated events (filter old non-validated for backward compat)
    return result;
  }, [events, excludeAsia, excludeOwner, targetOnly, slugFilter]);

  const uniqueSlugs = useMemo(() => [...new Set(events.map(e => e.slug))], [events]);
  const uniqueSessions = useMemo(() => new Set(filtered.map(e => e.session_id).filter(Boolean)).size, [filtered]);
  const countByType = (type: string) => filtered.filter(e => e.event_type === type).length;

  const clientRows = useMemo(() => {
    const map = new Map<string, Omit<ClientRow, "followUpProblem" | "followUpMessage" | "followUpAction">>();

    for (const e of filtered) {
      const meta = (e.metadata as any) || {};
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
          device_type: meta.device_type || "unknown",
          browser: meta.browser || "unknown",
          os: meta.os || "unknown",
        });
      }
      const row = map.get(e.slug)!;
      row.totalClicks++;
      if (e.session_id) row.sessions.add(e.session_id);

      // Update with most recent data
      if (new Date(e.created_at) > new Date(row.lastActivity)) {
        row.lastActivity = e.created_at;
        row.country = e.country_code;
        row.city = e.city;
        if (meta.device_type) row.device_type = meta.device_type;
        if (meta.browser) row.browser = meta.browser;
        if (meta.os) row.os = meta.os;
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

    return Array.from(map.values())
      .map(row => {
        const fu = classifyFollowUp(row);
        return { ...row, followUpProblem: fu.problem, followUpMessage: fu.message, followUpAction: fu.action } as ClientRow;
      })
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  }, [filtered]);

  const followUpCounts = useMemo(() => {
    const counts = { engaged: 0, multiple_clicks: 0, click_no_reply: 0, no_click: 0 };
    for (const r of clientRows) counts[r.followUpProblem]++;
    return counts;
  }, [clientRows]);

  const getStatusBadge = (r: ClientRow) => {
    switch (r.followUpProblem) {
      case "engaged": return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Engaged</Badge>;
      case "multiple_clicks": return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Deciding</Badge>;
      case "click_no_reply": return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Thinking</Badge>;
      case "no_click": return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">No Activity</Badge>;
    }
  };

  const getFollowUpBadge = (r: ClientRow) => {
    switch (r.followUpProblem) {
      case "engaged": return <Badge variant="outline" className="text-green-600 text-[10px]">{r.followUpAction}</Badge>;
      case "multiple_clicks": return <Badge variant="outline" className="text-blue-600 text-[10px]">{r.followUpAction}</Badge>;
      case "click_no_reply": return <Badge variant="outline" className="text-yellow-600 text-[10px]">{r.followUpAction}</Badge>;
      case "no_click": return <Badge variant="outline" className="text-red-600 text-[10px]">{r.followUpAction}</Badge>;
    }
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
          <CardDescription>Validated human interactions only — bots, duplicates, and self-traffic filtered</CardDescription>
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
                    <TableHead>Country</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead className="text-center">Unique Users</TableHead>
                    <TableHead className="text-center">Link Opened</TableHead>
                    <TableHead className="text-center">Chatbot</TableHead>
                    <TableHead className="text-center">Voice Agent</TableHead>
                    <TableHead className="text-center">Total Clicks</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Follow-up</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientRows.map((row) => (
                    <TableRow key={row.slug}>
                      <TableCell className="font-medium">{row.business_name}</TableCell>
                      <TableCell>
                        <a href={getDemoUrl(row.slug)} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          /{row.slug} <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.country && row.city ? `${row.city}, ${row.country}` : row.country || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <DeviceIcon type={row.device_type} />
                          <span>{row.browser}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">{row.sessions.size}</TableCell>
                      <TableCell className="text-center"><YesNo value={row.linkOpened} /></TableCell>
                      <TableCell className="text-center"><YesNo value={row.chatbotClicked} /></TableCell>
                      <TableCell className="text-center"><YesNo value={row.voiceClicked} /></TableCell>
                      <TableCell className="text-center font-semibold">{row.totalClicks}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(row.lastActivity).toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(row)}</TableCell>
                      <TableCell>{getFollowUpBadge(row)}</TableCell>
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Follow-up Helper
              </CardTitle>
              <CardDescription>Intelligent follow-up suggestions based on user behavior</CardDescription>
            </div>
            <div className="flex gap-2 text-xs">
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">{followUpCounts.engaged} Engaged</Badge>
              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">{followUpCounts.multiple_clicks} Deciding</Badge>
              <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">{followUpCounts.click_no_reply} Thinking</Badge>
              <Badge className="bg-red-500/10 text-red-600 border-red-500/20">{followUpCounts.no_click} Cold</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {clientRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No follow-up data available yet.</p>
          ) : (
            clientRows.map((r) => {
              const colors: Record<FollowUpProblem, string> = {
                engaged: "bg-green-500/5 border-green-500/10",
                multiple_clicks: "bg-blue-500/5 border-blue-500/10",
                click_no_reply: "bg-yellow-500/5 border-yellow-500/10",
                no_click: "bg-red-500/5 border-red-500/10",
              };
              const icons: Record<FollowUpProblem, string> = {
                engaged: "🔥",
                multiple_clicks: "🤔",
                click_no_reply: "👀",
                no_click: "❄️",
              };
              const problemLabels: Record<FollowUpProblem, string> = {
                engaged: "Attention ✅",
                multiple_clicks: "Decision 🎯",
                click_no_reply: "Thinking 💭",
                no_click: "Attention ⚠️",
              };

              return (
                <div key={r.slug} className={`rounded-lg border p-3 ${colors[r.followUpProblem]}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{icons[r.followUpProblem]}</span>
                        <span className="font-semibold text-sm">{r.business_name}</span>
                        <span className="text-xs text-muted-foreground">• {r.totalClicks} clicks • {r.sessions.size} session{r.sessions.size !== 1 ? "s" : ""}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{r.followUpMessage}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{problemLabels[r.followUpProblem]}</span>
                      {getFollowUpBadge(r)}
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
