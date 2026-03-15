import { Zap, Clock, TrendingUp, Shield } from "lucide-react";

interface BenefitsSectionProps {
  companyName?: string;
  benefits?: string[];
}

const defaultBenefits = [
  {
    icon: Clock,
    title: "24/7 Availability",
    desc: "Never miss a customer call again. Your AI agent works around the clock.",
  },
  {
    icon: Zap,
    title: "Instant Responses",
    desc: "Answer questions and handle requests in seconds, not minutes.",
  },
  {
    icon: TrendingUp,
    title: "Scale Effortlessly",
    desc: "Handle hundreds of calls simultaneously without hiring more staff.",
  },
  {
    icon: Shield,
    title: "Consistent Quality",
    desc: "Every caller gets the same professional, accurate experience.",
  },
];

const BenefitsSection = ({ companyName, benefits }: BenefitsSectionProps) => {
  const items =
    benefits && benefits.length > 0
      ? benefits.map((b, i) => ({
          icon: defaultBenefits[i % defaultBenefits.length].icon,
          title: b,
          desc: "",
        }))
      : defaultBenefits;

  return (
    <section className="bg-card px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold text-card-foreground md:text-4xl">
          Why {companyName || "Your Business"} Needs an AI Voice Agent
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
          Transform how you handle customer communications with intelligent automation.
        </p>
        <div className="grid gap-8 md:grid-cols-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="group flex gap-4 rounded-xl border bg-background p-6 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <item.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="mb-1 text-lg font-semibold text-foreground">{item.title}</h3>
                {item.desc && <p className="text-sm text-muted-foreground">{item.desc}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
