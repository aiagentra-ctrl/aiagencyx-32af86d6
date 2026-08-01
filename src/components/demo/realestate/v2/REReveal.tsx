import { motion } from "framer-motion";
import { ArrowRight, ArrowDown } from "lucide-react";
import REDashboardShowcase from "./REDashboardShowcase";

export interface RERevealProps {
  companyName: string;
  logoUrl?: string;
  companyDomain: string;
}

const ease = [0.16, 1, 0.3, 1] as const;

const FLOW = [
  { t: "Lead Source", d: "Forms, calls, ads" },
  { t: "AI Qualification", d: "Budget, intent, fit" },
  { t: "CRM Update", d: "Score and route" },
  { t: "Follow-up", d: "Email, WhatsApp, voice" },
  { t: "Calendar Booking", d: "Human handoff" },
  { t: "Dashboard", d: "Visibility and control" },
];

const REReveal = ({ companyName, logoUrl, companyDomain }: RERevealProps) => (
  <section className="re-section-dark relative overflow-hidden px-5 py-11 sm:px-6 lg:px-10 lg:py-16">
    <div className="re-grid-texture pointer-events-none absolute inset-0" aria-hidden="true" />

    <div className="relative z-10 mx-auto max-w-[78rem]">
      <motion.div
        className="max-w-[42rem]"
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease }}
      >
        <span className="re-eyebrow">Behind the agent</span>
        <h2 className="re-h2 mt-3">
          The agent is one part. This is {companyName}
          &rsquo;s whole system.
        </h2>
        <p className="re-body re-muted-dark mt-3">
          Calls, email, WhatsApp, Instagram and lead scoring running in one pipeline — every
          conversation feeding the same brain.
        </p>
      </motion.div>

      {/* Pipeline flow */}
      <motion.ol
        className="mt-7 flex flex-col gap-0 lg:mt-9 lg:flex-row lg:items-stretch"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease }}
      >
        {FLOW.map((s, i) => (
          <li key={s.t} className="flex flex-1 flex-col lg:flex-row lg:items-center">
            <div className="re-card flex flex-1 items-start gap-3 p-3.5">
              <span
                className="re-mono mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-white"
                style={{ background: "var(--re-brand)" }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[0.875rem] font-bold leading-tight">{s.t}</p>
                <p className="mt-1 text-[0.78rem] leading-snug re-muted-dark">{s.d}</p>
              </div>
            </div>

            {i < FLOW.length - 1 && (
              <>
                <span className="flex justify-center py-1.5 lg:hidden" aria-hidden="true">
                  <ArrowDown className="h-4 w-4" style={{ color: "var(--re-cta)" }} />
                </span>
                <span className="hidden shrink-0 px-1.5 lg:block" aria-hidden="true">
                  <ArrowRight className="h-4 w-4" style={{ color: "var(--re-cta)" }} />
                </span>
              </>
            )}
          </li>
        ))}
      </motion.ol>

      <motion.div
        className="mt-8 lg:mt-10"
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.75, ease }}
      >
        <REDashboardShowcase
          companyName={companyName}
          logoUrl={logoUrl}
          companyDomain={companyDomain}
        />
      </motion.div>
    </div>
  </section>
);

export default REReveal;
