import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { MobileNav } from "./MobileNav";
import { useShell } from "./ShellContext";

export function AppShell({
  children,
  onSignOut,
}: {
  children: ReactNode;
  onSignOut?: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { section } = useShell();
  return (
    <div className="flex min-h-screen w-full bg-surface-0">
      <AppSidebar />
      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onSignOut={onSignOut} onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="relative flex-1">
          <div className="pointer-events-none absolute inset-0 bg-gradient-mesh opacity-40" aria-hidden />
          <div className="relative mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={section}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppShell;