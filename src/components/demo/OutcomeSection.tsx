import { ShoppingCart, CalendarCheck, PhoneCall, UserCheck } from "lucide-react";

const outcomes = [
  { icon: ShoppingCart, title: "More Orders", desc: "AI takes orders 24/7 — no hold times, no missed calls.", metric: "3x", metricLabel: "more phone orders" },
  { icon: CalendarCheck, title: "More Reservations", desc: "Instant table booking without phone tag.", metric: "90%", metricLabel: "booking completion" },
  { icon: PhoneCall, title: "Zero Missed Calls", desc: "Every call answered in under 2 seconds, every time.", metric: "<2s", metricLabel: "answer time" },
  { icon: UserCheck, title: "No Extra Staff", desc: "Handle 100+ calls simultaneously at zero additional cost.", metric: "100+", metricLabel: "concurrent calls" },
];

const OutcomeSection = () => {
  return (
    <section className="border-t bg-card/50 px-5 py-20 md:py-24">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl" style={{ textWrap: "balance" }}>
          What Happens When AI Handles Your Calls
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-muted-foreground">
          Simple results — more revenue, happier customers, less stress.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {outcomes.map((o, i) => (
            <div
              key={i}
              className="group rounded-2xl border bg-background p-6 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/20"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/8">
                  <o.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold text-primary">{o.metric}</p>
                  <p className="text-[10px] font-medium text-muted-foreground">{o.metricLabel}</p>
                </div>
              </div>
              <h3 className="mb-1.5 text-base font-bold text-foreground">{o.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{o.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OutcomeSection;
