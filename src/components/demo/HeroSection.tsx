import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  clientName?: string;
  companyName?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  logoUrl?: string;
  onTryDemo: () => void;
  onBookCall: () => void;
}

const HeroSection = ({
  clientName, companyName, heroTitle, heroSubtitle, logoUrl, onTryDemo, onBookCall,
}: HeroSectionProps) => {
  const title = heroTitle || (companyName
    ? `Your AI Receptionist for ${companyName} is Ready`
    : "Your AI Receptionist is Ready");

  const subtitle = heroSubtitle || (companyName
    ? `We built a live AI that answers calls and chats for ${companyName} — try it now.`
    : "We built a live AI that answers calls and chats for your business — try it now.");

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5 px-6 py-20 md:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_50%)]" />
      <div className="relative mx-auto max-w-4xl text-center">
        {/* Logo */}
        {logoUrl && (
          <div className="mb-8 inline-block rounded-2xl bg-card p-3 shadow-lg ring-1 ring-border">
            <img src={logoUrl} alt={companyName || "Business"} className="h-16 w-auto max-w-[180px] rounded-xl object-contain" />
          </div>
        )}

        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
          <Phone className="h-4 w-4" />
          AI-Powered Assistant
        </div>
        <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl">
          {title}
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
          {subtitle}
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" className="gap-2 px-8 text-base shadow-lg shadow-primary/25" onClick={onTryDemo}>
            <Phone className="h-5 w-5" />
            Try Call Now
          </Button>
          <Button size="lg" variant="outline" className="px-8 text-base" onClick={onBookCall}>
            Book a 10-min Setup Call
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
