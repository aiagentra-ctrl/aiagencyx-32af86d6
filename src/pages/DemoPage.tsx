import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";

export type CallStatus = "idle" | "calling" | "connected" | "ended";
import { supabase } from "@/integrations/supabase/client";
import HeroSection from "@/components/demo/HeroSection";
import VoiceAgentSection from "@/components/demo/VoiceAgentSection";
import PersonalizationProofSection from "@/components/demo/PersonalizationProofSection";
import ProblemSection from "@/components/demo/ProblemSection";
import OutcomeSection from "@/components/demo/OutcomeSection";
import HowItWorksSection from "@/components/demo/HowItWorksSection";
import CTASection from "@/components/demo/CTASection";
import FooterSection from "@/components/demo/FooterSection";
import StickyCallButton from "@/components/demo/StickyCallButton";
import DemoNavbar from "@/components/demo/DemoNavbar";
import ChatWidget from "@/components/chatbot/ChatWidget";

interface DemoPageData {
  id: string;
  slug: string;
  assistant_id: string;
  business_name: string;
  description: string | null;
  vapi_key: string;
  client_name: string | null;
  company_name: string | null;
  industry: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  calendly_url: string | null;
  cta_text: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  features: string[] | null;
  benefits: string[] | null;
  social_proof: Array<{ name: string; role: string; quote: string }> | null;
}

interface LinkedChatbot {
  id: string;
  widget_config: any;
  research_data: any;
  logo_url: string | null;
}

const DemoPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<DemoPageData | null>(null);
  const [linkedChatbot, setLinkedChatbot] = useState<LinkedChatbot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [vapiInstance, setVapiInstance] = useState<any>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [globalCalendarUrl, setGlobalCalendarUrl] = useState<string | null>(null);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const resolvedSlug = (() => {
    if (slug) return slug;
    const hostname = window.location.hostname;
    const parts = hostname.split(".");
    if (parts.length >= 3 && parts[0] !== "www") return parts[0];
    return null;
  })();

  useEffect(() => {
    const fetchPage = async () => {
      if (!resolvedSlug) { setError("Demo page not found"); setLoading(false); return; }

      let { data, error: fetchError } = await supabase
        .from("demo_pages").select("*").eq("slug", resolvedSlug).single();

      if (fetchError || !data) {
        const subResult = await supabase
          .from("demo_pages").select("*").eq("custom_subdomain", resolvedSlug).single();
        data = subResult.data;
        fetchError = subResult.error;
      }

      if (fetchError || !data) { setError("Demo page not found"); setLoading(false); return; }

      setPage(data as unknown as DemoPageData);
      setLoading(false);

      const [settingsRes, chatbotRes] = await Promise.all([
        supabase.from("site_settings").select("*").eq("key", "calendar_url").maybeSingle(),
        supabase.from("chatbots").select("id, widget_config, research_data, logo_url")
          .eq("demo_page_id", data.id).eq("status", "active").maybeSingle(),
      ]);

      if (settingsRes.data && (settingsRes.data as any).value) {
        setGlobalCalendarUrl((settingsRes.data as any).value);
      }
      if (chatbotRes.data) setLinkedChatbot(chatbotRes.data as unknown as LinkedChatbot);

      await supabase.from("demo_pages").update({ views: (data.views ?? 0) + 1 }).eq("id", data.id);
    };

    fetchPage();
  }, [resolvedSlug]);

  // Track scroll for sticky button
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const heroBottom = heroRef.current.getBoundingClientRect().bottom;
        setScrolledPastHero(heroBottom < 0);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const startVapi = useCallback(async () => {
    if (!page || vapiStarted) return;
    try {
      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(page.vapi_key);
      vapi.start(page.assistant_id);
      setVapiInstance(vapi);
      setVapiStarted(true);
    } catch (err) {
      console.error("Vapi initialization failed:", err);
    }
  }, [page, vapiStarted]);

  const handleBookCall = useCallback(() => {
    const url = page?.calendly_url || globalCalendarUrl;
    if (url) window.open(url, "_blank");
  }, [page, globalCalendarUrl]);

  const scrollToDemo = useCallback(() => {
    document.getElementById("demo-section")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Page Not Found</h1>
          <p className="text-muted-foreground">This demo page doesn't exist.</p>
        </div>
      </div>
    );
  }

  const research = (linkedChatbot?.research_data as any) || {};
  const logoUrl = linkedChatbot?.logo_url || linkedChatbot?.widget_config?.logo || undefined;
  const companyName = page.company_name || page.business_name;

  return (
    <div className="min-h-screen bg-background">
      <DemoNavbar
        logoUrl={logoUrl}
        companyName={companyName}
        onTryDemo={scrollToDemo}
        onBookCall={handleBookCall}
      />

      <div ref={heroRef}>
        <HeroSection
          companyName={companyName}
          heroTitle={page.hero_title || undefined}
          heroSubtitle={page.hero_subtitle || undefined}
          logoUrl={logoUrl}
          onTryCall={startVapi}
          onTryChat={() => {/* chatbot opens via widget */}}
          vapiStarted={vapiStarted}
        />
      </div>

      <div id="demo-section">
        <VoiceAgentSection
          companyName={companyName}
          vapiStarted={vapiStarted}
          onTryDemo={startVapi}
        />
      </div>

      <PersonalizationProofSection
        companyName={companyName}
        menuItems={research.menu_items}
        categories={research.categories}
        businessHours={research.business_hours}
        address={research.address}
        phone={research.phone}
      />

      <ProblemSection companyName={companyName} />

      <OutcomeSection />

      <HowItWorksSection companyName={companyName} />

      <CTASection
        companyName={companyName}
        ctaText={page.cta_text || undefined}
        onBookCall={handleBookCall}
      />

      <FooterSection
        businessName={page.business_name}
        contactEmail={page.contact_email || undefined}
        contactPhone={page.contact_phone || undefined}
        logoUrl={logoUrl}
      />

      {/* Sticky Call Button */}
      <StickyCallButton
        visible={scrolledPastHero}
        vapiStarted={vapiStarted}
        onTryCall={startVapi}
      />

      {/* Embedded Chatbot */}
      {linkedChatbot && (
        <ChatWidget
          chatbotId={linkedChatbot.id}
          greeting={linkedChatbot.widget_config?.greeting}
          logoUrl={logoUrl}
          businessName={companyName}
          calendarUrl={page.calendly_url || globalCalendarUrl || undefined}
        />
      )}
    </div>
  );
};

export default DemoPage;
