import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Send, Clock, MessageSquare, Activity, FileText } from "lucide-react";

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
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
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

const LeadDetailView = ({ lead, open, onOpenChange, onUpdated }: LeadDetailViewProps) => {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newStage, setNewStage] = useState("reminder");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [nextDate, setNextDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lead || !open) return;
    setNotes(lead.notes || "");
    setStatus(lead.status);
    setNextDate(lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : undefined);
    loadData(lead);
  }, [lead, open]);

  const loadData = async (l: Lead) => {
    const [fuRes, evRes, chatRes] = await Promise.all([
      supabase.from("lead_follow_ups").select("*").eq("lead_id", l.id).order("created_at", { ascending: false }),
      supabase.from("link_events").select("*").eq("slug", l.slug).order("created_at", { ascending: false }).limit(50),
      supabase.from("chatbot_conversations").select("*").order("created_at", { ascending: false }).limit(5),
    ]);
    if (fuRes.data) setFollowUps(fuRes.data as unknown as FollowUp[]);
    if (evRes.data) setEvents(evRes.data);
    // Filter conversations that match this slug's chatbot
    if (chatRes.data) setChatMessages(chatRes.data);
  };

  const addFollowUp = async () => {
    if (!lead || !newMessage.trim()) return;
    setSaving(true);
    await supabase.from("lead_follow_ups").insert({ lead_id: lead.id, message: newMessage, stage: newStage });
    await supabase.from("leads").update({
      follow_up_count: lead.follow_up_count + 1,
      last_follow_up_at: new Date().toISOString(),
    }).eq("id", lead.id);
    setNewMessage("");
    await loadData(lead);
    onUpdated();
    toast({ title: "Follow-up added" });
    setSaving(false);
  };

  const saveChanges = async () => {
    if (!lead) return;
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

  if (!lead) return null;

  const stageColor = (s: string) => {
    if (s === "reminder") return "bg-blue-100 text-blue-800";
    if (s === "nudge") return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {lead.business_name}
            <Badge variant="outline" className="text-xs">{lead.slug}</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Status + Next Follow-up */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Next Follow-up</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !nextDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {nextDate ? format(nextDate, "PPP") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={nextDate} onSelect={setNextDate} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={saveChanges} disabled={saving} size="sm">Save</Button>
        </div>

        <Tabs defaultValue="follow_ups" className="mt-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="follow_ups"><Send className="mr-1 h-3 w-3" />Follow-ups</TabsTrigger>
            <TabsTrigger value="activity"><Activity className="mr-1 h-3 w-3" />Activity</TabsTrigger>
            <TabsTrigger value="chat"><MessageSquare className="mr-1 h-3 w-3" />Chat</TabsTrigger>
            <TabsTrigger value="notes"><FileText className="mr-1 h-3 w-3" />Notes</TabsTrigger>
          </TabsList>

          {/* Follow-ups Tab */}
          <TabsContent value="follow_ups" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Add Follow-up</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="What did you say/send?"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Select value={newStage} onValueChange={setNewStage}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={addFollowUp} disabled={saving || !newMessage.trim()} size="sm" className="gap-1">
                    <Send className="h-3 w-3" /> Send
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No follow-ups yet</p>
              ) : followUps.map(fu => (
                <div key={fu.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stageColor(fu.stage)}`}>
                        {fu.stage}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(fu.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{fu.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No activity recorded</p>
              ) : events.map((ev: any) => (
                <div key={ev.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                  <Badge variant="outline" className="text-xs shrink-0">{ev.event_type}</Badge>
                  <span className="text-muted-foreground text-xs">{new Date(ev.created_at).toLocaleString()}</span>
                  {ev.city && <span className="text-xs text-muted-foreground ml-auto">{ev.city}, {ev.country_code}</span>}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {chatMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No chat history</p>
              ) : chatMessages.map((conv: any) => {
                const msgs = Array.isArray(conv.messages) ? conv.messages : [];
                return (
                  <Card key={conv.id}>
                    <CardContent className="p-3 space-y-1">
                      <p className="text-xs text-muted-foreground mb-2">Session: {conv.session_id?.slice(0, 8)}… • {new Date(conv.created_at).toLocaleString()}</p>
                      {msgs.slice(0, 6).map((m: any, i: number) => (
                        <div key={i} className={`text-xs rounded p-1.5 ${m.role === "user" ? "bg-muted" : "bg-primary/5"}`}>
                          <span className="font-medium">{m.role}: </span>{typeof m.content === "string" ? m.content.slice(0, 200) : ""}
                        </div>
                      ))}
                      {msgs.length > 6 && <p className="text-xs text-muted-foreground">+{msgs.length - 6} more messages</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-3">
            <Textarea
              placeholder="Add notes about this lead..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={5}
            />
            <Button onClick={saveChanges} disabled={saving} size="sm">Save Notes</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailView;
