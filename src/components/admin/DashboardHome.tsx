import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  CalendarCheck,
  Flame,
  Inbox,
  Mail,
  MessageSquare,
  RefreshCw,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { adminFetchSafe } from "@/lib/adminData";
import { MetricCard, SectionHeader, EmptyState, Chip } from "@/components/primitives";
import { useShell } from "@/components/shell/ShellContext";
import { cn } from "@/lib/utils";

type Overview = {
  stats: {
    demos: number;
    chatbots: number;
    prospects: number;
    hotLeads: number;
    sessions: number;
    messages7: number;
    repliesToday: number;
    outboundToday: number;
    queued: number;
    sentFollowups7: number;
    errors24: number;
    bookings: number;
    demoOpens7: number;
    failedJobs: number;
  };
  funnel: {
    total: number;
    opened: number;
    triedVoice: number;
    triedChat: number;
    calendlyClicked: number;
    booked: number;
  };
  trend: { day: string; incoming: number; outgoing: number }[];
  recent: {
    messages: any[];
    sessions: any[];
    activity: any[];
    jobs: any[];
    notifications: any[];
  };
};

const EMPTY: Overview = {
  stats: {
    demos: 0, chatbots: 0, prospects: 0, hotLeads: 0, sessions: 0,
    messages7: 0, repliesToday: 0, outboundToday: 0, queued: 0,
    sentFollowups7: 0, errors24: 0, bookings: 0, demoOpens7: 0, failedJobs: 0,
  },
  funnel: { total: 0, opened: 0, triedVoice: 0, triedChat: 0, calendlyClicked: 0, booked: 0 },
  trend: [],
  recent: { messages: [], sessions: [], activity: [], jobs: [], notifications: [] },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function timeAgo(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
}

export default function DashboardHome() {
  const { setSection } = useShell();
  const [data, setData] = useState<Overview>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const out = await adminFetchSafe<Overview>("overview", EMPTY);
    setData({ ...EMPTY, ...out, stats: { ...EMPTY.stats, ...(out?.stats ?? {}) }, funnel: { ...EMPTY.funnel, ...(out?.funnel ?? {}) }, recent: { ...EMPTY.recent, ...(out?.recent ?? {}) } });
    setLoading(false);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = data.stats;

  const cards = useMemo(
    () => [
      { key: "demos", label: "Demos", value: s.demos, icon: <Zap className="h-4 w-4" />, tone: "default" as const, hint: "Live demo pages" },
      { key: "chatbots", label: "Chatbots", value: s.chatbots, icon: <Bot className="h-4 w-4" />, tone: "info" as const, hint: "Deployed assistants" },
      { key: "prospects", label: "Prospects", value: s.prospects, icon: <Users className="h-4 w-4" />, tone: "default" as const, hint: "In pipeline (real leads)" },
      { key: "sessions", label: "Chat sessions", value: s.sessions, icon: <MessageSquare className="h-4 w-4" />, tone: "info" as const, hint: "All-time conversations" },
      { key: "hotLeads", label: "Hot leads", value: s.hotLeads, icon: <Flame className="h-4 w-4" />, tone: "hot" as const, hint: "High engagement" },
      { key: "repliesToday", label: "Replies today", value: s.repliesToday, icon: <Inbox className="h-4 w-4" />, tone: "success" as const, hint: `${s.outboundToday} sent out today` },
      { key: "queued", label: "Queued follow-ups", value: s.queued, icon: <Mail className="h-4 w-4" />, tone: "warning" as const, hint: `${s.sentFollowups7} sent in 7d` },
      { key: "bookings", label: "Calls booked", value: s.bookings, icon: <CalendarCheck className="h-4 w-4" />, tone: "success" as const, hint: "Calendly bookings" },
    ],
    [s]
  );

  const funnelRows = useMemo(() => {
    const f = data.funnel;
    return [
      { label: "Prospects", value: f.total, tone: "bg-primary" },
      { label: "Opened demo", value: f.opened, tone: "bg-info" },
      { label: "Tried voice", value: f.triedVoice, tone: "bg-warning" },
      { label: "Tried chat", value: f.triedChat, tone: "bg-hot" },
      { label: "Calendly clicked", value: f.calendlyClicked, tone: "bg-success" },
      { label: "Booked", value: f.booked, tone: "bg-success" },
    ];
  }, [data.funnel]);

  const trend = useMemo(
    () =>
      data.trend.map((t) => ({
        ...t,
        label: new Date(t.day).toLocaleDateString(undefined, { weekday: "short" }),
      })),
    [data.trend]
  );

  const quickActions = [
    { label: "Open Inbox", icon: Inbox, section: "inbox" },
    { label: "View Leads", icon: UserCheck, section: "leads" },
    { label: "Follow-ups", icon: Mail, section: "sequences" },
    { label: "Tracking", icon: Activity, section: "tracking" },
  ];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            {greeting()}, welcome back.
          </h1>
          <p className="text-sm text-muted-foreground">
            Here's what's happening across your workspace right now.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {s.errors24 > 0 && (
            <Chip tone="danger">
              <AlertTriangle className="mr-1 inline h-3 w-3" />
              {s.errors24} errors (24h)
            </Chip>
          )}
          {s.failedJobs > 0 && <Chip tone="warning">{s.failedJobs} failed demo jobs</Chip>}
          <button
            onClick={() => { setLoading(true); load(); }}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-surface-1/60 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {cards.map((c) => (
          <motion.div
            key={c.key}
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
            }}
          >
            <MetricCard
              label={c.label}
              value={(c.value ?? 0).toLocaleString()}
              hint={c.hint}
              icon={c.icon}
              tone={c.tone}
              loading={loading}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Trend + Funnel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-xs lg:col-span-2">
          <SectionHeader
            eyebrow="Last 7 days"
            title="Message activity"
            description={`${s.messages7.toLocaleString()} messages · ${s.demoOpens7.toLocaleString()} demo opens`}
          />
          <div className="mt-4 h-64 w-full">
            {trend.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gIncoming" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gOutgoing" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Area type="monotone" dataKey="incoming" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gIncoming)" name="Replies in" />
                  <Area type="monotone" dataKey="outgoing" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#gOutgoing)" name="Sent out" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Funnel */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <SectionHeader eyebrow="Conversion" title="Lead funnel" description="From prospect to booked call." />
          <div className="mt-4 space-y-3">
            {funnelRows.map((r) => {
              const p = pct(r.value, data.funnel.total);
              return (
                <div key={r.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="tabular-nums font-medium text-foreground">
                      {r.value.toLocaleString()} <span className="text-muted-foreground">· {p}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className={cn("h-full rounded-full transition-all", r.tone)} style={{ width: `${Math.max(p, r.value > 0 ? 2 : 0)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent messages + conversations */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <SectionHeader eyebrow="Inbox" title="Recent messages" description="Latest inbound and outbound emails." />
          <div className="mt-4 space-y-2">
            {data.recent.messages.length === 0 ? (
              <EmptyState icon={<Inbox className="h-5 w-5" />} title="No messages yet" description="Replies will show up here." />
            ) : (
              data.recent.messages.map((m: any) => (
                <button
                  key={m.id}
                  onClick={() => setSection("inbox")}
                  className="flex w-full items-start gap-3 rounded-lg border bg-surface-1/60 p-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", m.direction === "incoming" ? "bg-info" : "bg-success")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {m.subject || (m.direction === "incoming" ? "Prospect replied" : "Reply sent")}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(m.created_at)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{(m.body ?? "").slice(0, 120)}</p>
                    {m.classification && <Chip tone="default" className="mt-1.5">{m.classification}</Chip>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <SectionHeader eyebrow="Chatbot" title="Recent conversations" description="Latest demo chat sessions." />
          <div className="mt-4 space-y-2">
            {data.recent.sessions.length === 0 ? (
              <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No sessions yet" description="Chat sessions will show up here." />
            ) : (
              data.recent.sessions.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSection("conversations")}
                  className="flex w-full items-start gap-3 rounded-lg border bg-surface-1/60 p-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{c.business_name || c.session_id}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(c.last_message_at)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.total_messages ?? 0} messages{c.outcome ? ` · ${c.outcome}` : ""}{c.sentiment ? ` · ${c.sentiment}` : ""}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* System activity + demo jobs + notifications */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <SectionHeader eyebrow="System" title="Activity log" description="Recent backend events." />
          <div className="mt-4 space-y-2">
            {data.recent.activity.length === 0 ? (
              <EmptyState icon={<Activity className="h-5 w-5" />} title="Nothing yet" description="Events will appear here." />
            ) : (
              data.recent.activity.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 rounded-lg border bg-surface-1/60 p-3">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.status === "error" || a.status === "failed" ? "bg-danger" : a.status === "success" ? "bg-success" : "bg-primary")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{a.event_type}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <SectionHeader eyebrow="Demos" title="Demo jobs" description="Latest build attempts." />
          <div className="mt-4 space-y-2">
            {data.recent.jobs.length === 0 ? (
              <EmptyState icon={<Zap className="h-5 w-5" />} title="No jobs yet" description="Demo builds will appear here." />
            ) : (
              data.recent.jobs.map((j: any) => (
                <button
                  key={j.id}
                  onClick={() => setSection("health")}
                  className="flex w-full items-start gap-3 rounded-lg border bg-surface-1/60 p-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", j.status === "failed" ? "bg-danger" : j.status === "partial" ? "bg-warning" : j.status === "completed" ? "bg-success" : "bg-primary")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{j.business_name || "Untitled"}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(j.created_at)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{j.last_error || j.status}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <SectionHeader eyebrow="Alerts" title="Notifications" description="Unread items needing attention." />
          <div className="mt-4 space-y-2">
            {data.recent.notifications.length === 0 ? (
              <EmptyState icon={<Bell className="h-5 w-5" />} title="All clear" description="No unread notifications." />
            ) : (
              data.recent.notifications.map((n: any) => (
                <div key={n.id} className="flex items-start gap-3 rounded-lg border bg-surface-1/60 p-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warning" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{n.type}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <SectionHeader eyebrow="Shortcuts" title="Quick actions" description="Jump straight into the tools you use most." />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((qa) => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.section}
                onClick={() => setSection(qa.section)}
                className={cn(
                  "group relative flex items-center justify-between gap-3 overflow-hidden rounded-lg border bg-surface-1/60 p-4 text-left transition-all",
                  "hover:border-primary/40 hover:bg-surface-2 lift"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-md border bg-background/70 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{qa.label}</span>
                </div>
                <Chip tone="default">→</Chip>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
