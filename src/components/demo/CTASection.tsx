import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CTASectionProps {
  companyName?: string;
  ctaText?: string;
  onBookCall: () => void;
  onTryDemo: () => void;
}

const CTASection = ({ companyName, ctaText, onBookCall }: CTASectionProps) => {
  return (
    <section className="bg-primary px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-bold text-primary-foreground md:text-4xl">
          {ctaText || `Want This Running for ${companyName || "Your Business"}?`}
        </h2>
        <p className="mx-auto mb-4 max-w-xl text-primary-foreground/80">
          We'll set this up fully for your restaurant in 24 hours.
        </p>
        <p className="mx-auto mb-8 max-w-xl text-sm text-primary-foreground/60">
          No commitment — we'll show you how it works for your business.
        </p>
        <Button
          size="lg"
          variant="secondary"
          className="gap-2 px-8 text-base"
          onClick={onBookCall}
        >
          Book a 10-min Setup Call
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </section>
  );
};

export default CTASection;
