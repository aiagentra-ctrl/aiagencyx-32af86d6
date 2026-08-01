import { useState } from "react";
import { Maximize2, X } from "lucide-react";
import REDashboard from "./REDashboard";

export interface REDashboardShowcaseProps {
  companyName: string;
  logoUrl?: string;
  companyDomain: string;
}

const Frame = ({
  companyName,
  logoUrl,
  companyDomain,
  forceWide,
}: REDashboardShowcaseProps & { forceWide?: boolean }) => (
  <div
    className="overflow-hidden rounded-[1rem]"
    style={{ border: "1px solid var(--re-line-dark)", background: "var(--re-card-dark)" }}
  >
    <div
      className="flex items-center gap-1.5 px-3 py-2"
      style={{ borderBottom: "1px solid var(--re-line-dark)" }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#FF5F57" }} />
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#FEBC2E" }} />
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#28C840" }} />
      <span
        className="re-mono ml-3 truncate text-[0.68rem]"
        style={{ color: "var(--re-on-dark-3)" }}
      >
        app.aiagentra.com/{companyDomain}
      </span>
    </div>
    <REDashboard
      companyName={companyName}
      logoUrl={logoUrl}
      companyDomain={companyDomain}
      forceWide={forceWide}
    />
  </div>
);

/**
 * Desktop/laptop: the coded dashboard inside a wide browser frame, so it always
 * reads as a landscape rectangle instead of a tall stacked column.
 * Mobile: a compact, non-interactive scaled preview rectangle + "View Full
 * Dashboard" which opens it full-screen.
 */
const REDashboardShowcase = (props: REDashboardShowcaseProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop / laptop — wide landscape rectangle */}
      <div className="hidden min-[900px]:block">
        <Frame {...props} forceWide />
      </div>

      {/* Mobile — compact preview rectangle */}
      <div className="min-[900px]:hidden">
        <div
          className="relative h-[15rem] overflow-hidden rounded-[1rem]"
          style={{ border: "1px solid var(--re-line-dark)", background: "var(--re-card-dark)" }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 w-[1180px] origin-top-left"
            style={{ transform: "scale(0.29)" }}
          >
            <Frame {...props} forceWide />
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="re-btn re-btn-primary re-btn-md absolute bottom-3 left-1/2 min-h-[44px] -translate-x-1/2"
          >
            <Maximize2 className="h-4 w-4" />
            View Full Dashboard
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex flex-col"
          style={{ background: "rgba(5,7,10,0.96)" }}
          role="dialog"
          aria-label={`${props.companyName} dashboard preview`}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-[0.875rem] font-semibold" style={{ color: "var(--re-on-dark)" }}>
              {props.companyName} Dashboard
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close dashboard preview"
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: "var(--re-card-dark)", color: "var(--re-on-dark)" }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto px-3 pb-6">
            <div className="w-[1180px]">
              <Frame {...props} forceWide />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default REDashboardShowcase;
