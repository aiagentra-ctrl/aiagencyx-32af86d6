import { Phone, PhoneOff, Mic, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type CallStatus } from "@/pages/DemoPage";

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

interface VoiceAgentSectionProps {
  companyName?: string;
  callStatus: CallStatus;
  callSeconds: number;
  onTryDemo: () => void;
  onEndCall: () => void;
}

const VoiceAgentSection = ({ companyName, callStatus, callSeconds, onTryDemo, onEndCall }: VoiceAgentSectionProps) => {
  const prompts = [
    { emoji: "📅", text: "Book a table for tonight" },
    { emoji: "🍕", text: "I'd like to place an order" },
    { emoji: "⏰", text: "What are your hours?" },
    { emoji: "📍", text: "Where are you located?" },
  ];

  const isActive = callStatus === "connected";
  const isCalling = callStatus === "calling";

  return (
    <section className="border-t bg-card/50 px-5 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-4 py-1.5 text-sm font-semibold text-primary ring-1 ring-primary/15">
            <Mic className="h-3.5 w-3.5" />
            Live Demo
          </span>
        </div>
        <h2 className="mb-3 text-center text-3xl font-bold text-foreground md:text-4xl" style={{ textWrap: "balance" }}>
          Call the AI for {companyName || "Your Business"}
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground">
          Have a real conversation. Ask about the menu, book a table, or place an order — the AI handles it all.
        </p>

        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          {/* Voice Agent Card */}
          <div className="rounded-2xl border bg-background p-8 shadow-lg transition-shadow hover:shadow-xl">
            <div className="mb-6 flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isActive ? "bg-accent/15" : "bg-primary/10"} transition-colors`}>
                <Phone className={`h-5 w-5 ${isActive ? "text-accent" : "text-primary"}`} />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Voice Agent</h3>
                <p className="text-xs text-muted-foreground">Speak to the AI by phone</p>
              </div>
            </div>

            <div className="mb-6 flex flex-col items-center rounded-xl bg-muted/50 p-6">
              <div className="relative mb-4">
                <div className={`flex h-20 w-20 items-center justify-center rounded-full transition-colors ${
                  isActive ? "bg-accent/15" : isCalling ? "bg-primary/15 animate-pulse" : "bg-primary/10"
                }`}>
                  {isActive ? (
                    <PhoneOff className="h-9 w-9 text-destructive" />
                  ) : (
                    <Phone className={`h-9 w-9 ${isCalling ? "text-primary animate-bounce" : "text-primary"}`} />
                  )}
                </div>
                {isActive && (
                  <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full bg-accent shadow-md shadow-accent/30 animate-pulse" />
                )}
              </div>

              {/* Status text */}
              <p className="mb-1 text-sm font-medium text-foreground">
                {isActive ? "AI is listening..." : isCalling ? "Connecting..." : callStatus === "ended" ? "Call ended" : "Click below to start a live call"}
              </p>
              {(isActive || callStatus === "ended") && (
                <p className="mb-3 text-xs tabular-nums text-muted-foreground">{fmt(callSeconds)}</p>
              )}

              {/* Call / End buttons */}
              {isActive ? (
                <Button
                  size="lg"
                  variant="destructive"
                  className="w-full gap-2 shadow-md active:scale-[0.97] transition-transform"
                  onClick={onEndCall}
                >
                  <PhoneOff className="h-5 w-5" />
                  End Call
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="w-full gap-2 shadow-md shadow-primary/20 active:scale-[0.97] transition-transform"
                  onClick={onTryDemo}
                  disabled={isCalling}
                >
                  <Phone className="h-5 w-5" />
                  {isCalling ? "Connecting..." : callStatus === "ended" ? "Call Again" : "Try AI Call Now"}
                </Button>
              )}
            </div>

            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Try saying:</p>
              <div className="grid grid-cols-2 gap-2">
                {prompts.map((p, i) => (
                  <div key={i} className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-foreground ring-1 ring-border/50">
                    <span className="mr-1.5">{p.emoji}</span>{p.text}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chatbot Card */}
          <div className="rounded-2xl border bg-background p-8 shadow-lg transition-shadow hover:shadow-xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10">
                <MessageCircle className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">AI Chatbot</h3>
                <p className="text-xs text-muted-foreground">Chat with the AI assistant</p>
              </div>
            </div>

            <div className="mb-6 flex flex-col items-center rounded-xl bg-muted/50 p-6">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
                <MessageCircle className="h-9 w-9 text-accent" />
              </div>
              <p className="mb-4 text-sm text-muted-foreground text-center">
                Click the chat bubble in the bottom-right corner to start
              </p>
              <div className="flex w-full items-center gap-2 rounded-lg border bg-background px-3 py-2.5 text-sm text-muted-foreground">
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span>Type a message...</span>
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Try asking:</p>
              <div className="grid grid-cols-2 gap-2">
                {prompts.map((p, i) => (
                  <div key={i} className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-foreground ring-1 ring-border/50">
                    <span className="mr-1.5">{p.emoji}</span>{p.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VoiceAgentSection;
