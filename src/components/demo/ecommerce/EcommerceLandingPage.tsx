import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { renderTemplate } from "@/lib/renderTemplate";
import { brandCssVars } from "@/lib/brandColors";
import BusinessLogo from "@/components/chatbot/BusinessLogo";
import EcomFloatingChatWidget, { type EcomFloatingChatWidgetHandle } from "@/components/chatbot/unified/EcomFloatingChatWidget";
import FooterSection from "@/components/demo/FooterSection";
import { Button } from "@/components/ui/button";
import ecomHeroAsset from "@/assets/ecom-hero.png.asset.json";
import { MessageCircle, ArrowRight, Sparkles } from "lucide-react";
import { LandingTemplateOverrideCtx } from "@/components/admin/EcomLandingTemplatePanel";

interface Props {
  chatbotId?: string;
  businessName: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  vapiKey?: string;
  assistantId?: string;
  calendarUrl?: string | null;
  onBookCall: () => void;
  contactEmail?: string;
  contactPhone?: string;
  visitorName?: string;
  _previewProductCount?: number;
  _previewWidgetOpen?: boolean;
}

type Template = {
  hero_headline: string; hero_sub: string; hero_cta_primary: string; hero_cta_secondary: string;
  intro_greeting: string; intro_body: string;
  image_headline: string; image_sub: string; image_cta: string; hero_image_url: string;
  urgency_line: string; proof_headline: string; youtube_embed_url: string;
  demo_headline: string; demo_sub: string;
  cta_headline: string; cta_sub: string; cta_button: string;
  footer_note: string; suggestion_chips: string[];
};

const EcommerceLandingPage = ({
  chatbotId, businessName, logoUrl, brandColor,
  vapiKey, assistantId, onBookCall,
  contactEmail, contactPhone, visitorName,
  _previewProductCount, _previewWidgetOpen,
}: Props) => {
  const override = useContext(LandingTemplateOverrideCtx);
  const [tpl, setTpl] = useState<Template | null>(override ?? null);
  const [productCount, setProductCount] = useState<number>(_previewProductCount ?? 0);
  const widgetRef = useRef<EcomFloatingChatWidgetHandle>(null);

  useEffect(() => {
    if (override) { setTpl(override); return; }
    (async () => {
      const { data } = await supabase.from("ecommerce_landing_template" as any).select("*").limit(1).maybeSingle();
      if (data) setTpl(data as unknown as Template);
    })();
  }, [override]);

  useEffect(() => {
    if (!chatbotId || _previewProductCount !== undefined) return;
    (async () => {
      const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("chatbot_id", chatbotId);
      if (count) setProductCount(count);
    })();
  }, [chatbotId, _previewProductCount]);

  const vars = useMemo(() => ({
    company: businessName,
    visitor_name: visitorName || "Guest",
    product_count: productCount,
  }), [businessName, visitorName, productCount]);

  const style = useMemo(() => brandCssVars(brandColor || "#2563EB") as React.CSSProperties, [brandColor]);

  const heroImage = (tpl?.hero_image_url && tpl.hero_image_url.trim()) || ecomHeroAsset.url;

  const openChat = () => widgetRef.current?.open();
  const startVoice = () => widgetRef.current?.startVoice();
  const injectAndSend = (text: string) => widgetRef.current?.sendMessage(text);

  if (!tpl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600" />
      </div>
    );
  }

  return (
    <div style={style} className="min-h-screen bg-white text-slate-900">
      {/* NAV */}
      <nav className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BusinessLogo url={logoUrl} name={businessName} size={32} rounded="lg" />
            <span className="font-semibold text-slate-900">{businessName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openChat}
              className="hidden rounded-lg px-4 py-2 text-sm font-medium sm:inline-flex"
              style={{ color: "var(--brand)" }}>Try Demo</button>
            <button onClick={onBookCall}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm"
              style={{ background: "var(--brand)", color: "var(--brand-text)" }}>Book Call</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: "radial-gradient(ellipse at top left, var(--brand-light), transparent 60%)" }} />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:py-24 md:gap-8 md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "var(--brand-light)", color: "var(--brand)" }}>
              ⚡ Live Demo for {businessName}
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
              {renderTemplate(tpl.hero_headline, vars)}
            </h1>
            <p className="mt-4 text-lg text-slate-600">{renderTemplate(tpl.hero_sub, vars)}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={openChat}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition-transform active:scale-95"
                style={{ background: "var(--brand)", color: "var(--brand-text)" }}>
                <MessageCircle className="h-4 w-4" /> {tpl.hero_cta_primary}
              </button>
              {vapiKey && assistantId && (
                <button onClick={startVoice}
                  className="rounded-xl border-[1.5px] bg-white px-5 py-3 text-sm font-semibold transition-transform active:scale-95"
                  style={{ borderColor: "var(--brand)", color: "var(--brand)" }}>
                  {tpl.hero_cta_secondary}
                </button>
              )}
            </div>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="relative w-full max-w-md">
              <div
                className="absolute -inset-6 rounded-[2rem] opacity-30 blur-2xl"
                style={{ background: "var(--brand)" }}
              />
              <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div
                  className="flex aspect-[4/3] items-center justify-center p-10"
                  style={{ background: "linear-gradient(135deg, var(--brand-light), #fff)" }}
                >
                  <BusinessLogo url={logoUrl} name={businessName} size={180} rounded="2xl" className="!shadow-xl" />
                </div>
                <div className="border-t border-slate-100 p-5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                    </span>
                    <span className="font-medium text-slate-700">AI Assistant online</span>
                    <span className="ml-auto text-xs text-slate-400">Knows {productCount || "your"} products</span>
                  </div>
                  <button
                    onClick={openChat}
                    className="mt-3 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 transition hover:border-slate-300"
                  >
                    <span>Ask me anything about {businessName}…</span>
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: "var(--brand)", color: "var(--brand-text)" }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTRO */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-2xl font-semibold text-slate-900">{renderTemplate(tpl.intro_greeting, vars)}</p>
        <div className="mt-4 space-y-4 whitespace-pre-line text-lg leading-relaxed text-slate-700">
          {renderTemplate(tpl.intro_body, vars)}
        </div>
      </section>

      {/* IMAGE BLOCK */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
          <img src={heroImage} alt="AI capturing conversations" className="w-full object-cover" />
          <div className="p-8 text-center md:p-10">
            <h2 className="text-3xl font-bold text-slate-900">{renderTemplate(tpl.image_headline, vars)}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">{renderTemplate(tpl.image_sub, vars)}</p>
            <Button
              onClick={onBookCall}
              className="mt-6"
              size="lg"
              style={{ background: "var(--brand)", color: "var(--brand-text)" }}
            >
              {tpl.image_cta}
            </Button>
          </div>
        </div>
      </section>

      {/* URGENCY */}
      <section className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-center text-xl font-semibold text-slate-800">{renderTemplate(tpl.urgency_line, vars)}</p>
      </section>

      {/* PROOF / VIDEO */}
      <section className="mx-auto max-w-4xl px-4 py-12">
        <h2 className="text-center text-3xl font-bold text-slate-900">{renderTemplate(tpl.proof_headline, vars)}</h2>
        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 shadow-xl">
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={tpl.youtube_embed_url}
              title="Client testimonial"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="demo-section" className="py-20" style={{ background: "#f8fafc" }}>
        <div className="mx-auto max-w-2xl px-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "var(--brand-light)", color: "var(--brand)" }}>
            ⚡ Live Demo
          </span>
          <h2 className="mt-3 text-4xl font-bold text-slate-900">{renderTemplate(tpl.demo_headline, vars)}</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-slate-500">{renderTemplate(tpl.demo_sub, vars)}</p>
        </div>
        <div className="mx-auto mt-10 max-w-3xl px-4">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-xl md:p-12">
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--brand-light)", color: "var(--brand)" }}>
                  <Sparkles className="h-3 w-3" /> Try it now
                </div>
                <h3 className="mt-3 text-2xl font-bold text-slate-900">Open the chat in the bottom-right corner</h3>
                <p className="mt-2 text-slate-600">Ask about products, sizes, shipping, returns — or start a voice call. The assistant knows every product on {businessName}.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {tpl.suggestion_chips.slice(0, 4).map((c) => (
                    <button
                      key={c}
                      onClick={() => injectAndSend(c.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim())}
                      className="rounded-full border-[1.5px] border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-all hover:-translate-y-0.5"
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--brand)";
                        (e.currentTarget as HTMLElement).style.color = "var(--brand)";
                        (e.currentTarget as HTMLElement).style.background = "var(--brand-light)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "";
                        (e.currentTarget as HTMLElement).style.color = "";
                        (e.currentTarget as HTMLElement).style.background = "";
                      }}
                    >{c}</button>
                  ))}
                </div>
                <button
                  onClick={openChat}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition-transform active:scale-95"
                  style={{ background: "var(--brand)", color: "var(--brand-text)" }}
                >
                  <MessageCircle className="h-4 w-4" /> Open Live Chat
                </button>
              </div>
              <div className="hidden md:block">
                <div className="relative">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full shadow-2xl" style={{ background: "var(--brand)" }}>
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="h-16 w-16 rounded-full bg-white object-contain p-1" />
                    ) : (
                      <MessageCircle className="h-10 w-10 text-white" />
                    )}
                  </div>
                  <div className="absolute -left-16 -top-4 rotate-[-8deg] text-xs font-medium text-slate-500">
                    ↘ down here
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h2 className="text-4xl font-bold text-slate-900">{renderTemplate(tpl.cta_headline, vars)}</h2>
        <p className="mt-3 text-lg text-slate-600">{renderTemplate(tpl.cta_sub, vars)}</p>
        <Button
          size="lg"
          onClick={onBookCall}
          className="mt-6"
          style={{ background: "var(--brand)", color: "var(--brand-text)" }}
        >
          {tpl.cta_button}
        </Button>
      </section>

      <FooterSection
        businessName={businessName}
        contactEmail={contactEmail}
        contactPhone={contactPhone}
        logoUrl={logoUrl || undefined}
      />
      <p className="pb-6 text-center text-xs text-slate-400">{renderTemplate(tpl.footer_note, vars)}</p>

      {/* FLOATING CHAT WIDGET */}
      <EcomFloatingChatWidget
        ref={widgetRef}
        chatbotId={chatbotId}
        businessName={businessName}
        logoUrl={logoUrl}
        productCount={productCount}
        vapiKey={vapiKey}
        assistantId={assistantId}
        suggestionChips={tpl.suggestion_chips}
        contained={override !== null}
        defaultOpen={_previewWidgetOpen}
      />
    </div>
  );
};

export default EcommerceLandingPage;