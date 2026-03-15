import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ChatWindow from "@/components/chatbot/ChatWindow";
import { MessageCircle, Menu, X, Building2, Phone, Mail, Globe, HelpCircle, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

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

const SidePanel = ({ chatbot, onSuggestion }: { chatbot: ChatbotData; onSuggestion?: (q: string) => void }) => {
  const services: string[] = Array.isArray(chatbot.services) ? chatbot.services : [];
  const faqTopics: string[] = Array.isArray(chatbot.faq_topics) ? chatbot.faq_topics : [];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-5">
        {/* Business Info */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-primary" />
            About
          </h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            {chatbot.industry && (
              <p className="flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5" />
                {chatbot.industry}
              </p>
            )}
            {chatbot.website_url && (
              <a href={chatbot.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                <Globe className="h-3.5 w-3.5" />
                Visit Website
              </a>
            )}
          </div>
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Briefcase className="h-4 w-4 text-primary" />
              Services
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {services.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onSuggestion?.(`Tell me about ${s}`)}
                  className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FAQ */}
        {faqTopics.length > 0 && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <HelpCircle className="h-4 w-4 text-primary" />
              Common Questions
            </h3>
            <div className="space-y-1.5">
              {faqTopics.map((q, i) => (
                <button
                  key={i}
                  onClick={() => onSuggestion?.(q)}
                  className="block w-full text-left rounded-lg bg-muted px-3 py-2 text-xs text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

const ChatbotPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [chatbot, setChatbot] = useState<ChatbotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const load = async () => {
      if (!slug) { setLoading(false); return; }
      const { data } = await supabase
        .from("chatbots")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .single();
      if (data) setChatbot(data as unknown as ChatbotData);
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
  const hasSideContent = (Array.isArray(chatbot.services) && chatbot.services.length > 0) ||
    (Array.isArray(chatbot.faq_topics) && chatbot.faq_topics.length > 0);

  const handleSuggestion = (q: string) => {
    setPendingMessage(q);
    setSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          {logoUrl ? (
            <img src={logoUrl} alt={chatbot.business_name} className="h-10 w-10 rounded-full object-cover bg-primary-foreground/20" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/20">
              <MessageCircle className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-lg font-bold">{chatbot.business_name}</h1>
            <p className="text-xs opacity-80">
              {chatbot.industry ? `${chatbot.industry} • ` : ""}AI Assistant
            </p>
          </div>
          {hasSideContent && (
            isMobile ? (
              <Drawer open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <DrawerTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[70vh]">
                  <DrawerHeader>
                    <DrawerTitle>{chatbot.business_name}</DrawerTitle>
                  </DrawerHeader>
                  <SidePanel chatbot={chatbot} onSuggestion={handleSuggestion} />
                </DrawerContent>
              </Drawer>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            )
          )}
        </div>
      </header>

      {/* Main */}
      <div className="mx-auto flex w-full max-w-5xl flex-1">
        {/* Chat */}
        <div className="flex flex-1 flex-col">
          <ChatWindow
            chatbotId={chatbot.id}
            greeting={greeting}
            className="flex-1"
            suggestions={
              Array.isArray(chatbot.faq_topics) && chatbot.faq_topics.length > 0
                ? chatbot.faq_topics.slice(0, 3)
                : Array.isArray(chatbot.services) && chatbot.services.length > 0
                  ? chatbot.services.slice(0, 3).map((s: string) => `Tell me about ${s}`)
                  : undefined
            }
            pendingMessage={pendingMessage}
            onPendingConsumed={() => setPendingMessage(null)}
          />
        </div>

        {/* Desktop Side Panel */}
        {!isMobile && sidebarOpen && hasSideContent && (
          <div className="w-72 border-l bg-card animate-in slide-in-from-right-4 duration-200">
            <SidePanel chatbot={chatbot} onSuggestion={handleSuggestion} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatbotPage;
