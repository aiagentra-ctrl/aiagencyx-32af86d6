import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { renderTemplate } from "@/lib/renderTemplate";
import { brandCssVars } from "@/lib/brandColors";
import BusinessLogo from "@/components/chatbot/BusinessLogo";
import EcomFloatingChatWidget, { type EcomFloatingChatWidgetHandle } from "@/components/chatbot/unified/EcomFloatingChatWidget";
import { MessageCircle, Phone } from "lucide-react";
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
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
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

  useEffect(() => {
    if (!chatbotId) return;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,price,currency,image_url,product_url,in_stock,category")
        .eq("chatbot_id", chatbotId)
        .order("created_at", { ascending: false })
        .limit(6);
      if (data) setFeaturedProducts(data as any[]);
    })();
  }, [chatbotId]);

  const vars = useMemo(() => ({
    company: businessName,
    visitor_name: visitorName || "Guest",
    product_count: productCount,
  }), [businessName, visitorName, productCount]);

  const style = useMemo(() => brandCssVars(brandColor || "#2563EB") as React.CSSProperties, [brandColor]);

  const openChat = () => widgetRef.current?.open();
  const startVoice = () => widgetRef.current?.startVoice();

  if (!tpl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0620]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white/70" />
      </div>
    );
  }

  const firstName = (visitorName && visitorName.trim().split(/\s+/)[0]) || "there";

  return (
    <div
      style={{ ...style, fontFamily: "'Inter', system-ui, sans-serif" } as React.CSSProperties}
      className="relative min-h-screen overflow-hidden bg-[#08061a] text-white"
    >
      {/* Ambient background: radial glow + grid + drifting dots */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 700px at 30% 20%, color-mix(in srgb, var(--brand) 30%, transparent), transparent 60%), radial-gradient(900px 600px at 80% 90%, color-mix(in srgb, var(--brand) 22%, transparent), transparent 60%), #08061a",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 85%)",
        }}
      />
      {/* Floating specks */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${(i * 47) % 100}%`,
              top: `${(i * 83) % 100}%`,
              width: `${(i % 3) + 2}px`,
              height: `${(i % 3) + 2}px`,
              background: i % 2 ? "rgba(255,255,255,0.55)" : "var(--brand)",
              boxShadow: `0 0 12px ${i % 2 ? "rgba(255,255,255,0.5)" : "var(--brand)"}`,
              opacity: 0.55,
              animation: `landingFloat ${8 + (i % 5)}s ease-in-out ${i * 0.35}s infinite alternate`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes landingFloat { 0% { transform: translateY(0) } 100% { transform: translateY(-14px) } }
        @keyframes landingGlow { 0%,100% { text-shadow: 0 0 20px color-mix(in srgb, var(--brand) 55%, transparent), 0 0 40px color-mix(in srgb, var(--brand) 35%, transparent); } 50% { text-shadow: 0 0 30px color-mix(in srgb, var(--brand) 75%, transparent), 0 0 60px color-mix(in srgb, var(--brand) 45%, transparent); } }
      `}</style>

      {/* NAV */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <BusinessLogo url={logoUrl} name={businessName} size={34} rounded="lg" />
          <span className="text-sm font-semibold text-white/90" style={{ fontFamily: "'Sora', sans-serif" }}>{businessName}</span>
        </div>
        <button
          onClick={onBookCall}
          className="rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.03] active:scale-95"
          style={{
            background: "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 55%, #7c3aed))",
            color: "var(--brand-text)",
            boxShadow: "0 8px 30px color-mix(in srgb, var(--brand) 40%, transparent)",
          }}
        >
          Book a Call
        </button>
      </nav>

      {/* HERO: koushikflow-style centered block */}
      <section className="relative z-10 mx-auto flex min-h-[85vh] max-w-3xl flex-col items-center justify-center px-5 py-16 text-center">
        <h1
          className="text-5xl font-bold leading-tight tracking-tight md:text-7xl"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          Hey{" "}
          <span
            className="italic"
            style={{
              background: "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 45%, #c4b5fd))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "landingGlow 3.5s ease-in-out infinite",
            }}
          >
            {firstName}
          </span>
          <span className="text-white/90">,</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70 md:text-xl">
          I built an AI that captures sales while you're off the clock.
        </p>

        <div
          className="mt-8 w-full max-w-2xl rounded-2xl border p-6 backdrop-blur-md md:p-8"
          style={{
            borderColor: "color-mix(in srgb, var(--brand) 35%, transparent)",
            background: "linear-gradient(160deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
            boxShadow: "0 20px 60px -20px color-mix(in srgb, var(--brand) 35%, transparent)",
          }}
        >
          <p className="text-base leading-relaxed text-white/85 md:text-lg">
            It's an AI that talks to your customers on your site, answers questions about your products,
            and helps them buy — while you focus on running{" "}
            <span className="font-semibold" style={{ color: "var(--brand-mid)" }}>{businessName}</span>.
          </p>
        </div>

        <button
          onClick={openChat}
          className="mt-10 group relative inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white shadow-2xl transition-transform hover:scale-[1.04] active:scale-95"
          style={{
            background: "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 40%, #8b5cf6))",
            boxShadow: "0 15px 45px color-mix(in srgb, var(--brand) 55%, transparent)",
          }}
        >
          <MessageCircle className="h-5 w-5" />
          Try it out
        </button>

        <p className="mt-5 text-sm text-white/50">
          A smooth chat will begin in the bottom-right corner
        </p>

        {productCount ? (
          <p className="mt-3 text-xs text-white/40">
            AI trained on <span className="font-semibold text-white/70">{productCount}</span> products from {businessName}
          </p>
        ) : null}
      </section>

      {/* SECOND SECTION */}
      <section className="relative z-10 mx-auto max-w-3xl px-5 py-24 text-center">
        <p
          className="mb-3 inline-block rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
          style={{
            borderColor: "color-mix(in srgb, var(--brand) 40%, transparent)",
            color: "var(--brand-mid)",
            background: "color-mix(in srgb, var(--brand) 12%, transparent)",
          }}
        >
          Turn conversations into conversions
        </p>
        <h2
          className="mt-4 text-4xl font-bold leading-tight md:text-5xl"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          Capture sales the moment buyers are ready.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">
          See how the AI can sell, support, and recommend products for{" "}
          <span className="font-semibold text-white">{businessName}</span> 24/7.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={openChat}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-xl transition-transform hover:scale-[1.03] active:scale-95"
            style={{
              background: "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 40%, #8b5cf6))",
              color: "var(--brand-text)",
            }}
          >
            <MessageCircle className="h-4 w-4" /> Start Chatting Now
          </button>
          {vapiKey && assistantId && (
            <button
              onClick={startVoice}
              className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
              style={{ borderColor: "color-mix(in srgb, var(--brand) 40%, transparent)" }}
            >
              <Phone className="h-4 w-4" /> Talk to AI
            </button>
          )}
          <button
            onClick={onBookCall}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/5"
          >
            {tpl.cta_button || "Book Your Call"}
          </button>
        </div>

        <p className="mt-10 text-sm italic text-white/50">
          Don't wait until it's too late. Early adopters always win.
        </p>
      </section>

      <footer className="relative z-10 mx-auto max-w-6xl px-5 pb-8 pt-4 text-center text-xs text-white/40">
        <p>© {new Date().getFullYear()} {businessName} · AI demo</p>
        {(contactEmail || contactPhone) && (
          <p className="mt-1">
            {contactEmail && <span className="mr-3">{contactEmail}</span>}
            {contactPhone && <span>{contactPhone}</span>}
          </p>
        )}
        {tpl.footer_note && <p className="mt-2">{renderTemplate(tpl.footer_note, vars)}</p>}
      </footer>

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
        visitorFirstName={visitorName}
        featuredProducts={featuredProducts}
        contained={override !== null}
        defaultOpen={_previewWidgetOpen}
      />
    </div>
  );
};

export default EcommerceLandingPage;