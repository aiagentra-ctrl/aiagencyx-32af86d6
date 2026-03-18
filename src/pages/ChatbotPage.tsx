import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ChatWidget from "@/components/chatbot/ChatWidget";
import { MessageCircle, Globe, Briefcase, Calendar, ArrowRight, Bot, Sparkles, Clock, Shield, HelpCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ChatbotData {
  id: string;
  business_name: string;
  slug: string;
  system_prompt: string;
  widget_config: any;
  status: string;
  industry: string | null;
  brand_tone: string | null;
  services: any;
  faq_topics: any;
  research_data: any;
  website_url: string | null;
  logo_url: string | null;
}

const ChatbotPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [chatbot, setChatbot] = useState<ChatbotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarUrl, setCalendarUrl] = useState("");
  const [ctaText, setCtaText] = useState("Book a Call");

  useEffect(() => {
    const load = async () => {
      if (!slug) { setLoading(false); return; }
      const [chatbotRes, settingsRes] = await Promise.all([
        supabase.from("chatbots").select("*").eq("slug", slug).eq("status", "active").single(),
        supabase.from("site_settings").select("*"),
      ]);
      if (chatbotRes.data) setChatbot(chatbotRes.data as unknown as ChatbotData);
      if (settingsRes.data) {
        for (const row of settingsRes.data) {
          const r = row as any;
          if (r.key === "calendar_url" && r.value) setCalendarUrl(r.value);
          if (r.key === "default_cta_text" && r.value) setCtaText(r.value);
        }
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!chatbot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Chatbot Not Found</h1>
          <p className="text-muted-foreground">This chatbot doesn't exist or is inactive.</p>
        </div>
      </div>
    );
  }

  const greeting = chatbot.widget_config?.greeting || `Hi! Welcome to ${chatbot.business_name}. How can I help you today?`;
  const logoUrl = chatbot.logo_url || chatbot.widget_config?.logo;
  const services: string[] = Array.isArray(chatbot.services) ? chatbot.services : [];
  const faqTopics: string[] = Array.isArray(chatbot.faq_topics) ? chatbot.faq_topics : [];
  const research = chatbot.research_data as any || {};
  const detectedPages: any[] = research.detected_pages || research.pages || [];

  const handleBookCall = () => {
    if (calendarUrl) window.open(calendarUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="flex flex-col items-center text-center">
            {logoUrl ? (
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-pulse" style={{ animationDuration: "2s" }} />
                <img src={logoUrl} alt={chatbot.business_name} className="relative h-20 w-20 rounded-2xl object-cover shadow-lg" />
              </div>
            ) : (
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-pulse" style={{ animationDuration: "2s" }} />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 shadow-lg">
                  <Bot className="h-10 w-10 text-primary" />
                </div>
              </div>
            )}

            <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-foreground md:text-5xl">
              AI Assistant for {chatbot.business_name}
            </h1>
            <p className="mb-2 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Get instant answers about our menu, make reservations, and explore everything we offer — powered by AI.
            </p>
            {chatbot.industry && (
              <span className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Briefcase className="h-3.5 w-3.5" />
                {chatbot.industry}
              </span>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" className="gap-2 text-base shadow-lg shadow-primary/25" onClick={() => {
                document.getElementById("chatbot-demo")?.scrollIntoView({ behavior: "smooth" });
              }}>
                <MessageCircle className="h-5 w-5" />
                Try the AI Assistant
              </Button>
              {calendarUrl && (
                <Button size="lg" variant="outline" className="gap-2 text-base" onClick={handleBookCall}>
                  <Calendar className="h-5 w-5" />
                  {ctaText}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-t bg-card/50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="mb-10 text-center text-2xl font-bold text-foreground md:text-3xl">
            What Your AI Assistant Can Do
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<Bot className="h-8 w-8 text-primary" />}
              title="Browse Menu & Order"
              description="Explore our full menu, see prices, and get recommendations instantly."
            />
            <FeatureCard
              icon={<Clock className="h-8 w-8 text-primary" />}
              title="24/7 Availability"
              description="Get answers anytime — our AI assistant never takes a break."
            />
            <FeatureCard
              icon={<Shield className="h-8 w-8 text-primary" />}
              title="Reserve & Contact"
              description="Book a table, check hours, or get directions — all in one chat."
            />
          </div>
        </div>
      </section>

      {/* Services / Quick Links */}
      {services.length > 0 && (
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="mb-8 text-center text-2xl font-bold text-foreground">What We Offer</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {services.map((service, i) => (
                <span key={i} className="rounded-full border border-primary/20 bg-primary/5 px-5 py-2.5 text-sm font-medium text-primary">
                  {service}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      {faqTopics.length > 0 && (
        <section className="border-t bg-muted/20">
          <div className="mx-auto max-w-3xl px-6 py-16">
            <div className="mb-8 text-center">
              <HelpCircle className="mx-auto mb-3 h-8 w-8 text-primary" />
              <h2 className="text-2xl font-bold text-foreground md:text-3xl">Frequently Asked Questions</h2>
              <p className="mt-2 text-muted-foreground">Quick answers to common questions</p>
            </div>
            <div className="space-y-3">
              {faqTopics.map((topic, i) => (
                <Collapsible key={i}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border bg-card px-5 py-4 text-left text-sm font-medium text-foreground hover:bg-muted/50 transition-colors group">
                    <span>{topic}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-5 pt-2 pb-4 text-sm text-muted-foreground">
                    Ask our AI assistant for a detailed answer — click the chat button below!
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Chatbot Demo Section */}
      <section id="chatbot-demo" className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-2xl font-bold text-foreground md:text-3xl">
              <Sparkles className="mb-1 mr-2 inline h-6 w-6 text-primary" />
              Try the AI Assistant Now
            </h2>
            <p className="text-muted-foreground">
              Ask anything about {chatbot.business_name} — menu, reservations, hours, or specials.
            </p>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Click the chat button in the bottom-right corner to start
          </p>
        </div>
      </section>

      {/* CTA Section */}
      {calendarUrl && (
        <section className="border-t bg-primary/5">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <Calendar className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h2 className="mb-3 text-2xl font-bold text-foreground">Book a Demo</h2>
            <p className="mb-6 text-muted-foreground">
              See how our AI assistant can transform customer experience for {chatbot.business_name}.
            </p>
            <Button size="lg" className="gap-2 text-base" onClick={handleBookCall}>
              <Calendar className="h-5 w-5" />
              {ctaText}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t bg-card py-8">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by AI • Built for {chatbot.business_name}
            {chatbot.website_url && (
              <>
                {" • "}
                <a href={chatbot.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  Visit Website
                </a>
              </>
            )}
          </p>
        </div>
      </footer>

      {/* Floating Chat Widget */}
      <ChatWidget
        chatbotId={chatbot.id}
        greeting={greeting}
        logoUrl={logoUrl}
        businessName={chatbot.business_name}
      />
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="rounded-xl border bg-card p-6 text-center shadow-sm transition-all hover:shadow-md hover:-translate-y-1 duration-200">
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
      {icon}
    </div>
    <h3 className="mb-2 text-lg font-semibold text-card-foreground">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

export default ChatbotPage;
