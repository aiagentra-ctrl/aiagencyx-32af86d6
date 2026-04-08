import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Calculator, DollarSign, CalendarCheck, TrendingUp } from "lucide-react";

interface ROIDefaults {
  calls_per_day?: number;
  missed_percent?: number;
  avg_patient_value?: number;
}

interface DentalROISectionProps {
  roiDefaults?: ROIDefaults;
  onBookCall?: () => void;
}

const DentalROISection = ({ roiDefaults, onBookCall }: DentalROISectionProps) => {
  const [callsPerDay, setCallsPerDay] = useState(roiDefaults?.calls_per_day || 15);
  const [missedPercent, setMissedPercent] = useState(roiDefaults?.missed_percent || 30);
  const [avgValue, setAvgValue] = useState(roiDefaults?.avg_patient_value || 250);

  const missedCalls = Math.round(callsPerDay * (missedPercent / 100));
  const monthlyLost = missedCalls * avgValue * 30;
  const recovered = Math.round(monthlyLost * 0.7);
  const aiCost = 297;
  const paybackDays = recovered > 0 ? Math.max(1, Math.round((aiCost / (recovered / 30)))) : 0;

  return (
    <section className="border-t px-5 py-20 md:py-24 bg-muted/30">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-3 text-4xl">📊</div>
        <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">
          ROI Calculator
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-muted-foreground">
          See exactly how much revenue your clinic could recover with an AI receptionist.
        </p>

        <div className="rounded-2xl border bg-card p-6 md:p-10 shadow-sm">
          {/* Sliders */}
          <div className="space-y-8 mb-10 text-left">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-semibold text-foreground">Patient Calls / Day</label>
                <span className="text-sm font-bold text-primary">{callsPerDay}</span>
              </div>
              <Slider value={[callsPerDay]} onValueChange={([v]) => setCallsPerDay(v)} min={5} max={50} step={1} />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-semibold text-foreground">Missed Calls (%)</label>
                <span className="text-sm font-bold text-destructive">{missedPercent}%</span>
              </div>
              <Slider value={[missedPercent]} onValueChange={([v]) => setMissedPercent(v)} min={5} max={60} step={5} />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-semibold text-foreground">Avg Patient Value ($)</label>
                <span className="text-sm font-bold text-primary">${avgValue}</span>
              </div>
              <Slider value={[avgValue]} onValueChange={([v]) => setAvgValue(v)} min={50} max={1000} step={25} />
            </div>
          </div>

          {/* Results */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-destructive/20 bg-destructive/[0.05] p-5">
              <DollarSign className="mx-auto mb-2 h-6 w-6 text-destructive" />
              <p className="text-xs font-medium text-muted-foreground">Revenue Lost / Month</p>
              <p className="text-2xl font-extrabold text-destructive">${monthlyLost.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-5">
              <CalendarCheck className="mx-auto mb-2 h-6 w-6 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Appointments Recovered</p>
              <p className="text-2xl font-extrabold text-primary">{missedCalls * 30 * 0.7 | 0}/mo</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-5">
              <TrendingUp className="mx-auto mb-2 h-6 w-6 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Monthly Gain with AI</p>
              <p className="text-2xl font-extrabold text-primary">${recovered.toLocaleString()}</p>
            </div>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            AI pays for itself in approximately <span className="font-bold text-primary">{paybackDays} days</span>
          </p>
        </div>

        <Button onClick={onBookCall} size="lg" className="mt-8">
          See It in Action — Book a Free Demo
        </Button>
      </div>
    </section>
  );
};

export default DentalROISection;
