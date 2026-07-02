import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-xs",
        className
      )}
    >
      {children}
    </kbd>
  );
}

export default Kbd;