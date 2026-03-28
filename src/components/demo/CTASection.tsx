import { ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/tracking";

interface CTASectionProps {
  companyName?: string;
  ctaText?: string;
  slug?: string;
  onBookCall: () => void;
  industry?: string;
}

const CTASection = ({ companyName, ctaText, slug, onBookCall, industry }: CTASectionProps) => {
  const handleBookCall = () => {
    if (slug) trackEvent(slug, "cta_clicked", { businessName: companyName });
    onBookCall();
  };

  const businessLabel = industry && industry !== "restaurant" && industry !== "general"
    ? companyName || "Your Business"
    : companyName || "Your Restaurant";

  return (
    <section className="border-t bg-primary px-5 py-20 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-bold text-primary-foreground md:text-4xl" style={{ textWrap: "balance" }}>
          {ctaText || `Want This Running for ${businessLabel}?`}
        </h2>
        <p className="mx-auto mb-3 max-w-lg text-lg text-primary-foreground/80">
          We'll set this up fully for your business in 24 hours.
        </p>
        <p className="mx-auto mb-8 text-sm text-primary-foreground/50">
          No commitment — just see how it works for your business.
        </p>
        <Button
          size="lg"
          variant="secondary"
          className="gap-2.5 px-8 text-base shadow-lg active:scale-[0.97] transition-transform"
          onClick={handleBookCall}
        >
          Book a 10-min Setup Call
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-primary-foreground/50">
          <Shield className="h-3.5 w-3.5" />
          <span>Free setup • Cancel anytime • Results in 24 hours</span>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
