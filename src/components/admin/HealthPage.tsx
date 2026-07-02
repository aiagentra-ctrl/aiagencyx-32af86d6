import HealthCheckTab from "./inbox/HealthCheckTab";
import { SectionHeader } from "@/components/primitives";

export default function HealthPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="System"
        title="Health Check"
        description="Run end-to-end diagnostics across webhooks, AI pipeline, database and integrations."
      />
      <HealthCheckTab />
    </div>
  );
}