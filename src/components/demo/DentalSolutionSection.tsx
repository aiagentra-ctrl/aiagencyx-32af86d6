import { Phone, Calendar, MessageSquare, Clock, Brain, BarChart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeatureItem {
  title: string;
  desc: string;
  icon: string;
}

interface DentalSolutionSectionProps {
  companyName?: string;
  features?: FeatureItem[];
  onBookCall?: () => void;
}

const iconMap: Record<string, any> = {
  phone: Phone,
  calendar: Calendar,
  "message-square": MessageSquare,
  clock: Clock,
  brain: Brain,
  "bar-chart": BarChart,
};

const defaultFeatures: FeatureItem[] = [
  { title: "24/7 Call Answering", desc: "Never miss a patient call, day or night", icon: "phone" },
  { title: "Instant Booking", desc: "Calendar integration for real-time scheduling", icon: "calendar" },
  { title: "Automated Follow-Ups", desc: "SMS & WhatsApp reminders and recalls", icon: "message-square" },
  { title: "No-Show Reduction", desc: "Confirmations and easy rescheduling", icon: "clock" },
  { title: "Smart Memory", desc: "Remembers returning patients and preferences", icon: "brain" },
  { title: "Analytics Dashboard", desc: "Track calls, bookings, and conversions", icon: "bar-chart" },
];

const DentalSolutionSection = ({ companyName, features, onBookCall }: DentalSolutionSectionProps) => {
  const items = features && features.length > 0 ? features : defaultFeatures;

  return (
    <section className="border-t px-5 py-20 md:py-24 bg-muted/30">
      <div className="mx-auto max-w-5xl text-center">
        <div className="mb-3 text-4xl">🤖</div>
        <h2 className="mb-2 text-3xl font-bold text-foreground md:text-4xl">
          Meet Your 24/7 AI Receptionist
        </h2>
        <p className="mx-auto mb-12 max-w-md text-muted-foreground text-lg">
          The Receptionist That Never Sleeps
        </p>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f, i) => {
            const Icon = iconMap[f.icon] || Phone;
            return (
              <div
                key={i}
                className="rounded-2xl border bg-card p-6 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/20"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-1.5 text-base font-bold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>

        <Button onClick={onBookCall} size="lg" className="mt-10">
          Watch the AI in Action — Book a Free Demo
        </Button>
      </div>
    </section>
  );
};

export default DentalSolutionSection;
