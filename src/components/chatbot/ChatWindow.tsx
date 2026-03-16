import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";
import ChatMessage from "./ChatMessage";
import WelcomeScreen from "./WelcomeScreen";
import { type ActionButton } from "./ActionButtons";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-conversation`;

type Msg = { role: "user" | "assistant"; content: string };

interface ChatWindowProps {
  chatbotId: string;
  greeting?: string;
  className?: string;
  suggestions?: string[];
  pendingMessage?: string | null;
  onPendingConsumed?: () => void;
  businessName?: string;
  logoUrl?: string;
  quickActions?: ActionButton[];
}

const ChatWindow = ({
  chatbotId, greeting, className, suggestions,
  pendingMessage, onPendingConsumed,
  businessName, logoUrl, quickActions,
}: ChatWindowProps) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(crypto.randomUUID());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (pendingMessage) {
      sendMessage(pendingMessage);
      onPendingConsumed?.();
    }
  }, [pendingMessage]);

  const sendMessage = useCallback(async (text: string) => {
    text = text.trim();
    if (!text || isLoading) return;

    if (!started) setStarted(true);

    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ chatbotId, sessionId: sessionId.current, message: text }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const updateAssistant = (content: string) => {
        assistantSoFar += content;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      const processLine = (line: string) => {
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) return false;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") return true;
        try {
          const c = JSON.parse(jsonStr).choices?.[0]?.delta?.content;
          if (c) updateAssistant(c);
        } catch { return false; }
        return false;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let ni: number;
        while ((ni = textBuffer.indexOf("\n")) !== -1) {
          const line = textBuffer.slice(0, ni);
          textBuffer = textBuffer.slice(ni + 1);
          if (processLine(line)) break;
        }
      }

      // flush
      if (textBuffer.trim()) {
        for (const raw of textBuffer.split("\n")) {
          if (raw) processLine(raw);
        }
      }
    } catch (e: any) {
      console.error("Chat error:", e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: e.message || "Sorry, something went wrong." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [chatbotId, isLoading, started]);

  const handleAction = useCallback((btn: ActionButton) => {
    if (!btn.url) sendMessage(btn.value);
  }, [sendMessage]);

  const defaultQuickActions: ActionButton[] = quickActions || [
    { icon: "🍽", label: "View Menu", value: "Show me the menu" },
    { icon: "📅", label: "Reserve Table", value: "I want to reserve a table" },
    { icon: "📍", label: "Location & Hours", value: "What are your hours and location?" },
    { icon: "🎉", label: "Today's Offers", value: "What deals or offers do you have today?" },
  ];

  return (
    <div className={`flex flex-col h-full ${className || ""}`}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {!started ? (
          <WelcomeScreen
            businessName={businessName || "Chat with us"}
            logoUrl={logoUrl}
            greeting={greeting || "How can I help you today?"}
            quickActions={defaultQuickActions}
            onAction={handleAction}
          />
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <ChatMessage
                key={i}
                role={msg.role}
                content={msg.content}
                onAction={handleAction}
                isLatest={i === messages.length - 1}
              />
            ))}

            {/* Typing indicator */}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t bg-card/50 p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1 rounded-xl border-muted-foreground/20"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="rounded-xl shrink-0"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
