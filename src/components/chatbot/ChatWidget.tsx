import { useState } from "react";
import { MessageCircle, X, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import ChatWindow from "./ChatWindow";
import { type ActionButton } from "./ActionButtons";

interface ChatWidgetProps {
  chatbotId: string;
  greeting?: string;
  logoUrl?: string;
  businessName?: string;
  suggestions?: string[];
  quickActions?: ActionButton[];
}

const ChatWidget = ({ chatbotId, greeting, logoUrl, businessName, suggestions, quickActions }: ChatWidgetProps) => {
  const [open, setOpen] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const isMobile = useIsMobile();

  const navItems: ActionButton[] = [
    { icon: "🍽", label: "Menu", value: "Show me the full menu" },
    { icon: "🛒", label: "Order", value: "I want to order food" },
    { icon: "📅", label: "Reserve", value: "I want to reserve a table" },
    { icon: "📍", label: "Location", value: "What's your location and hours?" },
    { icon: "❓", label: "FAQ", value: "What are your frequently asked questions?" },
  ];

  const [pendingMsg, setPendingMsg] = useState<string | null>(null);

  const handleNavAction = (btn: ActionButton) => {
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
          {/* Header */}
          <div className="relative flex items-center justify-between border-b bg-gradient-to-r from-primary to-primary/90 px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-3">
              {/* Logo with animation */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary-foreground/20 animate-pulse" />
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="relative h-9 w-9 rounded-full object-cover ring-2 ring-primary-foreground/30" />
                ) : (
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/20">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                )}
                {/* Online dot */}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-primary bg-green-400" />
              </div>
              <div>
                <span className="font-semibold text-sm block leading-tight">{businessName || "Chat with us"}</span>
                <span className="text-[10px] text-primary-foreground/70">Online now</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => setShowNav(!showNav)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navigation dropdown */}
          {showNav && (
            <div className="border-b bg-card p-2 animate-fade-in">
              <div className="grid grid-cols-3 gap-1.5">
                {navItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleNavAction(item)}
                    className="flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat window */}
          <ChatWindow
            chatbotId={chatbotId}
            greeting={greeting || "Hi! How can I help you today?"}
            suggestions={suggestions}
            businessName={businessName}
            logoUrl={logoUrl}
            quickActions={quickActions}
            pendingMessage={pendingMsg}
            onPendingConsumed={() => setPendingMsg(null)}
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
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-400 border-2 border-background animate-pulse" />
          )}
        </Button>
      )}
    </div>
  );
};

export default ChatWidget;
