import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, Eye, EyeOff, Monitor, Smartphone } from "lucide-react";
import EcommerceLandingPage from "@/components/demo/ecommerce/EcommerceLandingPage";
import { supabase as _supa } from "@/integrations/supabase/client";

type Template = Record<string, any>;

const FIELDS: { key: string; label: string; multiline?: boolean; hint?: string }[] = [
  { key: "hero_headline", label: "Hero headline" },
  { key: "hero_sub", label: "Hero sub-text" },
  { key: "hero_cta_primary", label: "Hero primary CTA" },
  { key: "hero_cta_secondary", label: "Hero secondary CTA (voice)" },
  { key: "intro_greeting", label: "Intro greeting" },
  { key: "intro_body", label: "Intro body", multiline: true },
  { key: "image_headline", label: "Image section headline" },
  { key: "image_sub", label: "Image section sub" },
  { key: "image_cta", label: "Image section button" },
  { key: "hero_image_url", label: "Hero image URL (blank = default)" },
  { key: "urgency_line", label: "Urgency line" },
  { key: "proof_headline", label: "Proof / video headline" },
  { key: "youtube_embed_url", label: "YouTube embed URL", hint: "Must be an /embed/ URL" },
  { key: "demo_headline", label: "Demo section headline" },
  { key: "demo_sub", label: "Demo section sub" },
  { key: "cta_headline", label: "Final CTA headline" },
  { key: "cta_sub", label: "Final CTA sub" },
  { key: "cta_button", label: "Final CTA button" },
  { key: "footer_note", label: "Footer note" },
];

/**
 * Admin editor for the single-row e-commerce landing template.
 * Applies to every e-commerce demo — no per-demo copy.
 */
export default function EcomLandingTemplatePanel() {
  const [tpl, setTpl] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chipsRaw, setChipsRaw] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("ecommerce_landing_template" as any).select("*").limit(1).maybeSingle();
      if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
      if (data) {
        setTpl(data as Template);
        setChipsRaw(((data as any).suggestion_chips || []).join("\n"));
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!tpl) return;
    setSaving(true);
    const chips = chipsRaw.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 8);
    const payload = { ...tpl, suggestion_chips: chips };
    const { error } = await supabase.from("ecommerce_landing_template" as any).update(payload).eq("id", tpl.id);
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved", description: "Every e-commerce demo will use the new copy." });
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading template…</div>;
  if (!tpl) return <p className="text-sm text-muted-foreground">Template row missing. Contact support.</p>;

  const chips = chipsRaw.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 8);
  const livePreviewTpl = { ...tpl, suggestion_chips: chips };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">E-commerce landing template</CardTitle>
          <CardDescription>
            Applies to every e-commerce demo page. Use <code>{"{{company}}"}</code>, <code>{"{{visitor_name}}"}</code>, <code>{"{{product_count}}"}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="grid gap-1.5">
            <Label htmlFor={f.key} className="text-xs">{f.label}</Label>
            {f.multiline ? (
              <Textarea
                id={f.key}
                rows={5}
                value={tpl[f.key] ?? ""}
                onChange={(e) => setTpl({ ...tpl, [f.key]: e.target.value })}
              />
            ) : (
              <Input
                id={f.key}
                value={tpl[f.key] ?? ""}
                onChange={(e) => setTpl({ ...tpl, [f.key]: e.target.value })}
              />
            )}
            {f.hint && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
          </div>
        ))}
        <div className="grid gap-1.5">
          <Label htmlFor="chips" className="text-xs">Suggestion chips (one per line, 4–8)</Label>
          <Textarea id="chips" rows={5} value={chipsRaw} onChange={(e) => setChipsRaw(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save template
          </Button>
        </div>
        </CardContent>
      </Card>

      {/* LIVE PREVIEW */}
      <div className="xl:sticky xl:top-4 xl:self-start">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Live preview</CardTitle>
              <CardDescription className="text-xs">Updates as you type. Not saved until you hit Save.</CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant={device === "desktop" ? "default" : "outline"} onClick={() => setDevice("desktop")} className="h-8 px-2"><Monitor className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant={device === "mobile" ? "default" : "outline"} onClick={() => setDevice("mobile")} className="h-8 px-2"><Smartphone className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="outline" onClick={() => setPreviewOpen((v) => !v)} className="h-8 px-2">
                {previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span className="ml-1 text-xs">{previewOpen ? "Close chat" : "Open chat"}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <PreviewFrame device={device} previewOpen={previewOpen} tpl={livePreviewTpl} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PreviewFrame({
  device, previewOpen, tpl,
}: { device: "desktop" | "mobile"; previewOpen: boolean; tpl: Template }) {
  // Scaled preview of the real EcommerceLandingPage rendered with mock props + live template overrides.
  const width = device === "desktop" ? 1280 : 390;
  const height = device === "desktop" ? 900 : 780;
  const scale = device === "desktop" ? 0.48 : 0.7;

  return (
    <div className="relative w-full bg-slate-100 p-4">
      <div
        className="relative mx-auto overflow-hidden rounded-xl border border-slate-300 bg-white shadow-inner"
        style={{ width: width * scale, height: height * scale }}
      >
        <div
          style={{
            width, height, transform: `scale(${scale})`, transformOrigin: "top left",
            pointerEvents: "none",
          }}
        >
          <PreviewInner tpl={tpl} previewOpen={previewOpen} />
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Mock data: business "Acme Store", 42 products, visitor "Alex". Chat is interactive-disabled in preview.
      </p>
    </div>
  );
}

/**
 * Injects the edited template row into the DB-fetching landing page by mocking the supabase call
 * via a portal isn't feasible; instead we render a lightweight standalone shell that mirrors the
 * landing page composition. We import the real EcommerceLandingPage but pass previewTpl via a
 * global window override the page reads. Simpler: render EcommerceLandingPage directly — it fetches
 * from DB. We instead wrap it with a context override.
 */
import { createContext, useContext } from "react";
export const LandingTemplateOverrideCtx = createContext<Template | null>(null);

function PreviewInner({ tpl, previewOpen }: { tpl: Template; previewOpen: boolean }) {
  return (
    <LandingTemplateOverrideCtx.Provider value={tpl}>
      <EcommerceLandingPage
        chatbotId={undefined}
        businessName="Acme Store"
        logoUrl={null}
        brandColor="#2563EB"
        onBookCall={() => {}}
        visitorName="Alex"
        contactEmail="hi@acme.store"
        contactPhone="+1 555 0100"
        // @ts-expect-error - preview-only props
        _previewProductCount={42}
        _previewWidgetOpen={previewOpen}
      />
    </LandingTemplateOverrideCtx.Provider>
  );
}