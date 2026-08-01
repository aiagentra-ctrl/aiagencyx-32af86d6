import { initialsOf } from "./personalize";

export interface REDashboardProps {
  companyName: string;
  logoUrl?: string;
  companyDomain: string;
  /** Force the full desktop layout regardless of viewport (used by the mobile preview/expand). */
  forceWide?: boolean;
}

const NAV = [
  { icon: "▣", label: "Dashboard", active: true },
  { icon: "🧠", label: "AI Brain" },
  { icon: "✉", label: "Email" },
  { icon: "📞", label: "Calling" },
  { icon: "📷", label: "Instagram" },
  { icon: "💬", label: "WhatsApp" },
  { icon: "🎯", label: "Lead scoring" },
  { icon: "📝", label: "Content" },
  { icon: "🚀", label: "SEO and blog" },
];

const STATS = [
  { label: "Total leads captured", icon: "📈", value: "1,247", sub: "" },
  { label: "Active AI agents", icon: "🤖", value: "8", sub: "All operational" },
  { label: "Calls made today", icon: "📞", value: "47", sub: "" },
  { label: "Messages sent", icon: "💬", value: "892", sub: "" },
  { label: "Site visits booked", icon: "📅", value: "23", sub: "" },
  { label: "Conversion rate", icon: "👥", value: "18.4%", sub: "" },
  { label: "Hot leads", icon: "🔥", value: "34", sub: "" },
  { label: "Monthly cost", icon: "💰", value: "$847.5", sub: "Budget $1200" },
];

const QUICK = [
  { emoji: "📧", num: "456", label: "Emails sent" },
  { emoji: "📷", num: "156", label: "Social replies" },
  { emoji: "💬", num: "312", label: "Messages" },
  { emoji: "👥", num: "24", label: "Content" },
  { emoji: "🚀", num: "8", label: "Blog posts" },
];

const ACTIVITY = [
  { icon: "🌐", src: "Website", name: "Sarah Johnson", badge: "Hot" as const },
  { icon: "📷", src: "Instagram", name: "Michael Chen", badge: "Hot" as const },
  { icon: "💬", src: "WhatsApp", name: "Emily Rodriguez", badge: "Warm" as const },
  { icon: "📞", src: "Inbound call", name: "David Whitfield", badge: "Warm" as const },
];

/**
 * Coded command-centre dashboard — replaces the old static screenshot so every
 * prospect gets a personalised version ({{CompanyName}}, {{Logo}}, {{CompanyDomain}}).
 * Stat numbers and activity names stay illustrative across all clients.
 */
const REDashboard = ({ companyName, logoUrl, companyDomain, forceWide }: REDashboardProps) => {
  const w = (base: string, wide: string, responsive: string) =>
    `${base} ${forceWide ? wide : responsive}`;

  return (
  <div
    className="overflow-hidden rounded-[1.25rem]"
    style={{
      background: "var(--re-dash-bg)",
      border: "1px solid var(--re-line-dark)",
      boxShadow: "0 50px 100px -40px rgba(0,0,0,0.85)",
    }}
  >
    {/* Command bar */}
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] sm:px-7"
      style={{ background: "#12151A", color: "#fff" }}
    >
      <span style={{ color: "var(--re-dash-green)" }}>01 / Command centre</span>
      <span className="truncate">{companyName} Dashboard</span>
    </div>

    <div className={w("grid min-h-[26rem]", "grid-cols-[15.5rem_1fr]", "grid-cols-1 min-[900px]:grid-cols-[15.5rem_1fr]")}>
      {/* Sidebar — illustrative, hidden on small screens */}
      <aside
        className={w("flex-col p-5", "flex", "hidden min-[900px]:flex")}
        style={{ borderRight: "1px solid var(--re-dash-border)" }}
      >
        <div className="mb-8 flex items-center gap-2.5 px-1">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              width={30}
              height={30}
              className="h-[30px] w-[30px] rounded-lg object-contain"
              style={{ background: "#fff", border: "1px solid var(--re-dash-border)" }}
              loading="lazy"
            />
          ) : (
            <span
              className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-[0.72rem] font-extrabold text-white"
              style={{ background: "var(--re-brand)" }}
            >
              {initialsOf(companyName)}
            </span>
          )}
          <span
            className="truncate text-[1.05rem] font-extrabold tracking-tight"
            style={{ color: "var(--re-dash-text)" }}
          >
            {companyName}
          </span>
        </div>

        <ul className="space-y-0.5">
          {NAV.map((n) => (
            <li
              key={n.label}
              className="flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[0.875rem]"
              style={
                n.active
                  ? { background: "#EFECE3", color: "var(--re-dash-text)", fontWeight: 600 }
                  : { color: "#6B6A63", fontWeight: 500 }
              }
            >
              <span className="w-[18px] text-center text-[0.9rem]" aria-hidden="true">
                {n.icon}
              </span>
              {n.label}
            </li>
          ))}
        </ul>

        <div
          className="mt-auto flex items-center gap-1.5 pt-4 text-[0.8125rem]"
          style={{ borderTop: "1px solid var(--re-dash-border)", color: "var(--re-dash-muted)" }}
        >
          ‹ Collapse
        </div>
      </aside>

      {/* Main */}
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3
            className="text-[1.25rem] font-extrabold tracking-tight sm:text-[1.65rem]"
            style={{ color: "var(--re-dash-text)" }}
          >
            Dashboard overview
          </h3>
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.8rem] text-white"
              style={{ background: "#12151A" }}
            >
              A
            </span>
            <div className={forceWide ? "block" : "hidden sm:block"}>
              <p className="text-[0.8125rem] font-bold" style={{ color: "var(--re-dash-text)" }}>
                Admin user
              </p>
              <p className="text-[0.6875rem]" style={{ color: "var(--re-dash-muted)" }}>
                admin@{companyDomain}
              </p>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className={w("mb-3.5 grid gap-2.5 sm:gap-3.5", "grid-cols-4", "grid-cols-2 min-[900px]:grid-cols-4")}>
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-[14px] p-3.5 sm:p-5"
              style={{ background: "var(--re-dash-card)", border: "1px solid var(--re-dash-border)" }}
            >
              <div className="mb-5 flex items-start justify-between gap-2">
                <span
                  className="text-[0.75rem] font-medium leading-snug"
                  style={{ color: "var(--re-dash-muted)" }}
                >
                  {s.label}
                </span>
                <span className="text-[0.85rem]" aria-hidden="true">
                  {s.icon}
                </span>
              </div>
              <div
                className="re-mono text-[1.4rem] font-bold tracking-tight sm:text-[1.75rem]"
                style={{ color: "var(--re-dash-text)" }}
              >
                {s.value}
              </div>
              {s.sub && (
                <div className="mt-1.5 text-[0.7rem]" style={{ color: "var(--re-dash-muted)" }}>
                  {s.sub}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick stats */}
        <div
          className="mb-3.5 rounded-[14px] p-4 sm:p-5"
          style={{ background: "var(--re-dash-card)", border: "1px solid var(--re-dash-border)" }}
        >
          <p className="mb-4 text-[1rem] font-bold" style={{ color: "var(--re-dash-text)" }}>
            Today&rsquo;s quick stats
          </p>
          <div className={w("grid gap-2.5", "grid-cols-5", "grid-cols-2 sm:grid-cols-3 min-[900px]:grid-cols-5")}>
            {QUICK.map((q) => (
              <div
                key={q.label}
                className="rounded-xl px-2.5 py-4 text-center"
                style={{ background: "#FAF8F2" }}
              >
                <div className="mb-1.5 text-[1.1rem]" aria-hidden="true">
                  {q.emoji}
                </div>
                <div
                  className="re-mono text-[1.3rem] font-bold"
                  style={{ color: "var(--re-dash-text)" }}
                >
                  {q.num}
                </div>
                <div className="mt-0.5 text-[0.7rem]" style={{ color: "var(--re-dash-muted)" }}>
                  {q.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div
          className="rounded-[14px] p-4 sm:p-5"
          style={{ background: "var(--re-dash-card)", border: "1px solid var(--re-dash-border)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[1rem] font-bold" style={{ color: "var(--re-dash-text)" }}>
              Real-time activity
            </p>
            <span
              className="flex items-center gap-1.5 text-[0.78rem] font-semibold"
              style={{ color: "var(--re-dash-green)" }}
            >
              <span
                className="h-[7px] w-[7px] animate-pulse rounded-full"
                style={{ background: "var(--re-dash-green)" }}
              />
              Live
            </span>
          </div>

          {ACTIVITY.map((a) => (
            <div
              key={a.name}
              className="flex items-center gap-3.5 py-3"
              style={{ borderTop: "1px solid var(--re-dash-border)" }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.95rem]"
                style={{ background: "#FAF8F2" }}
                aria-hidden="true"
              >
                {a.icon}
              </span>
              <div className="min-w-0">
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-[0.05em]"
                  style={{ color: "var(--re-dash-muted)" }}
                >
                  {a.src}
                </p>
                <p
                  className="truncate text-[0.9rem] font-bold"
                  style={{ color: "var(--re-dash-text)" }}
                >
                  {a.name}
                </p>
              </div>
              <span
                className="ml-auto text-[0.78rem] font-semibold"
                style={{ color: a.badge === "Hot" ? "#E14B3F" : "#D99A2B" }}
              >
                {a.badge}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
  );
};

export default REDashboard;
