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
  Bot,
  Flame,
  Inbox,
  Mail,
  MessageSquare,
  Sparkles,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard, SectionHeader, EmptyState, Chip } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { useShell } from "@/components/shell/ShellContext";
import { cn } from "@/lib/utils";

type StatKey =
  | "demos"
  | "chatbots"
  | "prospects"
  | "conversations"
  | "hotLeads"
  | "repliesToday"
  | "queuedFollowups"
  | "errors24h";

type Stats = Record<StatKey, number>;

type TrendPoint = { day: string; label: string; messages: number; replies: number };

type ActivityItem = {
  id: string;
  kind: "message" | "pipeline" | "error";
  title: string;
  meta?: string;
  at: string;
  tone?: "default" | "success" | "warning" | "danger" | "info" | "hot";
};

const EMPTY_STATS: Stats = {
  demos: 0,
  chatbots: 0,
  prospects: 0,
  conversations: 0,
  hotLeads: 0,
  repliesToday: 0,
  queuedFollowups: 0,
  errors24h: 0,
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function DashboardHome() {
  const { setSection } = useShell();
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const load = async () => {
    const now = new Date();
    const dayStart = startOfDay(now).toISOString();
    const day7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const day7Start = startOfDay(day7).toISOString();
    const hour24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const [
      demosRes,
      chatbotsRes,
      prospectsRes,
      conversationsRes,
      hotRes,
      repliesTodayRes,
      queuedRes,
      errorsRes,
      msgs7,
      recentMsgs,
      recentPipeline,
      recentErrors,
    ] = await Promise.all([
      supabase.from("demo_pages").select("id", { count: "exact", head: true }),
      supabase.from("chatbots").select("id", { count: "exact", head: true }),
      supabase.from("prospects").select("id", { count: "exact", head: true }),
      supabase.from("chatbot_conversations").select("id", { count: "exact", head: true }),
      supabase.from("prospects").select("id", { count: "exact", head: true }).eq("is_hot_lead", true),
      supabase
        .from("inbox_messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "outbound")
        .gte("created_at", dayStart),
      supabase
        .from("follow_up_enrollments")
        .select("id", { count: "exact", head: true })
        .in("status", ["active", "scheduled", "queued"]),
      supabase
        .from("error_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", hour24),
      supabase
        .from("inbox_messages")
        .select("id,direction,created_at")
        .gte("created_at", day7Start)
        .limit(2000),
      supabase
        .from("inbox_messages")
        .select("id,direction,body,created_at,prospect_id")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("pipeline_events")
        .select("id,node,status,created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("error_events")
        .select("id,message,source,created_at")
        .order("created_at", { ascending: false })
        .limit(4),
    ]);

    setStats({
      demos: demosRes.count ?? 0,
      chatbots: chatbotsRes.count ?? 0,
      prospects: prospectsRes.count ?? 0,
      conversations: conversationsRes.count ?? 0,
      hotLeads: hotRes.count ?? 0,
      repliesToday: repliesTodayRes.count ?? 0,
      queuedFollowups: queuedRes.count ?? 0,
      errors24h: errorsRes.count ?? 0,
    });

    // Build 7-day trend
    const buckets: Record<string, { messages: number; replies: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = startOfDay(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
      buckets[d.toISOString().slice(0, 10)] = { messages: 0, replies: 0 };
    }
    (msgs7.data ?? []).forEach((row: any) => {
      const key = new Date(row.created_at).toISOString().slice(0, 10);
      if (!buckets[key]) return;
      buckets[key].messages += 1;
      if (row.direction === "outbound") buckets[key].replies += 1;
    });
    const trendPoints: TrendPoint[] = Object.entries(buckets).map(([day, v]) => ({
      day,
      label: new Date(day).toLocaleDateString(undefined, { weekday: "short" }),
      messages: v.messages,
      replies: v.replies,
    }));
    setTrend(trendPoints);

    // Merge activity feed
    const feed: ActivityItem[] = [];
    (recentMsgs.data ?? []).forEach((m: any) =>
      feed.push({
        id: `m-${m.id}`,
        kind: "message",
        title:
          m.direction === "inbound"
            ? "Prospect replied"
            : "Reply sent",
        meta: (m.body ?? "").slice(0, 90),
        at: m.created_at,
        tone: m.direction === "inbound" ? "info" : "success",
      })
    );
    (recentPipeline.data ?? []).forEach((p: any) =>
      feed.push({
        id: `p-${p.id}`,
        kind: "pipeline",
        title: `Pipeline · ${p.node}`,
        meta: p.status,
        at: p.created_at,
        tone: p.status === "error" || p.status === "failed" ? "danger" : "default",
      })
    );
    (recentErrors.data ?? []).forEach((e: any) =>
      feed.push({
        id: `e-${e.id}`,
        kind: "error",
        title: e.source ? `Error · ${e.source}` : "Error",
        meta: e.message,
        at: e.created_at,
        tone: "danger",
      })
    );
    feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setActivity(feed.slice(0, 12));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-home-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inbox_messages" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pipeline_events" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "error_events" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = useMemo(
    () => [
      { key: "demos", label: "Demos", value: stats.demos, icon: <Zap className="h-4 w-4" />, tone: "default" as const, hint: "Live demo pages" },
      { key: "chatbots", label: "Chatbots", value: stats.chatbots, icon: <Bot className="h-4 w-4" />, tone: "info" as const, hint: "Deployed assistants" },
      { key: "prospects", label: "Prospects", value: stats.prospects, icon: <Users className="h-4 w-4" />, tone: "default" as const, hint: "In pipeline" },
      { key: "conversations", label: "Conversations", value: stats.conversations, icon: <MessageSquare className="h-4 w-4" />, tone: "info" as const, hint: "All-time threads" },
      { key: "hotLeads", label: "Hot leads", value: stats.hotLeads, icon: <Flame className="h-4 w-4" />, tone: "hot" as const, hint: "High engagement" },
      { key: "repliesToday", label: "Replies today", value: stats.repliesToday, icon: <Mail className="h-4 w-4" />, tone: "success" as const, hint: "Outbound sent" },
      { key: "queuedFollowups", label: "Queued follow-ups", value: stats.queuedFollowups, icon: <Activity className="h-4 w-4" />, tone: "warning" as const, hint: "Waiting to send" },
      { key: "errors24h", label: "Errors (24h)", value: stats.errors24h, icon: <Sparkles className="h-4 w-4" />, tone: stats.errors24h > 0 ? ("danger" as const) : ("default" as const), hint: "Pipeline failures" },
    ],
    [stats]
  );

  const quickActions = [
    { label: "Open Inbox", icon: Inbox, section: "inbox", tone: "primary" as const },
    { label: "View Leads", icon: UserCheck, section: "leads" },
    { label: "Follow-ups", icon: Mail, section: "sequences" },
    { label: "Demos", icon: Zap, section: "demos" },
  ];

  return (
    <div className="space-y-8">
      {/* Greeting */}
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

      {/* Stat cards */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.04 } },
        }}
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
              value={c.value.toLocaleString()}
              hint={c.hint}
              icon={c.icon}
              tone={c.tone}
              loading={loading}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Trend + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 7-day trend */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-xs">
          <SectionHeader
            eyebrow="Last 7 days"
            title="Message activity"
            description="Inbound vs outbound across every prospect thread."
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
                    <linearGradient id="gMessages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gReplies" x1="0" y1="0" x2="0" y2="1">
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
                  <Area
                    type="monotone"
                    dataKey="messages"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#gMessages)"
                    name="Messages"
                  />
                  <Area
                    type="monotone"
                    dataKey="replies"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    fill="url(#gReplies)"
                    name="Replies"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Activity feed */}
        <div className="rounded-xl border bg-card p-5 shadow-xs">
          <SectionHeader
            eyebrow="Live"
            title="Activity"
            description="Realtime pipeline & inbox events."
          />
          <div className="mt-4 space-y-3">
            {activity.length === 0 ? (
              <EmptyState
                icon={<Activity className="h-5 w-5" />}
                title="Nothing yet"
                description="Activity will appear here as it happens."
              />
            ) : (
              activity.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                  className="flex items-start gap-3 rounded-lg border bg-surface-1/60 p-3"
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      a.tone === "success" && "bg-success",
                      a.tone === "info" && "bg-info",
                      a.tone === "danger" && "bg-danger",
                      a.tone === "warning" && "bg-warning",
                      a.tone === "hot" && "bg-hot animate-pulse-soft",
                      (!a.tone || a.tone === "default") && "bg-primary"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(a.at), { addSuffix: true })}
                      </span>
                    </div>
                    {a.meta && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.meta}</p>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <SectionHeader
          eyebrow="Shortcuts"
          title="Quick actions"
          description="Jump straight into the tools you use most."
        />
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