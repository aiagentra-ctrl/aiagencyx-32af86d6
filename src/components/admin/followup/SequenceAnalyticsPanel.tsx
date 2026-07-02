// Analytics panel: funnel, reply quality, heatmap, A/B — pulls from get-sequence-analytics edge fn.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, Zap } from "lucide-react";
import { toast } from "sonner";

type Seq = { id: string; name: string };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SequenceAnalyticsPanel() {
  const [seqs, setSeqs] = useState<Seq[]>([]);
  const [seqId, setSeqId] = useState<string>("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("follow_up_sequences_templates").select("id, name").order("created_at", { ascending: false })
      .then(({ data }) => {
        const list = (data as any) || [];
        setSeqs(list);
        if (list[0]) setSeqId(list[0].id);
      });
  }, []);

  useEffect(() => {
    if (!seqId) return;
    setLoading(true);
    supabase.functions.invoke("get-sequence-analytics", { body: { sequence_template_id: seqId } })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setData(data); setLoading(false);
      });
  }, [seqId]);

  const exportCsv = async () => {
    const { data, error } = await supabase.functions.invoke("export-sequence-csv", { body: { sequence_template_id: seqId } });
    if (error) { toast.error(error.message); return; }
    const blob = new Blob([(data as any)?.csv || ""], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `sequence-${seqId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!seqs.length) return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Create a sequence first to see analytics.</CardContent></Card>;

  const maxHeat = Math.max(1, ...(data?.heatmap?.flat() || [1]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={seqId} onValueChange={setSeqId}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{seqs.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV</Button>
      </div>

      {loading || !data ? (
        <div className="grid gap-3 md:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-md bg-muted/40 animate-pulse" />)}</div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-6">
            <Stat label="Enrolled" value={data.stats.enrolled} />
            <Stat label="Active" value={data.stats.active} />
            <Stat label="Completed" value={data.stats.completed} />
            <Stat label="Responded" value={data.stats.responded} />
            <Stat label="Response Rate" value={`${data.stats.responseRate}%`} accent="text-emerald-500" />
            <Stat label="Avg Step→Reply" value={data.stats.avgStepToReply} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Funnel by Step</CardTitle>
              <CardDescription>
                {data.bestStep && <>Best-performing: <Badge>Step {data.bestStep.step_number} · {data.bestStep.reply_rate}%</Badge></>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.funnel.map((f: any) => {
                const max = Math.max(1, ...data.funnel.map((x: any) => x.reached));
                return (
                  <div key={f.step_number} className="flex items-center gap-2 text-xs">
                    <div className="w-16 shrink-0">Step {f.step_number}</div>
                    <div className="flex-1 h-6 rounded bg-muted overflow-hidden relative">
                      <div className="h-full bg-primary/70" style={{ width: `${(f.reached / max) * 100}%` }} />
                      <div className="absolute inset-0 flex items-center px-2 text-[11px] font-medium">
                        {f.reached} reached · {f.replied} replied · {f.reply_rate}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Reply Quality</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                <QualityBar label="Positive" value={data.reply_quality.positive} total={data.stats.responded} color="bg-emerald-500" />
                <QualityBar label="Objection" value={data.reply_quality.objection} total={data.stats.responded} color="bg-amber-500" />
                <QualityBar label="Negative" value={data.reply_quality.negative} total={data.stats.responded} color="bg-red-500" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Smart Timing / A-B</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div>Smart-timed sends: <b>{data.smart_timing.with_smart}</b> · Default: {data.smart_timing.without_smart}</div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {(["A", "B"] as const).map((v) => (
                    <div key={v} className="rounded border p-2">
                      <div className="font-semibold">Variant {v}</div>
                      {data.ab[v] ? (
                        <div className="text-muted-foreground">
                          {data.ab[v].enrolled} enrolled · {data.ab[v].responded} replies · <b className="text-foreground">{data.ab[v].response_rate}%</b>
                        </div>
                      ) : <div className="text-muted-foreground">— no data —</div>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Reply Heatmap</CardTitle>
              <CardDescription>When your prospects reply (UTC) · {data.totalReplyEvents} events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="inline-block">
                  <div className="flex gap-[2px] pl-8">
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div key={h} className="w-4 text-center text-[9px] text-muted-foreground">{h}</div>
                    ))}
                  </div>
                  {DAYS.map((dayName, d) => (
                    <div key={d} className="flex items-center gap-[2px] mt-[2px]">
                      <div className="w-8 text-[10px] text-muted-foreground">{dayName}</div>
                      {Array.from({ length: 24 }).map((_, h) => {
                        const v = data.heatmap[d][h];
                        const opacity = v ? 0.15 + (v / maxHeat) * 0.85 : 0;
                        return (
                          <div key={h} title={`${dayName} ${h}:00 — ${v} replies`}
                            className="w-4 h-4 rounded-[2px]"
                            style={{ backgroundColor: v ? `hsl(var(--primary) / ${opacity})` : "hsl(var(--muted))" }} />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

const Stat = ({ label, value, accent }: { label: string; value: any; accent?: string }) => (
  <Card><CardContent className="p-3">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={`text-xl font-semibold ${accent || ""}`}>{value}</div>
  </CardContent></Card>
);

const QualityBar = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-20 shrink-0">{label}</div>
      <div className="flex-1 h-4 rounded bg-muted overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
      <div className="w-14 text-right tabular-nums">{value} · {pct}%</div>
    </div>
  );
};