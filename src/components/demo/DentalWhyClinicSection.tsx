import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

interface Scenario {
  scenario: string;
  missed_calls: number;
  avg_value: number;
  monthly_lost: number;
  recovered: string;
}

interface DentalWhyClinicSectionProps {
  scenarios?: Scenario[];
}

const defaultScenarios: Scenario[] = [
  { scenario: "Conservative", missed_calls: 2, avg_value: 200, monthly_lost: 12000, recovered: "$8,400" },
  { scenario: "Realistic", missed_calls: 4, avg_value: 250, monthly_lost: 30000, recovered: "$21,000" },
  { scenario: "Busy Clinic", missed_calls: 8, avg_value: 300, monthly_lost: 72000, recovered: "$50,400" },
];

const DentalWhyClinicSection = ({ scenarios }: DentalWhyClinicSectionProps) => {
  const items = scenarios && scenarios.length > 0 ? scenarios : defaultScenarios;

  return (
    <section className="border-t px-5 py-20 md:py-24 bg-background">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-3 text-4xl">🏥</div>
        <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl" style={{ textWrap: "balance" }}>
          Why Every Clinic Needs a 24/7 AI Receptionist
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-muted-foreground">
          See the real numbers behind missed calls — and what AI can recover for your practice.
        </p>

        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold">Scenario</TableHead>
                <TableHead className="font-bold text-center">Missed Calls/Day</TableHead>
                <TableHead className="font-bold text-center">Avg Patient Value</TableHead>
                <TableHead className="font-bold text-center">Monthly Revenue Lost</TableHead>
                <TableHead className="font-bold text-center text-primary">Recovered with AI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-semibold">{s.scenario}</TableCell>
                  <TableCell className="text-center">{s.missed_calls}</TableCell>
                  <TableCell className="text-center">${s.avg_value}</TableCell>
                  <TableCell className="text-center text-destructive font-semibold">
                    ${s.monthly_lost.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center text-primary font-bold">{s.recovered}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-8 rounded-xl border border-primary/20 bg-primary/[0.05] p-5">
          <p className="text-base font-semibold text-foreground">
            Even saving <span className="text-primary">1 new patient/day</span> = <span className="text-primary font-bold">$7,500/month</span> in added revenue
          </p>
        </div>

        <div className="mt-4 rounded-xl border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">
            🔒 <span className="text-foreground font-semibold">Guarantee:</span> Recover 30% More Appointments in 30 Days — Or It's Free Forever
          </p>
        </div>
      </div>
    </section>
  );
};

export default DentalWhyClinicSection;
