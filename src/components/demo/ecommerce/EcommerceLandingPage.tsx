import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { renderTemplate } from "@/lib/renderTemplate";
import { brandCssVars } from "@/lib/brandColors";
import BusinessLogo from "@/components/chatbot/BusinessLogo";
import UnifiedChatWindow, { type UnifiedChatWindowHandle } from "@/components/chatbot/unified/UnifiedChatWindow";
import FooterSection from "@/components/demo/FooterSection";
import { Button } from "@/components/ui/button";
import ecomHeroAsset from "@/assets/ecom-hero.png.asset.json";

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
}: Props) => {
  const [tpl, setTpl] = useState<Template | null>(null);
  const [productCount, setProductCount] = useState<number>(0);
  const chatRef = useRef<UnifiedChatWindowHandle>(null);
  const chatSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ecommerce_landing_template" as any).select("*").limit(1).maybeSingle();
      if (data) setTpl(data as unknown as Template);
    })();
  }, []);

  useEffect(() => {
    if (!chatbotId) return;
    (async () => {
      const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("chatbot_id", chatbotId);
      if (count) setProductCount(count);
    })();
  }, [chatbotId]);

  const vars = useMemo(() => ({
    company: businessName,
    visitor_name: visitorName || "Guest",
    product_count: productCount,
  }), [businessName, visitorName, productCount]);

  const style = useMemo(() => brandCssVars(brandColor || "#2563EB") as React.CSSProperties, [brandColor]);

  const heroImage = (tpl?.hero_image_url && tpl.hero_image_url.trim()) || ecomHeroAsset.url;

  const scrollToChat = () => chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const startVoice = () => { scrollToChat(); setTimeout(() => chatRef.current?.startVoice(), 500); };
  const injectAndSend = (text: string) => { scrollToChat(); setTimeout(() => chatRef.current?.sendMessage(text), 400); };

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
            <button onClick={scrollToChat}
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
              <button onClick={scrollToChat}
                className="rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition-transform active:scale-95"
                style={{ background: "var(--brand)", color: "var(--brand-text)" }}>
                {tpl.hero_cta_primary}
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
          <div className="relative">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 shadow-2xl">
              {chatbotId && (
                <UnifiedChatWindow
                  chatbotId={chatbotId}
                  businessName={businessName}
                  logoUrl={logoUrl}
                  productCount={productCount}
                  vapiKey={vapiKey}
                  assistantId={assistantId}
                  suggestionChips={tpl.suggestion_chips}
                  height={520}
                />
              )}
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
      <section ref={chatSectionRef} id="demo-section" className="py-20"
        style={{ background: "#f8fafc" }}>
        <div className="mx-auto max-w-2xl px-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "var(--brand-light)", color: "var(--brand)" }}>
            ⚡ Live Demo
          </span>
          <h2 className="mt-3 text-4xl font-bold text-slate-900">{renderTemplate(tpl.demo_headline, vars)}</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-slate-500">{renderTemplate(tpl.demo_sub, vars)}</p>
        </div>
        <div className="mx-auto mt-10 max-w-2xl px-4">
          {chatbotId && (
            <UnifiedChatWindow
              ref={chatRef}
              chatbotId={chatbotId}
              businessName={businessName}
              logoUrl={logoUrl}
              productCount={productCount}
              vapiKey={vapiKey}
              assistantId={assistantId}
              suggestionChips={tpl.suggestion_chips}
              height={580}
            />
          )}
        </div>
        <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2 px-4">
          <span className="self-center text-sm text-slate-400">Try saying →</span>
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
    </div>
  );
};

export default EcommerceLandingPage;