import { Phone, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoiceAgentSectionProps {
  companyName?: string;
  vapiStarted: boolean;
  onTryDemo: () => void;
}

const VoiceAgentSection = ({ companyName, vapiStarted, onTryDemo }: VoiceAgentSectionProps) => {
  return (
    <section className="bg-gradient-to-br from-primary/10 via-card to-accent/10 px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
          <Mic className="h-4 w-4" />
          Live Demo
        </div>
        <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
          Try the AI Voice Agent Now
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
          Experience how the AI assistant built for {companyName || "your business"} handles real
          conversations. Click below to start a live demo call.
        </p>

        <div className="mx-auto max-w-sm rounded-2xl border bg-card p-8 shadow-xl">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            {vapiStarted ? (
              <div className="relative">
                <Phone className="h-10 w-10 text-primary" />
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-accent" />
              </div>
            ) : (
              <Phone className="h-10 w-10 text-primary" />
            )}
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            {vapiStarted
              ? "AI Assistant is listening..."
              : "Click to start a conversation with the AI agent"}
          </p>
          <Button
            size="lg"
            className="w-full gap-2"
            onClick={onTryDemo}
            disabled={vapiStarted}
          >
            <Phone className="h-5 w-5" />
            {vapiStarted ? "Agent Active" : "Try Demo"}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default VoiceAgentSection;
