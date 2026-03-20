import { Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  companyName?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  logoUrl?: string;
  onTryCall: () => void;
  onTryChat: () => void;
  vapiStarted: boolean;
}

const HeroSection = ({
  companyName, heroTitle, heroSubtitle, logoUrl, onTryCall, onTryChat, vapiStarted,
}: HeroSectionProps) => {
  const title = heroTitle || `Your AI Receptionist for ${companyName} is Ready`;
  const subtitle = heroSubtitle || "Answers calls, takes orders, and handles bookings — 24/7";

  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-16 md:pb-28 md:pt-24">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.06),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.04),transparent_60%)]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left — Copy */}
        <div className="opacity-0 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          {logoUrl && (
            <div className="mb-6 inline-block rounded-xl bg-card p-2.5 shadow-lg ring-1 ring-border">
              <img src={logoUrl} alt={companyName || ""} className="h-12 w-auto max-w-[140px] rounded-lg object-contain" />
            </div>
          )}

          <h1 className="mb-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground md:text-5xl lg:text-[3.4rem]" style={{ textWrap: "balance" }}>
            {title}
          </h1>

          <p className="mb-8 max-w-lg text-lg leading-relaxed text-muted-foreground md:text-xl" style={{ textWrap: "pretty" }}>
            {subtitle}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Button
              size="lg"
              className="gap-2.5 px-7 text-base shadow-lg shadow-primary/25 active:scale-[0.97] transition-transform"
              onClick={onTryCall}
              disabled={vapiStarted}
            >
              <Phone className="h-5 w-5" />
              {vapiStarted ? "Call Active..." : "Try AI Call Now"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2.5 px-7 text-base active:scale-[0.97] transition-transform"
              onClick={onTryChat}
            >
              <MessageCircle className="h-5 w-5" />
              Try Chatbot
            </Button>
          </div>

          <p className="mt-5 text-sm text-muted-foreground/70">
            No signup needed — experience it live in 10 seconds
          </p>
        </div>

        {/* Right — Phone mockup with call animation */}
        <div className="flex items-center justify-center opacity-0 animate-fade-up" style={{ animationDelay: "0.35s" }}>
          <div className="relative">
            {/* Phone frame */}
            <div className="relative w-[280px] rounded-[2.5rem] border-[6px] border-foreground/10 bg-card p-6 shadow-2xl md:w-[300px]">
              {/* Notch */}
              <div className="mx-auto mb-6 h-5 w-24 rounded-full bg-foreground/10" />

              {/* Call screen */}
              <div className="flex flex-col items-center py-8">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="mb-4 h-16 w-16 rounded-2xl object-contain shadow-md ring-1 ring-border" />
                ) : (
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-md">
                    <Phone className="h-7 w-7 text-primary" />
                  </div>
                )}

                <p className="mb-1 text-lg font-bold text-foreground">{companyName}</p>
                <p className="mb-8 text-sm text-muted-foreground">
                  {vapiStarted ? "Connected • AI Answering..." : "Incoming call..."}
                </p>

                {/* Call animation rings */}
                <div className="relative mb-6">
                  <button
                    onClick={onTryCall}
                    disabled={vapiStarted}
                    className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/30 transition-transform active:scale-95 disabled:opacity-70"
                  >
                    <Phone className="h-7 w-7" />
                  </button>
                  {!vapiStarted && (
                    <>
                      <span className="absolute inset-0 rounded-full bg-accent/40 animate-pulse-ring" />
                      <span className="absolute inset-0 rounded-full bg-accent/25 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
                    </>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {vapiStarted ? "AI is speaking with you" : "Tap to answer"}
                </p>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -left-12 top-16 rounded-xl bg-card px-3 py-2 shadow-lg ring-1 ring-border animate-float hidden lg:block">
              <p className="text-xs font-semibold text-foreground">📞 "Book a table for 4"</p>
            </div>
            <div className="absolute -right-10 bottom-24 rounded-xl bg-card px-3 py-2 shadow-lg ring-1 ring-border animate-float hidden lg:block" style={{ animationDelay: "1.5s" }}>
              <p className="text-xs font-semibold text-foreground">🍕 "I'd like to order"</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
