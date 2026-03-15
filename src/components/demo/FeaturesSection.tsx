import { PhoneCall, MessageSquare, CalendarCheck, BrainCircuit, Globe, BarChart3 } from "lucide-react";

interface FeaturesSectionProps {
  companyName?: string;
  features?: string[];
}

const defaultFeatures = [
  { icon: PhoneCall, title: "Answer Customer Calls", desc: "Professionally handle inbound calls with natural conversation." },
  { icon: MessageSquare, title: "Handle FAQs", desc: "Instantly answer common questions about services and pricing." },
  { icon: CalendarCheck, title: "Book Appointments", desc: "Schedule, reschedule, and cancel appointments seamlessly." },
  { icon: BrainCircuit, title: "Smart Routing", desc: "Route complex queries to the right human team member." },
  { icon: Globe, title: "Multi-Language", desc: "Communicate with customers in multiple languages." },
  { icon: BarChart3, title: "Call Analytics", desc: "Get insights on call volume, topics, and customer satisfaction." },
];

const FeaturesSection = ({ companyName, features }: FeaturesSectionProps) => {
  const items =
    features && features.length > 0
      ? features.map((f, i) => ({
          icon: defaultFeatures[i % defaultFeatures.length].icon,
          title: f,
          desc: "",
        }))
      : defaultFeatures;

  return (
    <section className="bg-background px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold text-foreground md:text-4xl">
          AI Voice Agent Built for {companyName || "Your Business"}
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
          This AI assistant can automatically handle all your customer interactions.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-6 text-center transition-all hover:border-primary/30 hover:shadow-lg"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
                <item.icon className="h-7 w-7" />
              </div>
              <h3 className="mb-2 font-semibold text-card-foreground">{item.title}</h3>
              {item.desc && <p className="text-sm text-muted-foreground">{item.desc}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
