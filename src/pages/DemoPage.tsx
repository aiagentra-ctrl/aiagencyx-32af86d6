import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import HeroSection from "@/components/demo/HeroSection";
import BenefitsSection from "@/components/demo/BenefitsSection";
import FeaturesSection from "@/components/demo/FeaturesSection";
import VoiceAgentSection from "@/components/demo/VoiceAgentSection";
import SocialProofSection from "@/components/demo/SocialProofSection";
import CTASection from "@/components/demo/CTASection";
import FooterSection from "@/components/demo/FooterSection";
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

const DemoPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<DemoPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vapiStarted, setVapiStarted] = useState(false);
  const [vapiInstance, setVapiInstance] = useState<any>(null);

  // Detect subdomain-based routing
  const resolvedSlug = (() => {
    if (slug) return slug;
    const hostname = window.location.hostname;
    const parts = hostname.split(".");
    // If subdomain exists (e.g. clientname.myagency.com)
    if (parts.length >= 3 && parts[0] !== "www") {
      return parts[0];
    }
    return null;
  })();

  useEffect(() => {
    const fetchPage = async () => {
      if (!resolvedSlug) {
        setError("Demo page not found");
        setLoading(false);
        return;
      }

      // Try slug match, then custom_subdomain match
      let { data, error: fetchError } = await supabase
        .from("demo_pages")
        .select("*")
        .eq("slug", resolvedSlug)
        .single();

      if (fetchError || !data) {
        const subResult = await supabase
          .from("demo_pages")
          .select("*")
          .eq("custom_subdomain", resolvedSlug)
          .single();
        data = subResult.data;
        fetchError = subResult.error;
      }

      if (fetchError || !data) {
        setError("Demo page not found");
        setLoading(false);
        return;
      }

      setPage(data as unknown as DemoPageData);
      setLoading(false);

      // Increment views
      await supabase
        .from("demo_pages")
        .update({ views: (data.views ?? 0) + 1 })
        .eq("id", data.id);
    };

    fetchPage();
  }, [resolvedSlug]);

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
    if (page?.calendly_url) {
      window.open(page.calendly_url, "_blank");
    }
  }, [page]);

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

  return (
    <div className="min-h-screen bg-background">
      <HeroSection
        clientName={page.client_name || undefined}
        companyName={page.company_name || page.business_name}
        heroTitle={page.hero_title || undefined}
        heroSubtitle={page.hero_subtitle || undefined}
        onTryDemo={startVapi}
        onBookCall={handleBookCall}
      />
      <BenefitsSection
        companyName={page.company_name || page.business_name}
        benefits={page.benefits as string[] | undefined}
      />
      <VoiceAgentSection
        companyName={page.company_name || page.business_name}
        vapiStarted={vapiStarted}
        onTryDemo={startVapi}
      />
      <FeaturesSection
        companyName={page.company_name || page.business_name}
        features={page.features as string[] | undefined}
      />
      <SocialProofSection socialProof={page.social_proof as any} />
      <CTASection
        companyName={page.company_name || page.business_name}
        ctaText={page.cta_text || undefined}
        onBookCall={handleBookCall}
        onTryDemo={startVapi}
      />
      <FooterSection
        businessName={page.business_name}
        contactEmail={page.contact_email || undefined}
        contactPhone={page.contact_phone || undefined}
      />
    </div>
  );
};

export default DemoPage;
