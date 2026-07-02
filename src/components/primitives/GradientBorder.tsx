import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function GradientBorder({
  children,
  className,
  innerClassName,
  gradient = "primary",
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  gradient?: "primary" | "accent" | "hot";
}) {
  const grad =
    gradient === "hot"
      ? "bg-gradient-hot"
      : gradient === "accent"
      ? "bg-gradient-accent"
      : "bg-gradient-primary";
  return (
    <div className={cn("relative rounded-xl p-[1px]", grad, className)}>
      <div className={cn("rounded-[calc(theme(borderRadius.xl)-1px)] bg-card", innerClassName)}>
        {children}
      </div>
    </div>
  );
}

export default GradientBorder;