import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Send, Clock, MessageSquare, Activity, FileText, X, ChevronDown } from "lucide-react";

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

interface FollowUp {
  id: string;
  message: string;
  stage: string;
  created_at: string;
}

interface LeadDetailViewProps {
  lead: Lead;
  onUpdated: () => void;
  onClose: () => void;
}

const STATUSES = [
  { value: "needs_follow_up", label: "Needs Follow-up" },
  { value: "interested", label: "Interested" },
  { value: "awaiting_response", label: "Awaiting Response" },
  { value: "engaged", label: "Engaged" },
  { value: "call_scheduled", label: "Call Scheduled" },
  { value: "cold_lead", label: "Cold Lead" },
];

const STAGES = [
  { value: "reminder", label: "Reminder" },
  { value: "nudge", label: "Nudge" },
  { value: "final", label: "Final Follow-up" },
];

const LeadDetailView = ({ lead, onUpdated, onClose }: LeadDetailViewProps) => {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newStage, setNewStage] = useState("reminder");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [nextDate, setNextDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"thread" | "activity" | "chat" | "notes">("thread");

  useEffect(() => {
    setNotes(lead.notes || "");
    setStatus(lead.status);
    setNextDate(lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : undefined);
    loadData(lead);
  }, [lead.id]);

  const loadData = async (l: Lead) => {
    const [fuRes, evRes, chatRes] = await Promise.all([
      supabase.from("lead_follow_ups").select("*").eq("lead_id", l.id).order("created_at", { ascending: true }),
      supabase.from("link_events").select("*").eq("slug", l.slug).order("created_at", { ascending: false }).limit(50),
      supabase.from("chatbot_conversations").select("*").order("created_at", { ascending: false }).limit(5),
    ]);
    if (fuRes.data) setFollowUps(fuRes.data as unknown as FollowUp[]);
    if (evRes.data) setEvents(evRes.data);
    if (chatRes.data) setChatMessages(chatRes.data);
  };

  const addFollowUp = async () => {
    if (!newMessage.trim()) return;
    setSaving(true);
    await supabase.from("lead_follow_ups").insert({ lead_id: lead.id, message: newMessage, stage: newStage });
    await supabase.from("leads").update({
      follow_up_count: lead.follow_up_count + 1,
      last_follow_up_at: new Date().toISOString(),
    }).eq("id", lead.id);
    setNewMessage("");
    await loadData(lead);
    onUpdated();
    toast({ title: "Follow-up sent" });
    setSaving(false);
  };

  const saveChanges = async () => {
    setSaving(true);
    await supabase.from("leads").update({
      status,
      notes,
      next_follow_up_at: nextDate?.toISOString() || null,
    }).eq("id", lead.id);
    onUpdated();
    toast({ title: "Lead updated" });
    setSaving(false);
  };

  const stageColor = (s: string) => {
    if (s === "reminder") return "bg-blue-100 text-blue-800 border-blue-200";
    if (s === "nudge") return "bg-orange-100 text-orange-800 border-orange-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const tabs = [
    { key: "thread" as const, label: "Thread", icon: Send },
    { key: "activity" as const, label: "Activity", icon: Activity },
    { key: "chat" as const, label: "Chat", icon: MessageSquare },
    { key: "notes" as const, label: "Notes", icon: FileText },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">{lead.business_name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">/{lead.slug} · Added {format(new Date(lead.created_at), "MMM d, yyyy")}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Status + Next Follow-up row */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={status} onValueChange={v => { setStatus(v); }}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", !nextDate && "text-muted-foreground")}>
                <CalendarIcon className="h-3 w-3" />
                {nextDate ? format(nextDate, "MMM d") : "Reminder"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={nextDate} onSelect={setNextDate} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Button onClick={saveChanges} disabled={saving} size="sm" className="h-8 text-xs">
            Save
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b px-5 bg-card">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Thread Tab - Email-style conversation */}
        {activeTab === "thread" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {followUps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Send className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">No follow-ups yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Send your first message below</p>
                </div>
              ) : followUps.map(fu => (
                <div key={fu.id} className="group">
                  <div className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", stageColor(fu.stage))}>
                        {fu.stage}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {format(new Date(fu.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{fu.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Compose area */}
            <div className="border-t p-4 bg-card">
              <Textarea
                placeholder="Write a follow-up message..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                rows={2}
                className="resize-none text-sm mb-2"
              />
              <div className="flex items-center gap-2">
                <Select value={newStage} onValueChange={setNewStage}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  onClick={addFollowUp}
                  disabled={saving || !newMessage.trim()}
                  size="sm"
                  className="h-8 gap-1.5 ml-auto"
                >
                  <Send className="h-3 w-3" /> Send
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div className="p-5 space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No activity recorded</p>
            ) : events.map((ev: any) => (
              <div key={ev.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm bg-card">
                <Badge variant="outline" className="text-[10px] shrink-0">{ev.event_type}</Badge>
                <span className="text-muted-foreground text-xs">{format(new Date(ev.created_at), "MMM d, h:mm a")}</span>
                {ev.city && <span className="text-xs text-muted-foreground ml-auto">{ev.city}, {ev.country_code}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === "chat" && (
          <div className="p-5 space-y-3">
            {chatMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No chat history</p>
            ) : chatMessages.map((conv: any) => {
              const msgs = Array.isArray(conv.messages) ? conv.messages : [];
              return (
                <div key={conv.id} className="rounded-lg border bg-card p-4">
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Session {conv.session_id?.slice(0, 8)}… · {format(new Date(conv.created_at), "MMM d, h:mm a")}
                  </p>
                  <div className="space-y-1.5">
                    {msgs.slice(0, 6).map((m: any, i: number) => (
                      <div key={i} className={cn("text-xs rounded-md p-2", m.role === "user" ? "bg-muted" : "bg-primary/5")}>
                        <span className="font-medium">{m.role}: </span>
                        {typeof m.content === "string" ? m.content.slice(0, 200) : ""}
                      </div>
                    ))}
                    {msgs.length > 6 && <p className="text-[10px] text-muted-foreground">+{msgs.length - 6} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <div className="p-5 space-y-3">
            <Textarea
              placeholder="Add notes about this lead..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={8}
              className="resize-none text-sm"
            />
            <Button onClick={saveChanges} disabled={saving} size="sm" className="h-8">
              Save Notes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadDetailView;
