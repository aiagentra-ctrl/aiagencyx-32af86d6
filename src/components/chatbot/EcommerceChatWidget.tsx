// E-commerce variant of ChatWidget — uses EcommerceChatWindow with embedded voice.
import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import EcommerceChatWindow from "./EcommerceChatWindow";
import { type ActionButton } from "./ActionButtons";
import { trackEvent } from "@/lib/tracking";

interface NavItem { label: string; value: string; }

interface EcommerceChatWidgetProps {
  chatbotId: string;
  greeting?: string;
  logoUrl?: string;
  businessName?: string;
  quickActions?: ActionButton[];
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  vapiKey?: string;
  assistantId?: string;
}

const ECOM_NAV: NavItem[] = [
  { label: "Bestsellers", value: "Show me your bestselling products" },
  { label: "New Arrivals", value: "What are your newest products?" },
  { label: "Shipping", value: "What's your shipping policy?" },
  { label: "Returns", value: "What's your return policy?" },
  { label: "Contact", value: "How can I contact a human agent?" },
];

const EcommerceChatWidget = ({
  chatbotId, greeting, logoUrl, businessName, quickActions,
  externalOpen, onExternalOpenChange, vapiKey, assistantId,
}: EcommerceChatWidgetProps) => {
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
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);

  useEffect(() => {
    if (externalOpen !== undefined) setInternalOpen(externalOpen);
  }, [externalOpen]);

  const windowClass = isMobile
    ? "fixed inset-0 z-50 flex flex-col bg-background"
    : "mb-3 w-[420px] h-[620px] rounded-3xl border border-border/60 bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300";

  return (
    <div className={isMobile && open ? "" : "fixed bottom-5 right-5 z-50"}>
      {open && (
        <div className={windowClass}>
          {/* Premium gradient header */}
          <div className="relative flex items-center justify-between border-b border-border/40 bg-gradient-to-br from-primary via-primary to-primary/85 px-4 py-3.5 text-primary-foreground overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="relative flex items-center gap-3">
              <div className="relative shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt={businessName || ""} className="h-10 w-auto max-w-[80px] rounded-xl object-contain ring-2 ring-primary-foreground/20 bg-primary-foreground/10" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/20">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-emerald-400 shadow-sm" />
              </div>
              <div>
                <span className="font-semibold text-sm block leading-tight">{businessName || "Shopping Assistant"}</span>
                <span className="text-[10px] text-primary-foreground/80 flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-emerald-300 animate-pulse" />
                  AI shopping concierge · chat + voice
                </span>
              </div>
            </div>
            <div className="relative flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/15 rounded-xl" onClick={() => setShowNav(!showNav)}>
                <Menu className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/15 rounded-xl" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showNav && (
            <div className="border-b border-border/40 bg-card p-2 animate-fade-in">
              <div className="grid grid-cols-3 gap-1.5">
                {ECOM_NAV.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => { setPendingMsg(item.value); setShowNav(false); }}
                    className="rounded-xl px-2 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <EcommerceChatWindow
            chatbotId={chatbotId}
            greeting={greeting}
            businessName={businessName}
            logoUrl={logoUrl}
            quickActions={quickActions}
            pendingMessage={pendingMsg}
            onPendingConsumed={() => setPendingMsg(null)}
            vapiKey={vapiKey}
            assistantId={assistantId}
          />
        </div>
      )}
      {!(isMobile && open) && (
        <Button
          onClick={() => setOpen(!open)}
          size="icon"
          className="h-14 w-14 rounded-full shadow-xl shadow-primary/30 hover:scale-105 transition-all duration-200 relative bg-gradient-to-br from-primary to-primary/80"
        >
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          {!open && (
            <>
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-background" />
              <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping opacity-75" />
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default EcommerceChatWidget;
