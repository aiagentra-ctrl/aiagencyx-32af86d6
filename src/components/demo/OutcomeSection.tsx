import { ShoppingCart, CalendarCheck, PhoneCall, UserCheck } from "lucide-react";

const outcomes = [
  { icon: ShoppingCart, title: "More Orders", desc: "AI takes orders 24/7 — no hold times, no missed calls" },
  { icon: CalendarCheck, title: "More Reservations", desc: "Instant table booking without phone tag" },
  { icon: PhoneCall, title: "No Missed Calls", desc: "Every call answered in under 2 seconds" },
  { icon: UserCheck, title: "No Extra Staff", desc: "Handle 100+ calls simultaneously at zero additional cost" },
];

const OutcomeSection = () => {
  return (
    <section className="border-t bg-card px-6 py-20">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">
          What Changes When You Have AI
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-muted-foreground">
          Simple results. No complexity. Just more revenue and happier customers.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {outcomes.map((o, i) => (
            <div key={i} className="flex items-start gap-4 rounded-xl border bg-background p-6 text-left transition-all hover:shadow-md hover:border-primary/30">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <o.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-foreground">{o.title}</h3>
                <p className="text-sm text-muted-foreground">{o.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OutcomeSection;
