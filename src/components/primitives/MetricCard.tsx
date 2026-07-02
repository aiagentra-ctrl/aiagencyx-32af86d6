import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ReactNode } from "react";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: number | null;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info" | "hot";
  loading?: boolean;
  className?: string;
}

const toneAccent: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "from-primary/10 to-transparent",
  success: "from-success/15 to-transparent",
  warning: "from-warning/15 to-transparent",
  danger: "from-danger/15 to-transparent",
  info: "from-info/15 to-transparent",
  hot: "from-hot/20 to-transparent",
};

export function MetricCard({
  label,
  value,
  hint,
  delta,
  icon,
  tone = "default",
  loading,
  className,
}: MetricCardProps) {
  const deltaTone =
    delta == null ? "text-muted-foreground" : delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted-foreground";
  const DeltaIcon = delta == null ? Minus : delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-4 shadow-xs lift",
        className
      )}
    >
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70", toneAccent[tone])}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            {loading ? (
              <span className="inline-block h-7 w-20 rounded shimmer" />
            ) : (
              <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
                {value}
              </span>
            )}
            {delta != null && !loading && (
              <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", deltaTone)}>
                <DeltaIcon className="h-3 w-3" />
                {Math.abs(delta)}%
              </span>
            )}
          </div>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div className="rounded-lg border bg-background/60 p-2 text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export default MetricCard;