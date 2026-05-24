// Unified Chat + Voice in a single interface for e-commerce stores.
// Tap mic = start voice. Tap again = stop. Transcripts flow into the same thread.
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import ChatMessage from "./ChatMessage";
import WelcomeScreen from "./WelcomeScreen";
import VoiceMicButton, { type VoiceState } from "./VoiceMicButton";
import { type ActionButton } from "./ActionButtons";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-conversation`;

type Msg = { role: "user" | "assistant"; content: string };

interface EcommerceChatWindowProps {
  chatbotId: string;
  greeting?: string;
  className?: string;
  pendingMessage?: string | null;
  onPendingConsumed?: () => void;
  businessName?: string;
  logoUrl?: string;
  quickActions?: ActionButton[];
  vapiKey?: string;
  assistantId?: string;
}

const defaultEcomActions: ActionButton[] = [
  { label: "Browse Bestsellers", value: "Show me your bestselling products" },
  { label: "What's New", value: "What are your newest products?" },
  { label: "Shipping & Returns", value: "What's your shipping and return policy?" },
  { label: "Talk to Human", value: "Connect me with a human agent" },
];

const EcommerceChatWindow = ({
  chatbotId, greeting, className,
  pendingMessage, onPendingConsumed,
  businessName, logoUrl, quickActions,
  vapiKey, assistantId,
}: EcommerceChatWindowProps) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef(crypto.randomUUID());
  const vapiRef = useRef<any>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    text = text.trim();
    if (!text || isLoading) return;
    if (!started) setStarted(true);

    setMessages((prev) => [...prev, { role: "user", content: text }]);
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
      if (!resp.ok || !resp.body) throw new Error(`Error ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const updateAssistant = (c: string) => {
        assistantSoFar += c;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let ni: number;
        while ((ni = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, ni).replace(/\r$/, "");
          buf = buf.slice(ni + 1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") continue;
          try {
            const c = JSON.parse(j).choices?.[0]?.delta?.content;
            if (c) updateAssistant(c);
          } catch { /* partial */ }
        }
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: e?.message || "Sorry, something went wrong." }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatbotId, isLoading, started]);

  useEffect(() => {
    if (pendingMessage) {
      sendMessage(pendingMessage);
      onPendingConsumed?.();
    }
  }, [pendingMessage]);

  const handleAction = useCallback((btn: ActionButton) => {
    if (!btn.url) sendMessage(btn.value);
  }, [sendMessage]);

  const startVoice = useCallback(async () => {
    if (!vapiKey || !assistantId || voiceState === "listening" || voiceState === "speaking") return;
    try {
      setVoiceState("connecting");
      if (!started) setStarted(true);
      const { default: Vapi } = await import("@vapi-ai/web");
      const vapi = new Vapi(vapiKey);
      vapiRef.current = vapi;

      vapi.on("call-start", () => setVoiceState("listening"));
      vapi.on("speech-start", () => setVoiceState("speaking"));
      vapi.on("speech-end", () => setVoiceState("listening"));
      vapi.on("call-end", () => {
        setVoiceState("idle");
        vapiRef.current = null;
      });
      vapi.on("message", (msg: any) => {
        if (msg?.type === "transcript" && msg?.transcriptType === "final") {
          const role = msg.role === "user" ? "user" : "assistant";
          const content = msg.transcript || "";
          if (content.trim()) {
            setMessages((prev) => [...prev, { role, content }]);
          }
        }
      });

      vapi.start(assistantId);
    } catch (e) {
      console.error("Voice start failed", e);
      setVoiceState("idle");
    }
  }, [vapiKey, assistantId, voiceState, started]);

  const stopVoice = useCallback(() => {
    try { vapiRef.current?.stop?.(); } catch { /* noop */ }
    setVoiceState("idle");
    vapiRef.current = null;
  }, []);

  const toggleVoice = useCallback(() => {
    if (voiceState === "listening" || voiceState === "speaking") stopVoice();
    else startVoice();
  }, [voiceState, startVoice, stopVoice]);

  useEffect(() => {
    return () => { try { vapiRef.current?.stop?.(); } catch { /* noop */ } };
  }, []);

  const actions = quickActions || defaultEcomActions;
  const voiceLabel =
    voiceState === "connecting" ? "Connecting…" :
    voiceState === "listening" ? "Listening — tap mic to stop" :
    voiceState === "speaking" ? "Speaking…" :
    "";

  return (
    <div className={`flex flex-col h-full ${className || ""}`}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {!started ? (
          <WelcomeScreen
            businessName={businessName || "Shop with AI"}
            logoUrl={logoUrl}
            greeting={greeting || "Hi! Looking for something specific or want me to recommend?"}
            quickActions={actions}
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

      {/* Voice status pill */}
      {voiceLabel && (
        <div className="px-4 pb-2">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            {voiceLabel}
          </div>
        </div>
      )}

      {/* Unified input bar: text + mic */}
      <div className="border-t bg-card/80 backdrop-blur-md p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex gap-2 items-center"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={voiceState !== "idle" ? "Voice mode active…" : "Type or tap mic to talk…"}
            disabled={isLoading || voiceState !== "idle"}
            className="flex-1 rounded-2xl border border-input bg-background px-4 py-2.5 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          />
          {vapiKey && assistantId && (
            <VoiceMicButton state={voiceState} onClick={toggleVoice} disabled={isLoading} />
          )}
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim() || voiceState !== "idle"}
            className="rounded-2xl shrink-0 h-10 w-10 bg-gradient-to-br from-primary to-primary/80 shadow-md hover:shadow-lg transition-all"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default EcommerceChatWindow;
