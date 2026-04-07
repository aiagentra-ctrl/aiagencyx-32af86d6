import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Eye, MessageCircle, Phone, MousePointer, Clock, Globe, Monitor,
  Smartphone, Tablet, TrendingUp, CheckCircle2, XCircle, ArrowDown,
  RotateCcw, Zap
} from "lucide-react";

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
  followUp: {
    problem: string;
    problemLabel: string;
    message: string;
    action: string;
    detail: string;
  };
  totalDuration: number;
  totalActiveTime: number;
  sessionCount: number;
  maxScrollDepth: number;
  returnVisits: number;
  chatScore: number;
  topClicks: { element: string; text: string; count: number }[];
}

interface Props {
  client: ClientRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TimelineEvent {
  id: string;
  event_type: string;
  created_at: string;
  metadata: any;
}

interface ChatMessage {
  role: string;
  content: string;
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
};

const EVENT_ICONS: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  page_view: { icon: <Eye className="h-3.5 w-3.5" />, label: "Page View", color: "text-blue-500" },
  session_start: { icon: <Zap className="h-3.5 w-3.5" />, label: "Session Start", color: "text-green-500" },
  session_end: { icon: <Clock className="h-3.5 w-3.5" />, label: "Session End", color: "text-muted-foreground" },
  chatbot_opened: { icon: <MessageCircle className="h-3.5 w-3.5" />, label: "Chatbot Opened", color: "text-green-500" },
  chatbot_message: { icon: <MessageCircle className="h-3.5 w-3.5" />, label: "Chat Message", color: "text-green-600" },
  voice_call_started: { icon: <Phone className="h-3.5 w-3.5" />, label: "Voice Call", color: "text-orange-500" },
  cta_clicked: { icon: <MousePointer className="h-3.5 w-3.5" />, label: "CTA Click", color: "text-purple-500" },
  scroll_depth: { icon: <ArrowDown className="h-3.5 w-3.5" />, label: "Scroll", color: "text-teal-500" },
  return_visit: { icon: <RotateCcw className="h-3.5 w-3.5" />, label: "Return Visit", color: "text-purple-500" },
  click: { icon: <MousePointer className="h-3.5 w-3.5" />, label: "Click", color: "text-indigo-500" },
};

const DeviceIcon = ({ type }: { type: string }) => {
  if (type === "mobile") return <Smartphone className="h-4 w-4" />;
  if (type === "tablet") return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
};

const YesNo = ({ value, label }: { value: boolean; label: string }) => (
  <div className="flex items-center gap-1.5 text-sm">
    {value ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
    <span className={value ? "text-foreground" : "text-muted-foreground"}>{label}</span>
  </div>
);

const ClientDetailCard = ({ client, open, onOpenChange }: Props) => {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  useEffect(() => {
    if (!client || !open) return;
    
    const fetchTimeline = async () => {
      setLoadingTimeline(true);
      const { data } = await supabase
        .from("link_events")
        .select("id, event_type, created_at, metadata")
        .eq("slug", client.slug)
        .order("created_at", { ascending: true })
        .limit(200);
      setTimeline((data as unknown as TimelineEvent[]) || []);
      setLoadingTimeline(false);
    };

    const fetchChat = async () => {
      setLoadingChat(true);
      const { data: chatbots } = await supabase
        .from("chatbots")
        .select("id")
        .eq("slug", client.slug)
        .limit(1);

      if (chatbots && chatbots.length > 0) {
        const { data: convos } = await supabase
          .from("chatbot_conversations")
          .select("messages")
          .eq("chatbot_id", chatbots[0].id)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (convos && convos.length > 0) {
          const msgs = convos[0].messages;
          setChatHistory(Array.isArray(msgs) ? (msgs as ChatMessage[]) : []);
        } else {
          setChatHistory([]);
        }
      } else {
        setChatHistory([]);
      }
      setLoadingChat(false);
    };

    fetchTimeline();
    fetchChat();
  }, [client, open]);

  if (!client) return null;

  const scrollColor = client.maxScrollDepth >= 75 ? "text-green-600" : client.maxScrollDepth >= 50 ? "text-yellow-600" : "text-red-600";
  const chatColor = client.chatScore >= 70 ? "text-green-600" : client.chatScore >= 40 ? "text-yellow-600" : "text-red-600";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{client.business_name}</span>
            <Badge variant="outline" className="text-xs font-normal">/{client.slug}</Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 pb-4">
            {/* Overview Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="text-2xl font-bold">{client.totalClicks}</div>
                  <div className="text-xs text-muted-foreground">Total Clicks</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="text-2xl font-bold">{client.sessions.size}</div>
                  <div className="text-xs text-muted-foreground">Unique Users</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="text-2xl font-bold">{client.totalDuration > 0 ? formatDuration(client.totalDuration) : "—"}</div>
                  <div className="text-xs text-muted-foreground">Total Time</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="text-2xl font-bold">{client.totalActiveTime > 0 ? formatDuration(client.totalActiveTime) : "—"}</div>
                  <div className="text-xs text-muted-foreground">Active Time</div>
                </CardContent>
              </Card>
            </div>

            {/* Details Row */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Client Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">Location</span>
                    <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5 text-muted-foreground" /> {client.city && client.country ? `${client.city}, ${client.country}` : client.country || "Unknown"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Device</span>
                    <span className="flex items-center gap-1"><DeviceIcon type={client.device_type} /> {client.browser} / {client.os}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">First Visit</span>
                    <span>{new Date(client.firstActivity).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Last Visit</span>
                    <span>{new Date(client.lastActivity).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Return Visits</span>
                    <span>{client.returnVisits > 1 ? `${client.returnVisits}x` : "First visit"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Scroll Depth</span>
                    <span className={`font-medium ${client.maxScrollDepth > 0 ? scrollColor : "text-muted-foreground"}`}>
                      {client.maxScrollDepth > 0 ? `${client.maxScrollDepth}%` : "—"}
                    </span>
                  </div>
                </div>

                <Separator className="my-3" />

                <div className="flex flex-wrap gap-4">
                  <YesNo value={client.linkOpened} label="Link Opened" />
                  <YesNo value={client.websiteViewed} label="Website Viewed" />
                  <YesNo value={client.chatbotClicked} label="Used Chatbot" />
                  <YesNo value={client.voiceClicked} label="Used Voice Agent" />
                </div>

                <Separator className="my-3" />

                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-muted-foreground text-xs">Status</span>
                    <div className="mt-0.5">
                      <Badge className={
                        client.followUp.problem === "multiple_clicks" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                        client.followUp.problem === "clicked_no_action" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
                        "bg-red-500/10 text-red-600 border-red-500/20"
                      }>{client.followUp.problemLabel}</Badge>
                    </div>
                  </div>
                  {client.chatScore > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">Chat Score</span>
                      <div className={`mt-0.5 font-semibold ${chatColor}`}>{client.chatScore}/100</div>
                    </div>
                  )}
                  <div className="flex-1">
                    <span className="text-muted-foreground text-xs">Suggested Follow-up</span>
                    <p className="mt-0.5 text-sm italic">"{client.followUp.message}"</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Activity Timeline
                  <Badge variant="outline" className="text-[10px] ml-auto">{timeline.length} events</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTimeline ? (
                  <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                ) : timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No events recorded.</p>
                ) : (
                  <div className="relative space-y-0">
                    {/* Timeline line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                    {timeline.map((event, i) => {
                      const config = EVENT_ICONS[event.event_type] || { icon: <Zap className="h-3.5 w-3.5" />, label: event.event_type, color: "text-muted-foreground" };
                      const meta = event.metadata || {};
                      let detail = "";
                      if (event.event_type === "scroll_depth") detail = `${meta.depth_percent}%`;
                      if (event.event_type === "session_end") detail = meta.duration_seconds ? formatDuration(meta.duration_seconds) : "";
                      if (event.event_type === "click") detail = meta.text ? `"${meta.text}"` : meta.element || "";
                      if (event.event_type === "return_visit") detail = `Visit #${meta.total_visits || ""}`;

                      return (
                        <div key={event.id} className="flex items-start gap-3 py-1.5 relative">
                          <div className={`z-10 flex h-4 w-4 items-center justify-center rounded-full bg-background border ${config.color}`}>
                            {config.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{config.label}</span>
                              {detail && <span className="text-xs text-muted-foreground">— {detail}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {i === 0 || new Date(event.created_at).toDateString() !== new Date(timeline[i - 1].created_at).toDateString()
                              ? ` · ${new Date(event.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}`
                              : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chat History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" /> Chat History
                  <Badge variant="outline" className="text-[10px] ml-auto">{chatHistory.length} messages</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingChat ? (
                  <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                ) : chatHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No chat conversations found.</p>
                ) : (
                  <div className="space-y-2">
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}>
                          <div className="text-[10px] font-medium mb-0.5 opacity-70">
                            {msg.role === "user" ? "Customer" : "AI Assistant"}
                          </div>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ClientDetailCard;
