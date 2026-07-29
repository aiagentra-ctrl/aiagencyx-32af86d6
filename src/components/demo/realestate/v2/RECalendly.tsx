import { useEffect, useRef, useState } from "react";

export interface RECalendlyProps {
  companyName: string;
  calendarUrl: string;
}

/**
 * Inline Calendly embed — every "Book a Call" scrolls here instead of opening a
 * new tab. The iframe is only mounted once the section is near the viewport so
 * it never costs anything on first paint.
 */
const RECalendly = ({ companyName, calendarUrl }: RECalendlyProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "500px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visible]);

  const src = `${calendarUrl}${calendarUrl.includes("?") ? "&" : "?"}hide_gdpr_banner=1&background_color=0B0F14&text_color=F5F5F5&primary_color=F97316`;

  return (
    <section
      id="book-call"
      ref={ref}
      className="re-section-dark scroll-mt-16 px-5 pb-16 sm:px-6 lg:px-10 lg:pb-24"
    >
      <div className="mx-auto max-w-[62rem]">
        <div
          className="overflow-hidden rounded-[1.25rem]"
          style={{ background: "var(--re-card-dark)", border: "1px solid var(--re-line-dark)" }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5"
            style={{ borderBottom: "1px solid var(--re-line-dark)" }}
          >
            <p className="text-[0.9375rem] font-bold">Pick a time with the {companyName} team</p>
            <span className="re-mono text-[0.75rem]" style={{ color: "var(--re-on-dark-3)" }}>
              20 min · video call
            </span>
          </div>

          {visible ? (
            <iframe
              src={src}
              title={`Book a call about ${companyName}`}
              loading="lazy"
              className="h-[42rem] w-full border-0 sm:h-[46rem]"
            />
          ) : (
            <div className="h-[42rem] w-full sm:h-[46rem]" aria-hidden="true" />
          )}
        </div>
      </div>
    </section>
  );
};

export default RECalendly;
