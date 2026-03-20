import { PhoneOff, UserX, Clock, TrendingDown } from "lucide-react";

interface ProblemSectionProps {
  companyName?: string;
}

const problems = [
  { icon: PhoneOff, title: "Missed Calls = Lost Orders", desc: "Every unanswered call is a customer going to your competitor." },
  { icon: UserX, title: "Busy Staff = Missed Bookings", desc: "Your team can't answer phones while serving customers." },
  { icon: Clock, title: "After-Hours Silence", desc: "Customers call at night and weekends — who's answering?" },
  { icon: TrendingDown, title: "Revenue Leak", desc: "Studies show restaurants lose 30%+ revenue from missed calls." },
];

const ProblemSection = ({ companyName }: ProblemSectionProps) => {
  return (
    <section className="border-t bg-destructive/5 px-6 py-20">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">
          How Many Customers Hang Up When {companyName || "You"} Don't Answer?
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-muted-foreground">
          Every missed call is a lost order, a lost reservation, a lost customer — gone forever.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {problems.map((p, i) => (
            <div key={i} className="flex items-start gap-4 rounded-xl border border-destructive/20 bg-background p-6 text-left">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                <p.icon className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-foreground">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
