import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatWindow from "./ChatWindow";

interface ChatWidgetProps {
  chatbotId: string;
  greeting?: string;
}

const ChatWidget = ({ chatbotId, greeting }: ChatWidgetProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-[360px] h-[500px] rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground rounded-t-2xl">
            <span className="font-semibold text-sm">Chat with us</span>
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
          />
        </div>
      )}
      <Button
        onClick={() => setOpen(!open)}
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg hover:scale-105 transition-transform"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>
    </div>
  );
};

export default ChatWidget;
