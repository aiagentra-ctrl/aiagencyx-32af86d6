import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "default" | "primary" | "success" | "warning" | "danger" | "info" | "hot" | "muted";

const toneCls: Record<Tone, string> = {
  default: "bg-secondary text-secondary-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/20",
  info: "bg-info-soft text-info border-info/20",
  hot: "bg-hot-soft text-hot border-hot/25",
  muted: "bg-muted text-muted-foreground border-border",
};

export function Chip({
  tone = "default",
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        toneCls[tone],
        className
      )}
    >
      {icon && <span className="flex h-3 w-3 items-center justify-center">{icon}</span>}
      {children}
    </span>
  );
}

export default Chip;