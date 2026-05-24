import { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import { useParams } from "react-router-dom";

export type CallStatus = "idle" | "calling" | "connected" | "ended";
import { supabase } from "@/integrations/supabase/client";
import HeroSection from "@/components/demo/HeroSection";
import DemoNavbar from "@/components/demo/DemoNavbar";
import { trackEvent, trackSessionStart, trackSessionEnd, trackSectionEnter, trackSectionLeave, startScrollTracking, stopScrollTracking, startClickTracking, stopClickTracking, trackReturnVisit } from "@/lib/tracking";

const VoiceAgentSection = lazy(() => import("@/components/demo/VoiceAgentSection"));
const PersonalizationProofSection = lazy(() => import("@/components/demo/PersonalizationProofSection"));
const ProblemSection = lazy(() => import("@/components/demo/ProblemSection"));
const OutcomeSection = lazy(() => import("@/components/demo/OutcomeSection"));
const CTASection = lazy(() => import("@/components/demo/CTASection"));
const FooterSection = lazy(() => import("@/components/demo/FooterSection"));
const StickyCallButton = lazy(() => import("@/components/demo/StickyCallButton"));
const ChatWidget = lazy(() => import("@/components/chatbot/ChatWidget"));

// Dental-specific sections
const DentalProblemSection = lazy(() => import("@/components/demo/DentalProblemSection"));
const DentalOutcomeSection = lazy(() => import("@/components/demo/DentalOutcomeSection"));
const DentalSolutionSection = lazy(() => import("@/components/demo/DentalSolutionSection"));
const DentalROISection = lazy(() => import("@/components/demo/DentalROISection"));
const DentalWhyClinicSection = lazy(() => import("@/components/demo/DentalWhyClinicSection"));

// Real-estate specific sections
const PropertyShowcaseSection = lazy(() => import("@/components/demo/realestate/PropertyShowcaseSection"));
const RealEstateValueSection = lazy(() => import("@/components/demo/realestate/RealEstateValueSection"));

// Ecommerce specific sections
const ProductGridSection = lazy(() => import("@/components/demo/ecommerce/ProductGridSection"));
const EcommerceValueSection = lazy(() => import("@/components/demo/ecommerce/EcommerceValueSection"));
const EcommerceChatWidget = lazy(() => import("@/components/chatbot/EcommerceChatWidget"));

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
  dynamic_content: any | null;
}

interface LinkedChatbot {
  id: string;
  widget_config: any;
  research_data: any;
  logo_url: string | null;
}

const SectionFallback = () => <div className="h-32" />;

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
  const [chatOpen, setChatOpen] = useState(false);

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

      // Track page view + session start + scroll/click tracking + return visits
      const opts = { demoPageId: data.id, businessName: data.business_name };
      trackEvent(data.slug, "page_view", opts);
      trackSessionStart(data.slug, opts);
      startScrollTracking(data.slug, opts);
      startClickTracking(data.slug, opts);
      trackReturnVisit(data.slug, opts);
    };

    fetchPage();

    // Session end on unload/visibility
    const handleUnload = () => {
      if (resolvedSlug) trackSessionEnd(resolvedSlug);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && resolvedSlug) {
        trackSessionEnd(resolvedSlug);
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (resolvedSlug) trackSessionEnd(resolvedSlug);
      stopScrollTracking();
      stopClickTracking();
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [resolvedSlug]);

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
    if (!page || callStatus === "calling" || callStatus === "connected") return;
    try {
      setCallStatus("calling");
      setCallSeconds(0);
      if (resolvedSlug) trackEvent(resolvedSlug, "voice_call_started", { demoPageId: page.id, businessName: page.business_name });
      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(page.vapi_key);

      vapi.on("call-start", () => {
        setCallStatus("connected");
        timerRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000);
      });
      vapi.on("call-end", () => {
        setCallStatus("ended");
        if (timerRef.current) clearInterval(timerRef.current);
      });

      vapi.start(page.assistant_id);
      setVapiInstance(vapi);
    } catch (err) {
      console.error("Vapi initialization failed:", err);
      setCallStatus("idle");
    }
  }, [page, callStatus]);

  const endVapi = useCallback(() => {
    if (vapiInstance) {
      vapiInstance.stop();
      setCallStatus("ended");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [vapiInstance]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleBookCall = useCallback(() => {
    const url = page?.calendly_url || globalCalendarUrl;
    if (url) window.open(url, "_blank");
  }, [page, globalCalendarUrl]);

  const scrollToDemo = useCallback(() => {
    document.getElementById("demo-section")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const openChatbot = useCallback(() => {
    setChatOpen(true);
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
  const dc = (page.dynamic_content as any) || {};
  const chatbotNavItems = linkedChatbot?.widget_config?.navItems || dc.chatbot_nav_items || undefined;
  const isDental = ["dental", "clinic", "dentist", "healthcare", "medical", "doctor"]
    .some(k => (page.industry || "").toLowerCase().includes(k));
  const isRealEstate = ["real estate", "real_estate", "realestate", "property", "realty"]
    .some(k => (page.industry || "").toLowerCase().includes(k));
  const isEcommerce = ["ecommerce", "e-commerce", "shop", "store", "retail"]
    .some(k => (page.industry || "").toLowerCase().includes(k));
  const wt = dc.website_template || {};

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
          onEndCall={endVapi}
          onTryChat={openChatbot}
          callStatus={callStatus}
          callSeconds={callSeconds}
          floatingBubbles={dc.floating_bubbles}
        />
      </div>

      <Suspense fallback={<SectionFallback />}>
        <div id="demo-section">
        <VoiceAgentSection
            companyName={companyName}
            callStatus={callStatus}
            callSeconds={callSeconds}
            onTryDemo={startVapi}
            onEndCall={endVapi}
            onOpenChat={openChatbot}
            voicePrompts={dc.voice_prompts}
          />
        </div>


        {isDental ? (
          <>
            <DentalProblemSection companyName={companyName} problems={dc.problem_statements} onBookCall={handleBookCall} />
            <DentalWhyClinicSection scenarios={wt.why_clinic_scenarios} />
            <DentalROISection roiDefaults={wt.roi_defaults} onBookCall={handleBookCall} />
            <DentalOutcomeSection companyName={companyName} benefits={wt.outcome_benefits} onScrollToDemo={scrollToDemo} />
            <DentalSolutionSection companyName={companyName} features={wt.solution_features} onBookCall={handleBookCall} />
          </>
        ) : isRealEstate ? (
          <>
            <PropertyShowcaseSection
              companyName={companyName}
              properties={dc.properties || research.properties}
              onChat={openChatbot}
              onBookCall={handleBookCall}
            />
            <RealEstateValueSection />
          </>
        ) : isEcommerce ? (
          <>
            <ProductGridSection chatbotId={linkedChatbot?.id} companyName={companyName} onOpenChat={openChatbot} />
            <EcommerceValueSection />
          </>
        ) : (
          <>
            <ProblemSection companyName={companyName} problems={dc.problem_statements} industry={page.industry || undefined} />
            <OutcomeSection companyName={companyName} outcomes={dc.outcome_metrics} />
          </>
        )}

        <CTASection
          companyName={companyName}
          ctaText={page.cta_text || undefined}
          slug={page.slug}
          onBookCall={handleBookCall}
          industry={page.industry || undefined}
        />

        <FooterSection
          businessName={page.business_name}
          contactEmail={page.contact_email || undefined}
          contactPhone={page.contact_phone || undefined}
          logoUrl={logoUrl}
        />

        <StickyCallButton
          visible={scrolledPastHero}
          callStatus={callStatus}
          onTryCall={startVapi}
          onEndCall={endVapi}
        />

        {linkedChatbot && (
          isEcommerce ? (
            <EcommerceChatWidget
              chatbotId={linkedChatbot.id}
              greeting={linkedChatbot.widget_config?.greeting}
              logoUrl={logoUrl}
              businessName={companyName}
              externalOpen={chatOpen}
              onExternalOpenChange={setChatOpen}
              vapiKey={page.vapi_key}
              assistantId={page.assistant_id}
            />
          ) : (
            <ChatWidget
              chatbotId={linkedChatbot.id}
              greeting={linkedChatbot.widget_config?.greeting}
              logoUrl={logoUrl}
              businessName={companyName}
              calendarUrl={page.calendly_url || globalCalendarUrl || undefined}
              externalOpen={chatOpen}
              onExternalOpenChange={setChatOpen}
              navItems={chatbotNavItems}
              industry={page.industry || undefined}
            />
          )
        )}
      </Suspense>
    </div>
  );
};

export default DemoPage;
