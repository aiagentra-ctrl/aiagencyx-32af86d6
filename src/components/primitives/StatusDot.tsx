import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "muted" | "hot";

const toneMap: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  hot: "bg-hot",
  muted: "bg-muted-foreground/50",
};

export function StatusDot({
  tone = "muted",
  pulse = false,
  size = "sm",
  className,
}: {
  tone?: Tone;
  pulse?: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const sizeCls = size === "xs" ? "h-1.5 w-1.5" : size === "md" ? "h-2.5 w-2.5" : "h-2 w-2";
  return (
    <span className={cn("relative inline-flex", className)}>
      {pulse && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-70 animate-pulse-ring",
            toneMap[tone]
          )}
          aria-hidden
        />
      )}
      <span className={cn("relative inline-flex rounded-full", sizeCls, toneMap[tone])} />
    </span>
  );
}

export default StatusDot;