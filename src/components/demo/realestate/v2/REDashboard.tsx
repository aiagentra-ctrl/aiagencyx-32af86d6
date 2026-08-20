import { initialsOf } from "./personalize";
import { NICHE_PACKS, DEFAULT_PACK_ID, type NichePack } from "@/components/demo/niche/packs";

export interface REDashboardProps {
  companyName: string;
  logoUrl?: string;
  companyDomain: string;
  pack?: NichePack;
  /** Force the full desktop layout regardless of viewport (used by the mobile preview/expand). */
  forceWide?: boolean;
}

const CHANNELS = [
  { icon: "✉", label: "Email" },
  { icon: "📞", label: "Calling" },
  { icon: "💬", label: "SMS / WhatsApp" },
];

const toneColor = (t?: "green" | "amber" | "red") =>
  t === "green"
    ? "var(--re-dash-green)"
    : t === "amber"
      ? "#D99A2B"
      : t === "red"
        ? "#E14B3F"
        : "var(--re-dash-text)";

/**
 * Coded growth dashboard — personalised per prospect ({{CompanyName}}, {{Logo}},
 * {{CompanyDomain}}) and per niche (stat labels, agents, pipeline, activity).
 * Numbers stay illustrative across all clients.
 */
const REDashboard = ({
  companyName,
  logoUrl,
  companyDomain,
  pack = NICHE_PACKS[DEFAULT_PACK_ID],
  forceWide,
}: REDashboardProps) => {
  const w = (base: string, wide: string, responsive: string) =>
    `${base} ${forceWide ? wide : responsive}`;
  const d = pack.dashboard;

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
        <span style={{ color: "var(--re-dash-green)" }}>● Live</span>
        <span className="truncate">{companyName} — Growth Dashboard</span>
      </div>

      <div className={w("grid min-h-[26rem]", "grid-cols-[15.5rem_1fr]", "grid-cols-1 min-[900px]:grid-cols-[15.5rem_1fr]")}>
        {/* Sidebar */}
        <aside
          className={w("flex-col p-5", "flex", "hidden min-[900px]:flex")}
          style={{ borderRight: "1px solid var(--re-dash-border)" }}
        >
          <div className="mb-7 flex items-center gap-2.5 px-1">
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
                style={{ background: "var(--re-cta)" }}
              >
                {initialsOf(companyName)}
              </span>
            )}
            <span
              className="truncate text-[1rem] font-extrabold tracking-tight"
              style={{ color: "var(--re-dash-text)" }}
            >
              {companyName}
            </span>
          </div>

          <p
            className="mb-1.5 px-2 text-[0.625rem] font-bold uppercase tracking-[0.06em]"
            style={{ color: "var(--re-dash-muted)" }}
          >
            Overview
          </p>
          <div
            className="mb-3 flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[0.84rem] font-bold"
            style={{ background: "#EFECE3", color: "var(--re-dash-text)" }}
          >
            <span className="w-[18px] text-center" aria-hidden="true">▣</span>
            Dashboard
          </div>

          <p
            className="mb-1.5 px-2 text-[0.625rem] font-bold uppercase tracking-[0.06em]"
            style={{ color: "var(--re-dash-muted)" }}
          >
            AI Agents
          </p>
          <ul className="mb-3 space-y-px">
            {d.agentNav.map((n) => (
              <li
                key={n.label}
                className="flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[0.84rem] font-medium"
                style={{ color: "#6B6A63" }}
              >
                <span className="w-[18px] text-center text-[0.85rem]" aria-hidden="true">{n.icon}</span>
                {n.label}
              </li>
            ))}
          </ul>

          <p
            className="mb-1.5 px-2 text-[0.625rem] font-bold uppercase tracking-[0.06em]"
            style={{ color: "var(--re-dash-muted)" }}
          >
            Channels
          </p>
          <ul className="space-y-px">
            {CHANNELS.map((n) => (
              <li
                key={n.label}
                className="flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[0.84rem] font-medium"
                style={{ color: "#6B6A63" }}
              >
                <span className="w-[18px] text-center text-[0.85rem]" aria-hidden="true">{n.icon}</span>
                {n.label}
              </li>
            ))}
          </ul>
        </aside>

        {/* Main */}
        <div className="p-4 sm:p-6 lg:p-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3
              className="text-[1.25rem] font-extrabold tracking-tight sm:text-[1.5rem]"
              style={{ color: "var(--re-dash-text)" }}
            >
              {d.title}
            </h3>
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.75rem] text-white"
                style={{ background: "#12151A" }}
              >
                A
              </span>
              <div className={forceWide ? "block" : "hidden sm:block"}>
                <p className="text-[0.78rem] font-bold" style={{ color: "var(--re-dash-text)" }}>
                  Admin
                </p>
                <p className="text-[0.66rem]" style={{ color: "var(--re-dash-muted)" }}>
                  admin@{companyDomain}
                </p>
              </div>
            </div>
          </div>

          {/* Stat groups */}
          {d.groups.map((g) => (
            <div key={g.label}>
              <p
                className="mb-2.5 mt-4 flex items-center gap-2 text-[0.78rem] font-extrabold first:mt-0"
                style={{ color: "var(--re-dash-text)" }}
              >
                {g.label}
                {g.live && (
                  <span
                    className="rounded-[10px] px-2 py-0.5 text-[0.62rem] font-bold text-white"
                    style={{ background: "var(--re-cta)" }}
                  >
                    Live
                  </span>
                )}
              </p>
              <div className={w("grid gap-2.5", "grid-cols-4", "grid-cols-2 min-[900px]:grid-cols-4")}>
                {g.stats.map((s) => (
                  <div
                    key={`${g.label}-${s.label}`}
                    className="rounded-[12px] p-3 sm:p-4"
                    style={{ background: "var(--re-dash-card)", border: "1px solid var(--re-dash-border)" }}
                  >
                    <div className="mb-3.5 flex items-start justify-between gap-2">
                      <span
                        className="text-[0.7rem] font-medium leading-snug"
                        style={{ color: "var(--re-dash-muted)" }}
                      >
                        {s.label}
                      </span>
                      <span
                        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-[0.72rem]"
                        style={{ background: s.tone === "green" ? "#E9F9F1" : "#F0EEE7" }}
                        aria-hidden="true"
                      >
                        {s.icon}
                      </span>
                    </div>
                    <div
                      className="re-mono text-[1.15rem] font-bold tracking-tight sm:text-[1.3rem]"
                      style={{ color: toneColor(s.tone) }}
                    >
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Pipeline flow strip */}
          <p
            className="mb-2.5 mt-4 text-[0.78rem] font-extrabold"
            style={{ color: "var(--re-dash-text)" }}
          >
            Pipeline
          </p>
          <div
            className={w(
              "grid gap-px overflow-hidden rounded-[12px]",
              "grid-cols-4",
              "grid-cols-2 min-[900px]:grid-cols-4",
            )}
            style={{ background: "var(--re-dash-border)", border: "1px solid var(--re-dash-border)" }}
          >
            {d.flow.map((f) => (
              <div key={f.step} className="p-3" style={{ background: "var(--re-dash-card)" }}>
                <p
                  className="re-mono text-[0.6rem] font-extrabold tracking-[0.04em]"
                  style={{ color: "var(--re-brand)" }}
                >
                  {f.step}
                </p>
                <p
                  className="mb-1.5 mt-1 text-[0.8rem] font-extrabold"
                  style={{ color: "var(--re-dash-text)" }}
                >
                  {f.title}
                </p>
                <ul className="space-y-0.5">
                  {f.points.map((p) => (
                    <li
                      key={p}
                      className="relative pl-3 text-[0.66rem] leading-snug"
                      style={{ color: "var(--re-dash-muted)" }}
                    >
                      <span
                        className="absolute left-0"
                        style={{ color: "var(--re-brand)" }}
                        aria-hidden="true"
                      >
                        —
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Activity */}
          <div
            className="mt-4 rounded-[12px] p-4"
            style={{ background: "var(--re-dash-card)", border: "1px solid var(--re-dash-border)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[0.85rem] font-bold" style={{ color: "var(--re-dash-text)" }}>
                Real-time activity
              </p>
              <span
                className="flex items-center gap-1.5 text-[0.72rem] font-bold"
                style={{ color: "var(--re-dash-green)" }}
              >
                <span
                  className="h-[7px] w-[7px] animate-pulse rounded-full"
                  style={{ background: "var(--re-dash-green)" }}
                />
                Live
              </span>
            </div>

            {d.activity.map((a, i) => (
              <div
                key={a.text}
                className="flex items-center gap-3 py-2.5"
                style={{ borderTop: i === 0 ? "none" : "1px solid var(--re-dash-border)" }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.8rem]"
                  style={{ background: "#F0EEE7" }}
                  aria-hidden="true"
                >
                  {a.icon}
                </span>
                <div className="min-w-0">
                  <p
                    className="text-[0.6rem] font-bold uppercase tracking-[0.05em]"
                    style={{ color: "var(--re-dash-muted)" }}
                  >
                    {a.src}
                  </p>
                  <p
                    className="truncate text-[0.82rem] font-bold"
                    style={{ color: "var(--re-dash-text)" }}
                  >
                    {a.text}
                  </p>
                </div>
                <span
                  className="ml-auto shrink-0 text-[0.72rem] font-bold"
                  style={{ color: toneColor(a.tone) }}
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
