import { motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, Sparkles } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { useShell } from "./ShellContext";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const GROUP_LABELS: Record<string, string> = {
  primary: "Workspace",
  workspace: "Insights",
  system: "System",
};

export function AppSidebar() {
  const { section, setSection, sidebarCollapsed, toggleSidebar } = useShell();
  const grouped = ["primary", "workspace", "system"].map((g) => ({
    group: g,
    items: NAV_ITEMS.filter((i) => i.group === g),
  }));

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r bg-surface-1/80 backdrop-blur-xl transition-[width] duration-300 ease-out-expo md:flex",
        sidebarCollapsed ? "w-16" : "w-56"
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-white shadow-glow">
          <Sparkles className="h-4 w-4" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-semibold leading-tight">AI Agency</div>
            <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">Control Plane</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <TooltipProvider delayDuration={0}>
        <nav className="flex-1 space-y-4 overflow-y-auto p-2">
          {grouped.map(({ group, items }) => (
            <div key={group} className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-2 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                  {GROUP_LABELS[group]}
                </div>
              )}
              {items.map((item) => {
                const Icon = item.icon;
                const active = section === item.key;
                const button = (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSection(item.key)}
                    className={cn(
                      "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-pill"
                        className="absolute inset-0 -z-10 rounded-lg bg-primary/10 ring-1 ring-primary/20"
                        transition={{ type: "spring", stiffness: 400, damping: 34 }}
                      />
                    )}
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    {!sidebarCollapsed && item.badge === "hot" && (
                      <span className="ml-auto inline-flex h-1.5 w-1.5 rounded-full bg-hot" />
                    )}
                  </button>
                );
                return sidebarCollapsed ? (
                  <Tooltip key={item.key}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  button
                );
              })}
            </div>
          ))}
        </nav>
      </TooltipProvider>

      {/* Collapse toggle */}
      <div className="border-t p-2">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

export default AppSidebar;