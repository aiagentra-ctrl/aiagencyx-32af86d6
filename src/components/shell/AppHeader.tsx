import { Command, Menu, Search, LogOut, Code, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/primitives";
import { NAV_ITEMS } from "./nav-items";
import { useShell } from "./ShellContext";
import NotificationBell from "@/components/admin/inbox/NotificationBell";
import ErrorBell from "@/components/admin/inbox/ErrorBell";
import { cn } from "@/lib/utils";

export function AppHeader({
  onSignOut,
  onOpenMobileNav,
}: {
  onSignOut?: () => void;
  onOpenMobileNav?: () => void;
}) {
  const { section, setSection } = useShell();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = query
    ? NAV_ITEMS.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : NAV_ITEMS;

  // Cmd/Ctrl + K focuses the search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("shell-search");
        el?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeLabel = NAV_ITEMS.find((i) => i.key === section)?.label ?? "Dashboard";

  return (
    <header className="sticky top-0 z-20 border-b bg-surface-1/70 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4">
        {/* Mobile menu */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </Button>

        {/* Breadcrumb */}
        <div className="hidden items-center gap-2 text-sm md:flex">
          <span className="text-muted-foreground">Dashboard</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">{activeLabel}</span>
        </div>

        {/* Search */}
        <div className="relative ml-auto w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="shell-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Jump to…"
            className={cn(
              "h-9 w-full rounded-lg border bg-background/60 pl-8 pr-16 text-sm outline-none transition-all",
              "placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background focus:ring-2 focus:ring-primary/20"
            )}
          />
          <div className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-1 md:flex">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </div>

          {open && results.length > 0 && (
            <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl border bg-popover shadow-elev-lg animate-scale-in">
              <div className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Navigate
              </div>
              <ul className="max-h-64 overflow-y-auto p-1">
                {results.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSection(item.key);
                          setQuery("");
                          setOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{item.label}</span>
                        <Command className="ml-auto h-3 w-3 text-muted-foreground/60" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Bells */}
        <div className="flex items-center gap-1">
          <ErrorBell />
          <NotificationBell onJump={() => setSection("inbox")} />
        </div>

        {/* Avatar / account menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-white shadow-glow transition-transform hover:scale-105 focus-ring"
              aria-label="Account menu"
            >
              A
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-sm font-semibold">Admin</span>
              <span className="text-xs text-muted-foreground">aiagentron@gmail.com</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/api-docs" className="flex items-center gap-2">
                <Code className="h-4 w-4" /> API Docs
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/" className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" /> Open site
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} className="text-danger focus:text-danger">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default AppHeader;