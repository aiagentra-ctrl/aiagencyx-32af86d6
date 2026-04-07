import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye, MessageCircle, Phone, MousePointer, Clock, Globe,
  Monitor, Smartphone, Tablet, TrendingUp, ArrowDown,
  Copy, ExternalLink, CheckCircle2, XCircle, Send
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ClientDetailProps {
  row: {
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
    totalDuration: number;
    totalActiveTime: number;
    sessionCount: number;
    maxScrollDepth: number;
    returnVisits: number;
    chatScore: number;
    topClicks: { element: string; text: string; count: number }[];
    followUp: {
      problem: string;
      problemLabel: string;
      message: string;
      action: string;
      detail: string;
    };
  };
  events: {
    id: string;
    event_type: string;
    created_at: string;
    metadata: any;
    country_code: string | null;
    city: string | null;
  }[];
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};

const DeviceIcon = ({ type }: { type: string }) => {
  if (type === "mobile") return <Smartphone className="h-4 w-4" />;
  if (type === "tablet") return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
};

const EVENT_ICONS: Record<string, { icon: typeof Eye; color: string; label: string }> = {
  page_view: { icon: Eye, color: "text-blue-500", label: "Page View" },
  chatbot_opened: { icon: MessageCircle, color: "text-green-500", label: "Chatbot Opened" },
  chatbot_message: { icon: MessageCircle, color: "text-green-600", label: "Chat Message" },
  voice_call_started: { icon: Phone, color: "text-orange-500", label: "Voice Call" },
  cta_clicked: { icon: MousePointer, color: "text-purple-500", label: "CTA Click" },
  scroll_depth: { icon: ArrowDown, color: "text-teal-500", label: "Scroll" },
  session_start: { icon: Clock, color: "text-muted-foreground", label: "Session Start" },
  session_end: { icon: Clock, color: "text-muted-foreground", label: "Session End" },
  return_visit: { icon: TrendingUp, color: "text-purple-500", label: "Return Visit" },
  click: { icon: MousePointer, color: "text-indigo-500", label: "Click" },
};

const ClientDetailPanel = ({ row, events }: ClientDetailProps) => {
  const copyMessage = (msg: string) => {
    navigator.clipboard.writeText(msg);
    toast({ title: "Copied!" });
  };

  const demoUrl = `${window.location.origin}/${row.slug}`;

  const StatCard = ({ icon: Icon, label, value, color }: { icon: typeof Eye; label: string; value: string | number; color: string }) => (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <div className={`rounded-md bg-muted p-2 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 p-4 bg-muted/30 border-t animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{row.business_name}</h3>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <a href={demoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              /{row.slug} <ExternalLink className="h-3 w-3" />
            </a>
            {row.country && <span>📍 {row.city ? `${row.city}, ` : ""}{row.country}</span>}
            <span className="inline-flex items-center gap-1"><DeviceIcon type={row.device_type} /> {row.browser} / {row.os}</span>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          First: {new Date(row.firstActivity).toLocaleDateString()} • Last: {new Date(row.lastActivity).toLocaleDateString()}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <StatCard icon={Eye} label="Page Views" value={row.linkOpened ? "Yes" : "No"} color="text-blue-500" />
        <StatCard icon={MessageCircle} label="Chatbot" value={row.chatbotClicked ? "Engaged" : "No"} color="text-green-500" />
        <StatCard icon={Phone} label="Voice Call" value={row.voiceClicked ? "Called" : "No"} color="text-orange-500" />
        <StatCard icon={MousePointer} label="Total Clicks" value={row.totalClicks} color="text-purple-500" />
        <StatCard icon={Clock} label="Total Time" value={row.totalDuration > 0 ? formatDuration(row.totalDuration) : "—"} color="text-teal-500" />
        <StatCard icon={TrendingUp} label="Active Time" value={row.totalActiveTime > 0 ? formatDuration(row.totalActiveTime) : "—"} color="text-emerald-500" />
      </div>

      {/* Engagement Details */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Engagement</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span>Scroll Depth</span>
                <span className={`font-medium ${row.maxScrollDepth >= 75 ? "text-green-600" : row.maxScrollDepth >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                  {row.maxScrollDepth > 0 ? `${row.maxScrollDepth}%` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Return Visits</span>
                <span className="font-medium">{row.returnVisits > 1 ? `${row.returnVisits}x` : "First visit"}</span>
              </div>
              <div className="flex justify-between">
                <span>Chat Score</span>
                <span className={`font-medium ${row.chatScore >= 70 ? "text-green-600" : row.chatScore >= 40 ? "text-yellow-600" : "text-muted-foreground"}`}>
                  {row.chatScore > 0 ? `${row.chatScore}/100` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Sessions</span>
                <span className="font-medium">{row.sessions.size}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Follow-up</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Badge className="text-[10px]">{row.followUp.problemLabel}</Badge>
              </div>
              <div className="bg-background rounded-md p-2 border">
                <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Suggested message:</p>
                <p className="text-xs italic">"{row.followUp.message}"</p>
              </div>
              <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={() => copyMessage(row.followUp.message)}>
                <Copy className="h-3 w-3" /> Copy Message
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activity Timeline</p>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              {events.slice(0, 20).map((e) => {
                const config = EVENT_ICONS[e.event_type] || { icon: Eye, color: "text-muted-foreground", label: e.event_type };
                const Icon = config.icon;
                const meta = (e.metadata as any) || {};
                let detail = "";
                if (e.event_type === "scroll_depth") detail = `${meta.depth_percent}%`;
                if (e.event_type === "session_end") detail = meta.duration_seconds ? formatDuration(meta.duration_seconds) : "";
                if (e.event_type === "click") detail = meta.element_text || "";

                return (
                  <div key={e.id} className="flex items-center gap-2 text-xs">
                    <Icon className={`h-3 w-3 shrink-0 ${config.color}`} />
                    <span className="truncate">{config.label}{detail ? ` — ${detail}` : ""}</span>
                    <span className="ml-auto text-muted-foreground whitespace-nowrap">
                      {new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
              {events.length === 0 && <p className="text-xs text-muted-foreground">No events</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientDetailPanel;
