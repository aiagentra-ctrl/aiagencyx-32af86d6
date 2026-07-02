import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ShellCtx = {
  section: string;
  setSection: (s: string) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
};

const Ctx = createContext<ShellCtx | null>(null);

export function ShellProvider({
  children,
  initialSection = "demos",
}: {
  children: ReactNode;
  initialSection?: string;
}) {
  const [section, setSection] = useState(initialSection);
  const [collapsed, setCollapsed] = useState(false);
  const value = useMemo(
    () => ({ section, setSection, sidebarCollapsed: collapsed, toggleSidebar: () => setCollapsed((c) => !c) }),
    [section, collapsed]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShell() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShell must be used within <ShellProvider>");
  return ctx;
}