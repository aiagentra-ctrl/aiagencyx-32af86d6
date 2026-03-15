import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CTASectionProps {
  companyName?: string;
  ctaText?: string;
  onBookCall: () => void;
  onTryDemo: () => void;
}

const CTASection = ({ companyName, ctaText, onBookCall, onTryDemo }: CTASectionProps) => {
  return (
    <section className="bg-primary px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-bold text-primary-foreground md:text-4xl">
          {ctaText || `Ready to Automate ${companyName ? companyName + "'s" : "Your"} Customer Calls?`}
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-primary-foreground/80">
          Get your own AI Voice Agent up and running in minutes. No coding required.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            variant="secondary"
            className="gap-2 px-8 text-base"
            onClick={onBookCall}
          >
            Book a Call
            <ArrowRight className="h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 border-primary-foreground/30 px-8 text-base text-primary-foreground hover:bg-primary-foreground/10"
            onClick={onTryDemo}
          >
            <Phone className="h-5 w-5" />
            Try Demo
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
