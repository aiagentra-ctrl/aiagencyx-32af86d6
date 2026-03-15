import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ChatWindow from "@/components/chatbot/ChatWindow";
import { MessageCircle } from "lucide-react";

interface ChatbotData {
  id: string;
  business_name: string;
  slug: string;
  system_prompt: string;
  widget_config: any;
  status: string;
}

const ChatbotPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [chatbot, setChatbot] = useState<ChatbotData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("chatbots")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .single();

      if (data) setChatbot(data as unknown as ChatbotData);
      setLoading(false);
    };
    fetch();
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

  const greeting = chatbot.widget_config?.greeting || "Hi! How can I help you today?";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/20">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{chatbot.business_name}</h1>
            <p className="text-xs opacity-80">AI Assistant</p>
          </div>
        </div>
      </header>

      {/* Chat */}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <ChatWindow chatbotId={chatbot.id} greeting={greeting} className="flex-1" />
      </div>
    </div>
  );
};

export default ChatbotPage;
