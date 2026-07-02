import { Zap, Cog, BarChart3, UserCheck, Layers, Mail, Database, Inbox, Activity, Workflow, ShieldCheck, HeartPulse, Home, Settings } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type NavItem = {
  key: string;         // matches the existing tab value (or a new section)
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  group?: "primary" | "workspace" | "system";
  badge?: "hot" | "new";
};

// Maps 1:1 to the existing AdminDashboard tab values so the sidebar can drive them.
export const NAV_ITEMS: NavItem[] = [
  { key: "demos",     label: "Demos",         icon: Zap,        group: "primary" },
  { key: "inbox",     label: "Inbox",         icon: Inbox,      group: "primary" },
  { key: "leads",     label: "Leads",         icon: UserCheck,  group: "primary" },
  { key: "sequences", label: "Follow-ups",    icon: Mail,       group: "primary" },
  { key: "analytics", label: "Analytics",     icon: BarChart3,  group: "workspace" },
  { key: "knowledge", label: "Knowledge",     icon: Database,   group: "workspace" },
  { key: "followups", label: "Templates",     icon: Layers,     group: "workspace" },
  { key: "logs",      label: "Logs",          icon: Activity,   group: "system" },
  { key: "settings",  label: "Settings",      icon: Cog,        group: "system" },
];

export const NAV_ICON_HOME = Home;
export const NAV_ICON_SETTINGS = Settings;