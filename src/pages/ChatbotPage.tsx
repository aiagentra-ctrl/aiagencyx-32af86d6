import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ChatWidget from "@/components/chatbot/ChatWidget";
import {
  MessageCircle, Globe, Briefcase, Calendar, ArrowRight, Bot, Sparkles,
  Clock, Shield, HelpCircle, ChevronDown, MapPin, Phone, Mail,
  Utensils, Star, Users, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  // Resolve calendar URL: widget_config > global settings
  useEffect(() => {
    if (chatbot?.widget_config?.calendarUrl) {
      setCalendarUrl(chatbot.widget_config.calendarUrl);
    }
  }, [chatbot]);

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
  const menuItems: any[] = research.menu_items || [];
  const categories: string[] = research.categories || [];
  const businessHours = research.business_hours || "";
  const address = research.address || "";
  const phone = research.phone || "";
  const email = research.email || "";

  const handleBookCall = () => {
    if (calendarUrl) window.open(calendarUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section — Premium */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="flex flex-col items-center text-center">
            {logoUrl ? (
              <div className="mb-8 rounded-2xl bg-card p-3 shadow-lg ring-1 ring-border">
                <img src={logoUrl} alt={chatbot.business_name} className="h-20 w-auto max-w-[200px] rounded-xl object-contain" />
              </div>
            ) : (
              <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 shadow-lg ring-1 ring-primary/20">
                <Bot className="h-10 w-10 text-primary" />
              </div>
            )}

            {chatbot.industry && (
              <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                <Briefcase className="h-3 w-3" />
                {chatbot.industry}
              </span>
            )}

            <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Welcome to{" "}
              <span className="text-primary">{chatbot.business_name}</span>
            </h1>
            <p className="mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl leading-relaxed">
              Get instant answers about our menu, make reservations, and explore everything we offer — powered by AI.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="gap-2 text-base shadow-lg shadow-primary/25 px-8 h-12" onClick={() => {
                document.getElementById("chatbot-demo")?.scrollIntoView({ behavior: "smooth" });
              }}>
                <MessageCircle className="h-5 w-5" />
                Try the AI Assistant
              </Button>
              {calendarUrl && (
                <Button size="lg" variant="outline" className="gap-2 text-base h-12 px-8" onClick={handleBookCall}>
                  <Calendar className="h-5 w-5" />
                  {ctaText}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y bg-card">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <StatItem icon={<Utensils className="h-5 w-5 text-primary" />} value={menuItems.length > 0 ? `${menuItems.length}+` : "Full"} label="Menu Items" />
            <StatItem icon={<Clock className="h-5 w-5 text-primary" />} value="24/7" label="AI Available" />
            <StatItem icon={<Zap className="h-5 w-5 text-primary" />} value="Instant" label="Responses" />
            <StatItem icon={<Star className="h-5 w-5 text-primary" />} value="Smart" label="Recommendations" />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-background">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">
              What Our AI Assistant Can Do
            </h2>
            <p className="text-muted-foreground text-lg">Everything you need, at your fingertips</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<Utensils className="h-7 w-7 text-primary" />}
              title="Browse Menu & Order"
              description="Explore our full menu with prices, get personalized recommendations, and place orders instantly."
            />
            <FeatureCard
              icon={<Users className="h-7 w-7 text-primary" />}
              title="Reserve a Table"
              description="Book a table step-by-step — choose date, time, party size, and get instant confirmation."
            />
            <FeatureCard
              icon={<Shield className="h-7 w-7 text-primary" />}
              title="Instant Answers"
              description="Get quick answers about hours, location, dietary options, specials, and more."
            />
          </div>
        </div>
      </section>

      {/* Menu Highlights */}
      {menuItems.length > 0 && (
        <section className="border-t bg-card/50">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mb-12 text-center">
              <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">Our Menu</h2>
              <p className="text-muted-foreground text-lg">Ask the AI assistant for more details or to place an order</p>
            </div>

            {categories.length > 0 ? (
              <div className="space-y-10">
                {categories.slice(0, 6).map((cat, ci) => {
                  const catItems = menuItems.filter((item: any) =>
                    item.category?.toLowerCase() === cat.toLowerCase()
                  ).slice(0, 6);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={ci}>
                      <h3 className="mb-4 text-xl font-bold text-foreground border-b border-border pb-2">{cat}</h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {catItems.map((item: any, i: number) => (
                          <MenuItemCard key={i} name={item.name} price={item.price} description={item.description} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {menuItems.slice(0, 12).map((item: any, i: number) => (
                  <MenuItemCard key={i} name={item.name} price={item.price} description={item.description} />
                ))}
              </div>
            )}

            {menuItems.length > 12 && (
              <p className="mt-8 text-center text-sm text-muted-foreground">
                And {menuItems.length - 12} more items — ask the AI assistant to see the full menu!
              </p>
            )}
          </div>
        </section>
      )}

      {/* Services */}
      {services.length > 0 && (
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="mb-8 text-center text-2xl font-bold text-foreground md:text-3xl">What We Offer</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {services.map((service, i) => (
                <span key={i} className="rounded-full border border-primary/20 bg-primary/5 px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10">
                  {service}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Business Info */}
      {(address || phone || email || businessHours) && (
        <section className="border-t bg-card/50">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <h2 className="mb-8 text-center text-2xl font-bold text-foreground md:text-3xl">Visit Us</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {address && (
                <InfoCard icon={<MapPin className="h-5 w-5 text-primary" />} label="Address" value={address} />
              )}
              {phone && (
                <InfoCard icon={<Phone className="h-5 w-5 text-primary" />} label="Phone" value={phone} />
              )}
              {email && (
                <InfoCard icon={<Mail className="h-5 w-5 text-primary" />} label="Email" value={email} />
              )}
              {businessHours && (
                <InfoCard icon={<Clock className="h-5 w-5 text-primary" />} label="Hours" value={businessHours} />
              )}
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
              {faqTopics.map((topic: string, i: number) => (
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
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-8 text-center">
            <Sparkles className="mx-auto mb-4 h-8 w-8 text-primary" />
            <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">
              Try the AI Assistant Now
            </h2>
            <p className="text-muted-foreground text-lg">
              Ask anything about {chatbot.business_name} — menu, reservations, hours, or specials.
            </p>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Click the chat button in the bottom-right corner to start a conversation
          </p>
        </div>
      </section>

      {/* CTA Section */}
      {calendarUrl && (
        <section className="border-t bg-primary">
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
            <h2 className="mb-4 text-3xl font-bold text-primary-foreground md:text-4xl">
              Ready to Experience {chatbot.business_name}?
            </h2>
            <p className="mb-8 text-primary-foreground/80 text-lg">
              Book a table or schedule a call — we'd love to hear from you.
            </p>
            <Button size="lg" variant="secondary" className="gap-2 text-base px-8 h-12" onClick={handleBookCall}>
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
            Powered by AI &middot; Built for {chatbot.business_name}
            {chatbot.website_url && (
              <>
                {" \u00B7 "}
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
        calendarUrl={calendarUrl || undefined}
      />
    </div>
  );
};

/* Sub-components */
const StatItem = ({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">{icon}</div>
    <div>
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </div>
);

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <Card className="border-border/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
    <CardContent className="p-6 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-card-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </CardContent>
  </Card>
);

const MenuItemCard = ({ name, price, description }: { name: string; price?: string; description?: string }) => (
  <div className="rounded-xl border border-border/50 bg-card p-4 transition-colors hover:bg-muted/30">
    <div className="flex items-start justify-between gap-2">
      <h4 className="text-sm font-semibold text-foreground">{name}</h4>
      {price && <span className="shrink-0 text-sm font-bold text-primary">{price}</span>}
    </div>
    {description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{description}</p>}
  </div>
);

const InfoCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">{icon}</div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  </div>
);

export default ChatbotPage;
