import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import ChatWindow from "./ChatWindow";
import { type ActionButton } from "./ActionButtons";
import { trackEvent } from "@/lib/tracking";

interface NavItem {
  label: string;
  value: string;
}

interface ChatWidgetProps {
  chatbotId: string;
  greeting?: string;
  logoUrl?: string;
  businessName?: string;
  suggestions?: string[];
  quickActions?: ActionButton[];
  calendarUrl?: string;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  navItems?: NavItem[];
  industry?: string;
}

const getDefaultNavItems = (industry?: string): NavItem[] => {
  const ind = (industry || "").toLowerCase();
  if (["restaurant", "cafe", "food", "bakery", "pizzeria"].some(k => ind.includes(k))) {
    return [
      { label: "Menu", value: "Show me the full menu" },
      { label: "Order", value: "I want to order food" },
      { label: "Reserve", value: "I want to reserve a table" },
      { label: "Location", value: "What's your location and hours?" },
      { label: "FAQ", value: "What are your frequently asked questions?" },
    ];
  }
  if (["dental", "medical", "clinic", "doctor", "health", "hospital"].some(k => ind.includes(k))) {
    return [
      { label: "Services", value: "What services do you offer?" },
      { label: "Appointment", value: "I want to book an appointment" },
      { label: "Hours", value: "What are your hours and location?" },
      { label: "Insurance", value: "What insurance do you accept?" },
      { label: "FAQ", value: "What are your frequently asked questions?" },
    ];
  }
  if (["salon", "spa", "beauty", "barber", "hair"].some(k => ind.includes(k))) {
    return [
      { label: "Services", value: "What services do you offer?" },
      { label: "Book", value: "I want to book an appointment" },
      { label: "Pricing", value: "What are your prices?" },
      { label: "Hours", value: "What are your hours and location?" },
      { label: "FAQ", value: "What are your frequently asked questions?" },
    ];
  }
  return [
    { label: "Services", value: "What services do you offer?" },
    { label: "Book", value: "I want to book an appointment" },
    { label: "Contact", value: "How can I contact you?" },
    { label: "Hours", value: "What are your hours and location?" },
    { label: "FAQ", value: "What are your frequently asked questions?" },
  ];
};

const ChatWidget = ({ chatbotId, greeting, logoUrl, businessName, suggestions, quickActions, calendarUrl, externalOpen, onExternalOpenChange, navItems, industry }: ChatWidgetProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const trackedOpen = useRef(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onExternalOpenChange?.(v);
    if (v && !trackedOpen.current) {
      trackedOpen.current = true;
      trackEvent(chatbotId, "chatbot_opened", { linkType: "chatbot", chatbotId, businessName: businessName || chatbotId });
    }
  };
  const [showNav, setShowNav] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (externalOpen !== undefined) setInternalOpen(externalOpen);
  }, [externalOpen]);

  const resolvedNavItems = navItems && navItems.length > 0 ? navItems : defaultNavItems;

  const [pendingMsg, setPendingMsg] = useState<string | null>(null);

  const handleNavAction = (btn: NavItem) => {
    setPendingMsg(btn.value);
    setShowNav(false);
  };

  const windowClass = isMobile
    ? "fixed inset-0 z-50 flex flex-col bg-background"
    : "mb-3 w-[400px] h-[560px] rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300";

  return (
    <div className={isMobile && open ? "" : "fixed bottom-5 right-5 z-50"}>
      {open && (
        <div className={windowClass}>
          <div className="relative flex items-center justify-between border-b bg-gradient-to-r from-primary to-primary/90 px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt={businessName || ""} className="relative h-10 w-auto max-w-[80px] rounded-lg object-contain ring-2 ring-primary-foreground/20 bg-primary-foreground/10" />
                ) : (
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/20">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-green-400" />
              </div>
              <div>
                <span className="font-semibold text-sm block leading-tight">{businessName || "Chat with us"}</span>
                <span className="text-[10px] text-primary-foreground/70">Online now</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setShowNav(!showNav)}>
                <Menu className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showNav && (
            <div className="border-b bg-card p-2 animate-fade-in">
              <div className="grid grid-cols-3 gap-1.5">
                {resolvedNavItems.map((item, i) => (
                  <button key={i} onClick={() => handleNavAction(item)} className="flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <ChatWindow
            chatbotId={chatbotId}
            greeting={greeting || "How can I help you today?"}
            suggestions={suggestions}
            businessName={businessName}
            logoUrl={logoUrl}
            quickActions={quickActions}
            pendingMessage={pendingMsg}
            onPendingConsumed={() => setPendingMsg(null)}
            calendarUrl={calendarUrl}
          />
        </div>
      )}
      {!(isMobile && open) && (
        <Button
          onClick={() => setOpen(!open)}
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg shadow-primary/25 hover:scale-105 transition-all duration-200 relative"
        >
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          {!open && (
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-green-400 border-2 border-background" />
          )}
        </Button>
      )}
    </div>
  );
};

export default ChatWidget;
