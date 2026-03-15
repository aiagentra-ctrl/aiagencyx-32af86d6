import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import ChatWindow from "./ChatWindow";

interface ChatWidgetProps {
  chatbotId: string;
  greeting?: string;
  logoUrl?: string;
  businessName?: string;
  suggestions?: string[];
}

const ChatWidget = ({ chatbotId, greeting, logoUrl, businessName, suggestions }: ChatWidgetProps) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const windowClass = isMobile
    ? "fixed inset-0 z-50 flex flex-col bg-background"
    : "mb-3 w-[380px] h-[520px] rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300";

  return (
    <div className={isMobile && open ? "" : "fixed bottom-5 right-5 z-50"}>
      {open && (
        <div className={windowClass}>
          <div className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-7 w-7 rounded-full object-cover bg-primary-foreground/20" />
              ) : null}
              <span className="font-semibold text-sm">{businessName || "Chat with us"}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary-foreground hover:bg-primary/80"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ChatWindow
            chatbotId={chatbotId}
            greeting={greeting || "Hi! How can I help you today?"}
            suggestions={suggestions}
          />
        </div>
      )}
      {!(isMobile && open) && (
        <Button
          onClick={() => setOpen(!open)}
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg hover:scale-105 transition-transform"
        >
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </Button>
      )}
    </div>
  );
};

export default ChatWidget;
