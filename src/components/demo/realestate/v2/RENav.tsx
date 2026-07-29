import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { initialsOf } from "./personalize";

export interface RENavProps {
  companyName: string;
  logoUrl?: string;
  onTryDemo: () => void;
  onBookCall: () => void;
}

/**
 * Sticky page nav — "AI Agentra — for {CompanyName}" · Try Demo · Book a Call.
 * Brand blue on the mark only; the single CTA is orange, like every button here.
 */
const RENav = ({ companyName, logoUrl, onTryDemo, onBookCall }: RENavProps) => {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="sticky top-0 z-40 transition-colors duration-300"
      style={{
        background: solid ? "rgba(11,15,20,0.88)" : "transparent",
        backdropFilter: solid ? "blur(14px)" : undefined,
        WebkitBackdropFilter: solid ? "blur(14px)" : undefined,
        borderBottom: `1px solid ${solid ? "var(--re-line-dark)" : "transparent"}`,
      }}
    >
      <nav className="mx-auto flex max-w-[78rem] items-center justify-between gap-3 px-5 py-3 sm:px-6 lg:px-10 lg:py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${companyName} logo`}
              className="h-8 w-8 shrink-0 rounded-lg object-contain"
              style={{ background: "var(--re-card-dark)", border: "1px solid var(--re-line-dark)" }}
              width={32}
              height={32}
              loading="eager"
            />
          ) : (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[0.7rem] font-extrabold"
              style={{ background: "var(--re-brand)", color: "#fff" }}
            >
              {initialsOf(companyName)}
            </span>
          )}
          <span className="min-w-0 truncate text-[0.9375rem] font-bold tracking-tight">
            AI Agentra
            <span className="hidden font-medium sm:inline" style={{ color: "var(--re-on-dark-2)" }}>
              {" "}
              — for <span style={{ color: "var(--re-brand)" }}>{companyName}</span>
            </span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm min-h-[44px]"
            onClick={onTryDemo}
          >
            Try Demo
          </button>
          <button
            type="button"
            className="re-btn re-btn-primary re-btn-sm min-h-[44px]"
            onClick={onBookCall}
          >
            <CalendarCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Book a Call</span>
            <span className="sm:hidden">Book</span>

          </button>
        </div>
      </nav>
    </div>
  );
};

export default RENav;
