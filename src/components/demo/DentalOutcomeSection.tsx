import { PhoneIncoming, TrendingUp, Clock, DollarSign, Target, CalendarCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BenefitItem {
  title: string;
  icon: string;
}

interface DentalOutcomeSectionProps {
  companyName?: string;
  benefits?: BenefitItem[];
  onScrollToDemo?: () => void;
}

const iconMap: Record<string, any> = {
  "phone-incoming": PhoneIncoming,
  "trending-up": TrendingUp,
  clock: Clock,
  "dollar-sign": DollarSign,
  target: Target,
  "calendar-check": CalendarCheck,
};

const defaultBenefits: BenefitItem[] = [
  { title: "Every call answered 24/7", icon: "phone-incoming" },
  { title: "30% more bookings in 30 days", icon: "trending-up" },
  { title: "Save 2–3 staff hours daily", icon: "clock" },
  { title: "20–50% revenue increase", icon: "dollar-sign" },
  { title: "Zero missed opportunities", icon: "target" },
  { title: "No empty slots", icon: "calendar-check" },
];

const DentalOutcomeSection = ({ companyName, benefits, onScrollToDemo }: DentalOutcomeSectionProps) => {
  const items = benefits && benefits.length > 0 ? benefits : defaultBenefits;

  return (
    <section className="border-t px-5 py-20 md:py-24 bg-background">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-3 text-4xl">🌙</div>
        <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl" style={{ textWrap: "balance" }}>
          What If Every Call Became a Booked Appointment?
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-muted-foreground">
          With a 24/7 AI Call Agent, {companyName || "your clinic"} never misses a patient — day or night.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((b, i) => {
            const Icon = iconMap[b.icon] || Check;
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug pt-1.5">{b.title}</p>
              </div>
            );
          })}
        </div>

        <Button onClick={onScrollToDemo} size="lg" className="mt-10">
          See How It Works
        </Button>
      </div>
    </section>
  );
};

export default DentalOutcomeSection;
