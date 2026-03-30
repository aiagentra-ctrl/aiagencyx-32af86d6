import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
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
  calendarUrl?: string;
  industry?: string;
}

const getDefaultQuickActions = (industry?: string): ActionButton[] => {
  const ind = (industry || "").toLowerCase();
  if (["restaurant", "cafe", "food", "bakery", "pizzeria"].some(k => ind.includes(k))) {
    return [
      { label: "View Menu", value: "Show me the menu" },
      { label: "Reserve Table", value: "I want to reserve a table" },
      { label: "Location & Hours", value: "What are your hours and location?" },
      { label: "Today's Offers", value: "What deals or offers do you have today?" },
    ];
  }
  if (["dental", "medical", "clinic", "doctor", "health", "hospital"].some(k => ind.includes(k))) {
    return [
      { label: "Our Services", value: "What services do you offer?" },
      { label: "Book Appointment", value: "I want to book an appointment" },
      { label: "Hours & Location", value: "What are your hours and location?" },
      { label: "Insurance Info", value: "What insurance plans do you accept?" },
    ];
  }
  if (["salon", "spa", "beauty", "barber", "hair"].some(k => ind.includes(k))) {
    return [
      { label: "Our Services", value: "What services do you offer?" },
      { label: "Book Appointment", value: "I want to book an appointment" },
      { label: "Pricing", value: "What are your prices?" },
      { label: "Hours & Location", value: "What are your hours and location?" },
    ];
  }
  return [
    { label: "Our Services", value: "What services do you offer?" },
    { label: "Book Now", value: "I want to book an appointment" },
    { label: "Contact Info", value: "How can I contact you?" },
    { label: "FAQ", value: "What are your frequently asked questions?" },
  ];
};

const ChatWindow = ({
  chatbotId, greeting, className, suggestions,
  pendingMessage, onPendingConsumed,
  businessName, logoUrl, quickActions, calendarUrl, industry,
}: ChatWindowProps) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
      const body: any = { chatbotId, sessionId: sessionId.current, message: text };
      if (calendarUrl) body.calendarUrl = calendarUrl;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
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
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatbotId, isLoading, started, calendarUrl]);

  const handleAction = useCallback((btn: ActionButton) => {
    if (!btn.url) sendMessage(btn.value);
  }, [sendMessage]);

  const defaultQuickActions: ActionButton[] = quickActions || getDefaultQuickActions(industry);

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
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <ChatMessage
                key={i}
                role={msg.role}
                content={msg.content}
                onAction={handleAction}
                isLatest={i === messages.length - 1}
              />
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
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
      <div className="border-t bg-card/80 backdrop-blur-sm p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="rounded-xl shrink-0 h-10 w-10"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
