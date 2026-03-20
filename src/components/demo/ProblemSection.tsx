import { PhoneOff, UserX, Clock, TrendingDown } from "lucide-react";

interface ProblemSectionProps {
  companyName?: string;
}

const problems = [
  { icon: PhoneOff, title: "Missed Calls = Lost Orders", desc: "Every unanswered call is a customer going to your competitor.", stat: "67%" , statLabel: "of callers won't call back" },
  { icon: UserX, title: "Busy Staff = Missed Bookings", desc: "Your team can't answer phones while serving customers.", stat: "38%" , statLabel: "of calls go unanswered" },
  { icon: Clock, title: "After-Hours Silence", desc: "Customers call evenings and weekends — and nobody picks up.", stat: "45%" , statLabel: "of calls are after hours" },
  { icon: TrendingDown, title: "Revenue Leak", desc: "Each missed call costs an average of $50–200 in lost orders.", stat: "$2.4K" , statLabel: "lost per month avg" },
];

const ProblemSection = ({ companyName }: ProblemSectionProps) => {
  return (
    <section className="border-t bg-destructive/[0.03] px-5 py-20 md:py-24">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl" style={{ textWrap: "balance" }}>
          How Many Customers Is {companyName || "Your Restaurant"} Losing?
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-muted-foreground">
          Every missed call is a lost order, a lost reservation, a lost customer — gone to your competitor.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {problems.map((p, i) => (
            <div
              key={i}
              className="group rounded-2xl border border-destructive/15 bg-card p-6 text-left shadow-sm transition-all hover:shadow-md hover:border-destructive/25"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/8">
                  <p.icon className="h-5 w-5 text-destructive" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold text-destructive">{p.stat}</p>
                  <p className="text-[10px] font-medium text-muted-foreground">{p.statLabel}</p>
                </div>
              </div>
              <h3 className="mb-1.5 text-base font-bold text-foreground">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
