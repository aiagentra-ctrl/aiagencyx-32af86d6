import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminFetchSafe } from "@/lib/adminData";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, RefreshCw, Flame, Thermometer, Snowflake, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import LeadThreadDialog from "./tracking/LeadThreadDialog";

type Prospect = {
  id: string;
  email: string;
  firstname: string | null;
  company: string | null;
  country_code: string | null;
  is_self_traffic: boolean;
  engagement_tier: string;
  engagement_channel: string | null;
  demo_engagement_seconds: number;
  demo_link_clicked_at: string | null;
  demo_page_opened_at: string | null;
  voice_tried_at: string | null;
  chatbot_tried_at: string | null;
  calendly_clicked_at: string | null;
  calendly_booked_at: string | null;
  last_activity_at: string | null;
  followup_status: string;
  created_at: string;
};

type Enrollment = { prospect_id: string; current_step: number; status: string };

type LinkEvent = {
  slug: string;
  session_id: string | null;
  event_type: string;
  is_self_traffic: boolean;
  metadata: Record<string, unknown> | null;
};

type SortKey = "step" | "booked" | "last_activity" | "company";

const TEMP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  warm: { label: "Warm", cls: "bg-orange-100 text-orange-800 border-orange-300", icon: <Flame className="h-3 w-3" /> },
  tried: { label: "Tried", cls: "bg-blue-100 text-blue-800 border-blue-300", icon: <Thermometer className="h-3 w-3" /> },
  not_tried: { label: "Cold", cls: "bg-muted text-muted-foreground border-border", icon: <Snowflake className="h-3 w-3" /> },
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

const TrackingPage = () => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [events, setEvents] = useState<LinkEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [temp, setTemp] = useState("all");
  const [country, setCountry] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("last_activity");
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState<Prospect | null>(null);


  const load = async () => {
    setLoading(true);
    const d = await adminFetchSafe("tracking", {
      prospects: [] as any[], link_events: [] as any[], enrollments: [] as any[],
    });
    setProspects((d.prospects || []) as unknown as Prospect[]);
    setEnrollments((d.enrollments || []) as unknown as Enrollment[]);
    setEvents((d.link_events || []) as unknown as LinkEvent[]);
    setLoading(false);
  };


  useEffect(() => { load(); }, []);

  const stepOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const en of enrollments) m.set(en.prospect_id, Math.max(m.get(en.prospect_id) ?? 0, en.current_step));
    return m;
  }, [enrollments]);

  const countries = useMemo(
    () => Array.from(new Set(prospects.map((p) => p.country_code).filter(Boolean) as string[])).sort(),
    [prospects],
  );

  const rows = useMemo(() => {
    const filtered = prospects
      .filter((p) => !p.is_self_traffic)
      .filter((p) => temp === "all" || (p.engagement_tier || "not_tried") === temp)
      .filter((p) => country === "all" || p.country_code === country)
      .filter((p) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return [p.company, p.firstname, p.email].some((v) => (v || "").toLowerCase().includes(q));
      });

    const dir = sortAsc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "step":
          return ((stepOf.get(a.id) ?? 0) - (stepOf.get(b.id) ?? 0)) * dir;
        case "booked":
          return ((a.calendly_booked_at ? 1 : 0) - (b.calendly_booked_at ? 1 : 0)) * dir;
        case "company":
          return (a.company || "").localeCompare(b.company || "") * dir;
        default:
          return ((new Date(a.last_activity_at || 0).getTime()) - (new Date(b.last_activity_at || 0).getTime())) * dir;
      }
    });
  }, [prospects, temp, country, search, sortKey, sortAsc, stepOf]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(false); }
  };

  // ---- Funnel summary -------------------------------------------------
  const funnel = useMemo(() => {
    const real = events.filter((ev) => !ev.is_self_traffic);
    const sessionsBy = (pred: (ev: LinkEvent) => boolean) =>
      new Set(real.filter(pred).map((ev) => ev.session_id || ev.slug)).size;

    const opens = sessionsBy((ev) => ev.event_type === "page_view" || ev.event_type === "session_start");
    const voice = sessionsBy((ev) => ev.event_type === "voice_call_started" || ev.event_type === "voice_engagement");
    const chat = sessionsBy((ev) => ev.event_type === "chatbot_opened" || ev.event_type === "chatbot_message" || ev.event_type === "chat_engagement");
    const reveal = sessionsBy((ev) => {
      const s = String((ev.metadata as any)?.section || (ev.metadata as any)?.exit_section || "").toLowerCase();
      return s.includes("reveal") || s.includes("dashboard");
    });
    const calendly = sessionsBy((ev) => ev.event_type === "calendly_click");
    const booked = sessionsBy((ev) => ev.event_type === "calendly_booked");

    const bookedProspects = prospects.filter((p) => !p.is_self_traffic && p.calendly_booked_at).length;
    const calendlyProspects = prospects.filter((p) => !p.is_self_traffic && p.calendly_clicked_at).length;

    return {
      opens,
      voice,
      chat,
      anyDemo: sessionsBy((ev) => ["voice_call_started", "chatbot_opened", "chatbot_message"].includes(ev.event_type)),
      reveal,
      calendly: Math.max(calendly, calendlyProspects),
      booked: Math.max(booked, bookedProspects),
    };
  }, [events, prospects]);

  const funnelRows = [
    { label: "Link opens", value: funnel.opens, base: funnel.opens },
    { label: "Tried demo (any channel)", value: funnel.anyDemo, base: funnel.opens },
    { label: "Tried voice agent", value: funnel.voice, base: funnel.opens },
    { label: "Tried chatbot", value: funnel.chat, base: funnel.opens },
    { label: "Reached Reveal section", value: funnel.reveal, base: funnel.opens },
    { label: "Reached Calendly", value: funnel.calendly, base: funnel.opens },
    { label: "Booked a call", value: funnel.booked, base: funnel.opens },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Tracking</h1>
          <p className="text-sm text-muted-foreground">Real client traffic only — self-traffic is excluded.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leads">Lead List</TabsTrigger>
          <TabsTrigger value="funnel">Funnel Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-9 pl-8" placeholder="Search company, name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={temp} onValueChange={setTemp}>
                  <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Temperature" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All temperatures</SelectItem>
                    <SelectItem value="warm">Warm (10s+)</SelectItem>
                    <SelectItem value="tried">Tried (1–10s)</SelectItem>
                    <SelectItem value="not_tried">Not tried</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Country" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All countries</SelectItem>
                    {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
              ) : rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No tracked leads match these filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <button className="inline-flex items-center gap-1" onClick={() => toggleSort("company")}>Lead <ArrowUpDown className="h-3 w-3" /></button>
                        </TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Temp</TableHead>
                        <TableHead className="hidden md:table-cell">Channel</TableHead>
                        <TableHead>
                          <button className="inline-flex items-center gap-1" onClick={() => toggleSort("step")}>Step <ArrowUpDown className="h-3 w-3" /></button>
                        </TableHead>
                        <TableHead>
                          <button className="inline-flex items-center gap-1" onClick={() => toggleSort("booked")}>Booked <ArrowUpDown className="h-3 w-3" /></button>
                        </TableHead>
                        <TableHead>
                          <button className="inline-flex items-center gap-1" onClick={() => toggleSort("last_activity")}>Last activity <ArrowUpDown className="h-3 w-3" /></button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((p) => {
                        const t = TEMP[p.engagement_tier || "not_tried"] || TEMP.not_tried;
                        return (
                          <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(p)}>

                            <TableCell>
                              <div className="font-medium text-foreground">{p.company || "—"}</div>
                              <div className="text-xs text-muted-foreground">{p.firstname || p.email}</div>
                            </TableCell>
                            <TableCell className="text-sm">{p.country_code || "—"}</TableCell>
                            <TableCell>
                              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", t.cls)}>
                                {t.icon}{t.label}
                              </span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {p.engagement_channel || "—"}
                              {p.demo_engagement_seconds > 0 && <span className="ml-1 text-xs">({Math.round(p.demo_engagement_seconds)}s)</span>}
                            </TableCell>
                            <TableCell className="text-sm">{stepOf.get(p.id) ?? 0}</TableCell>
                            <TableCell>
                              {p.calendly_booked_at
                                ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Booked</Badge>
                                : p.calendly_clicked_at
                                  ? <Badge variant="secondary">Clicked</Badge>
                                  : <span className="text-sm text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{fmt(p.last_activity_at)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Link opens", value: funnel.opens, sub: "tracked sessions" },
              { label: "Demo tried", value: funnel.anyDemo, sub: `${pct(funnel.anyDemo, funnel.opens)}% of opens` },
              { label: "Reached Calendly", value: funnel.calendly, sub: `${pct(funnel.calendly, funnel.opens)}% of opens` },
              { label: "Bookings", value: funnel.booked, sub: `${pct(funnel.booked, funnel.opens)}% of opens` },
            ].map((m) => (
              <Card key={m.label}>
                <CardHeader className="pb-2"><CardDescription>{m.label}</CardDescription></CardHeader>
                <CardContent>
                  <div className="font-mono text-3xl font-semibold text-foreground">{m.value}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{m.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Funnel conversion</CardTitle>
              <CardDescription>Percentages are share of tracked link opens.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {funnelRows.map((r) => {
                const p = pct(r.value, r.base);
                return (
                  <div key={r.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-foreground">{r.label}</span>
                      <span className="font-mono text-muted-foreground">{r.value} · {p}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, p)}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <LeadThreadDialog prospect={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
};


export default TrackingPage;
