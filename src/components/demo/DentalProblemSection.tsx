import { Clock, PhoneOff, Users, CalendarX, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProblemItem {
  title: string;
  desc: string;
  stat: string;
  statLabel: string;
  icon: string;
}

interface DentalProblemSectionProps {
  companyName?: string;
  problems?: ProblemItem[];
  onBookCall?: () => void;
}

const iconMap: Record<string, any> = {
  clock: Clock,
  "phone-off": PhoneOff,
  users: Users,
  "calendar-x": CalendarX,
};

const defaultProblems: ProblemItem[] = [
  { title: "After-Hours Voicemail", desc: "Patients call evenings and weekends — nobody picks up. They book elsewhere.", stat: "45%", statLabel: "of calls are after hours", icon: "clock" },
  { title: "Busy Front Desk", desc: "Your receptionist can't answer phones while checking in patients and handling paperwork.", stat: "38%", statLabel: "of calls go unanswered", icon: "phone-off" },
  { title: "No Recall System", desc: "Without automated follow-ups, patients drift away and forget to rebook.", stat: "28%", statLabel: "of patients don't return", icon: "users" },
  { title: "No-Show Chair Time", desc: "Empty chairs from no-shows waste valuable treatment time and revenue.", stat: "15%", statLabel: "average no-show rate", icon: "calendar-x" },
];

const DentalProblemSection = ({ companyName, problems, onBookCall }: DentalProblemSectionProps) => {
  const items = problems && problems.length > 0 ? problems : defaultProblems;

  return (
    <section className="border-t bg-destructive/[0.03] px-5 py-20 md:py-24">
      <div className="mx-auto max-w-5xl text-center">
        <div className="mb-3 text-4xl">💸</div>
        <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl" style={{ textWrap: "balance" }}>
          Every Missed Call = Lost Patients = Lost Revenue
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-muted-foreground">
          Even with a great receptionist, most dental clinics lose patients daily due to missed or delayed calls. When staff are busy with in-clinic patients or after hours, calls go unanswered.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          {items.map((p, i) => {
            const Icon = iconMap[p.icon] || AlertTriangle;
            return (
              <div
                key={i}
                className="group rounded-2xl border border-destructive/15 bg-card p-6 text-left shadow-sm transition-all hover:shadow-md hover:border-destructive/25"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/8">
                    <Icon className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-extrabold text-destructive">{p.stat}</p>
                    <p className="text-[10px] font-medium text-muted-foreground">{p.statLabel}</p>
                  </div>
                </div>
                <h3 className="mb-1.5 text-base font-bold text-foreground">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Math Block */}
        <div className="mt-10 rounded-2xl border border-destructive/20 bg-destructive/[0.05] p-6 md:p-8">
          <p className="text-lg font-semibold text-foreground md:text-xl">
            3 missed calls/day × <span className="text-destructive font-bold">$250</span> = <span className="text-destructive font-bold">$750/day</span>
          </p>
          <p className="mt-2 text-2xl font-extrabold text-destructive md:text-3xl">
            → $15,000+/month lost revenue
          </p>
        </div>

        <Button
          onClick={onBookCall}
          size="lg"
          className="mt-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          See How Much You Could Be Losing — Book a Free Demo
        </Button>
      </div>
    </section>
  );
};

export default DentalProblemSection;
