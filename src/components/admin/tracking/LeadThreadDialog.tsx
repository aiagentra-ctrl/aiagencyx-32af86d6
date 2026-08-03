import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MousePointerClick, Eye, Phone, MessageSquare, CalendarClock, CalendarCheck,
  Mail, Reply, Layers, Loader2, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ThreadProspect = {
  id: string;
  email: string;
  firstname: string | null;
  company: string | null;
  country_code: string | null;
  engagement_tier: string;
  engagement_channel: string | null;
  demo_engagement_seconds: number;
  demo_link_clicked_at: string | null;
  demo_page_opened_at: string | null;
  voice_tried_at: string | null;
  chatbot_tried_at: string | null;
  calendly_clicked_at: string | null;
  calendly_booked_at: string | null;
  demo_sent_at?: string | null;
  followup_status: string;
};

type Item = {
  at: string;
  kind: "open" | "click" | "section" | "voice" | "chat" | "calendly" | "booked" | "sent" | "reply" | "visitor_msg" | "ai_msg";
  title: string;
  detail?: string;
  body?: string;
  tag?: string;
};

const ICONS: Record<Item["kind"], React.ReactNode> = {
  open: <Eye className="h-3.5 w-3.5" />,
  click: <MousePointerClick className="h-3.5 w-3.5" />,
  section: <Layers className="h-3.5 w-3.5" />,
  voice: <Phone className="h-3.5 w-3.5" />,
  chat: <MessageSquare className="h-3.5 w-3.5" />,
  calendly: <CalendarClock className="h-3.5 w-3.5" />,
  booked: <CalendarCheck className="h-3.5 w-3.5" />,
  sent: <Mail className="h-3.5 w-3.5" />,
  reply: <Reply className="h-3.5 w-3.5" />,
  visitor_msg: <MessageSquare className="h-3.5 w-3.5" />,
  ai_msg: <Bot className="h-3.5 w-3.5" />,
};

const TONE: Record<Item["kind"], string> = {
  open: "bg-muted text-muted-foreground",
  click: "bg-muted text-muted-foreground",
  section: "bg-muted text-muted-foreground",
  voice: "bg-blue-100 text-blue-700",
  chat: "bg-violet-100 text-violet-700",
  calendly: "bg-amber-100 text-amber-800",
  booked: "bg-emerald-100 text-emerald-800",
  sent: "bg-orange-100 text-orange-800",
  reply: "bg-sky-100 text-sky-800",
  visitor_msg: "bg-violet-100 text-violet-700",
  ai_msg: "bg-slate-200 text-slate-700",
};

const when = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const SEQ_STATUS: Record<string, { label: string; cls: string }> = {
  responded: { label: "Replied — stopped", cls: "bg-sky-100 text-sky-800" },
  booked: { label: "Booked — stopped", cls: "bg-emerald-100 text-emerald-800" },
  completed: { label: "Completed", cls: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
  active: { label: "Active", cls: "bg-orange-100 text-orange-800" },
};

interface Props {
  prospect: ThreadProspect | null;
  onOpenChange: (open: boolean) => void;
}

/** One lead = one thread. Every tracked event, sent follow-up and reply in a single timeline. */
const LeadThreadDialog = ({ prospect, onOpenChange }: Props) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [step, setStep] = useState(0);
  const [seqStatus, setSeqStatus] = useState<string>("");

  useEffect(() => {
    if (!prospect) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [demoRes, evRes, msgRes, enrRes] = await Promise.all([
        supabase.from("inbox_demos").select("demo_url").eq("prospect_id", prospect.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("followup_events").select("*").eq("prospect_id", prospect.id).order("created_at", { ascending: true }),
        supabase.from("inbox_messages").select("*").eq("prospect_id", prospect.id).order("created_at", { ascending: true }),
        supabase.from("follow_up_enrollments").select("current_step, status, started_at").eq("prospect_id", prospect.id).order("started_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const slug = (demoRes.data?.demo_url || "").split("?")[0].replace(/\/$/, "").split("/").pop() || "";
      const [linkRes, pageRes] = slug
        ? await Promise.all([
            supabase.from("link_events").select("*").eq("slug", slug).eq("is_self_traffic", false).order("created_at", { ascending: true }).limit(500),
            supabase.from("demo_pages").select("id").eq("slug", slug).maybeSingle(),
          ])
        : [{ data: [] as any[] }, { data: null as any }];

      // Full chatbot transcript for this lead's own demo page.
      const demoPageId = pageRes?.data?.id as string | undefined;
      let chatMessages: any[] = [];
      let chatConversations: any[] = [];
      if (demoPageId) {
        const { data: sessions } = await supabase
          .from("chatbot_sessions")
          .select("id, session_id, started_at")
          .eq("demo_page_id", demoPageId)
          .order("started_at", { ascending: true })
          .limit(50);
        const sessionRowIds = (sessions || []).map((s: any) => s.id);
        const sessionKeys = (sessions || []).map((s: any) => s.session_id).filter(Boolean);
        const [msgs, convos] = await Promise.all([
          sessionRowIds.length
            ? supabase.from("chatbot_messages").select("role, content, created_at").in("session_id", sessionRowIds).order("created_at", { ascending: true }).limit(500)
            : Promise.resolve({ data: [] as any[] }),
          sessionKeys.length
            ? supabase.from("chatbot_conversations").select("messages, created_at, updated_at").in("session_id", sessionKeys).limit(50)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        chatMessages = (msgs as any).data || [];
        chatConversations = (convos as any).data || [];
      }

      if (cancelled) return;

      const out: Item[] = [];



      for (const ev of (linkRes.data || []) as any[]) {
        const meta = (ev.metadata || {}) as Record<string, unknown>;
        const section = String(meta.section || meta.exit_section || "");
        switch (ev.event_type) {
          case "page_view":
          case "session_start":
            out.push({ at: ev.created_at, kind: "open", title: "Opened the demo page", detail: [ev.country_code, ev.city].filter(Boolean).join(" · ") });
            break;
          case "return_visit":
            out.push({ at: ev.created_at, kind: "open", title: "Returned to the page" });
            break;
          case "link_click":
            out.push({ at: ev.created_at, kind: "click", title: "Clicked the demo link" });
            break;
          case "voice_call_started":
          case "voice_engagement":
            out.push({ at: ev.created_at, kind: "voice", title: "Tried the voice agent", detail: meta.seconds ? `${Math.round(Number(meta.seconds))}s` : undefined });
            break;
          case "chatbot_opened":
          case "chatbot_message":
          case "chat_engagement":
            out.push({ at: ev.created_at, kind: "chat", title: ev.event_type === "chatbot_message" ? "Sent a chatbot message" : "Opened the chatbot", body: typeof meta.message === "string" ? meta.message : undefined });
            break;
          case "calendly_click":
            out.push({ at: ev.created_at, kind: "calendly", title: "Clicked into Calendly" });
            break;
          case "calendly_booked":
            out.push({ at: ev.created_at, kind: "booked", title: "Booked a call" });
            break;
          case "section_view":
          case "section_exit":
            if (section) out.push({ at: ev.created_at, kind: "section", title: `Reached “${section}”` });
            break;
          default:
            break;
        }
      }

      for (const ev of (evRes.data || []) as any[]) {
        if (!ev.sent_at && ev.status !== "sent") continue;
        out.push({
          at: ev.sent_at || ev.created_at,
          kind: "sent",
          title: `Follow-up sent — ${ev.message_subject || "(no subject)"}`,
          detail: `trigger: ${ev.trigger_key} · attempt ${ev.attempt}`,
          body: ev.message_body || undefined,
        });
      }

      for (const m of (msgRes.data || []) as any[]) {
        out.push({
          at: m.created_at,
          kind: m.direction === "incoming" ? "reply" : "sent",
          title: m.direction === "incoming" ? `Reply received — ${m.subject || "(no subject)"}` : `Email sent — ${m.subject || "(no subject)"}`,
          detail: m.classification ? `sentiment: ${m.classification}` : undefined,
          body: m.body || undefined,
        });
      }

      out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      setItems(out);
      setStep(enrRes.data?.current_step ?? 0);
      setSeqStatus(enrRes.data?.status ?? prospect.followup_status);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [prospect]);

  const status = useMemo(() => SEQ_STATUS[seqStatus] || { label: seqStatus || "—", cls: "bg-muted text-muted-foreground" }, [seqStatus]);

  return (
    <Dialog open={!!prospect} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            {prospect?.company || prospect?.firstname || prospect?.email}
          </DialogTitle>
        </DialogHeader>

        {prospect && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{prospect.firstname || "—"}</span>
            <span>·</span>
            <span>{prospect.email}</span>
            {prospect.country_code && <><span>·</span><span>{prospect.country_code}</span></>}
            <Badge variant="secondary" className="ml-1">{prospect.engagement_tier || "not_tried"}</Badge>
            <Badge variant="secondary">step {step}</Badge>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status.cls)}>{status.label}</span>
            {prospect.calendly_booked_at && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Booked</Badge>}
          </div>
        )}

        <ScrollArea className="mt-2 h-[60vh] pr-3">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No tracked activity for this lead yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-6">
              {items.map((it, i) => (
                <li key={i} className="relative">
                  <span className={cn("absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full", TONE[it.kind])}>
                    {ICONS[it.kind]}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-sm font-medium text-foreground">{it.title}</p>
                    <span className="text-xs text-muted-foreground">{when(it.at)}</span>
                  </div>
                  {it.detail && <p className="text-xs text-muted-foreground">{it.detail}</p>}
                  {it.body && (
                    <pre className="mt-1.5 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-foreground">{it.body}</pre>
                  )}
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default LeadThreadDialog;
