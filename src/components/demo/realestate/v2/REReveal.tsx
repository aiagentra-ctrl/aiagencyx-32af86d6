import { motion } from "framer-motion";
import REDashboard from "./REDashboard";

export interface RERevealProps {
  companyName: string;
  logoUrl?: string;
  companyDomain: string;
}

const ease = [0.16, 1, 0.3, 1] as const;

const POINTS = [
  { k: "Never misses", v: "Every call, chat and DM answered in seconds — 24/7." },
  { k: "Qualifies for you", v: "Budget, timeline and area captured before you pick up." },
  { k: "Books itself", v: "Viewings land straight on the calendar, no back-and-forth." },
];

const REReveal = ({ companyName, logoUrl, companyDomain }: RERevealProps) => (
  <section className="re-section-dark relative overflow-hidden px-5 py-16 sm:px-6 lg:px-10 lg:py-28">
    <div className="re-grid-texture pointer-events-none absolute inset-0" aria-hidden="true" />

    <div className="relative z-10 mx-auto max-w-[78rem]">
      <motion.div
        className="max-w-[42rem]"
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.75, ease }}
      >
        <span className="re-eyebrow">Behind the agent</span>
        <h2 className="re-h2 mt-4">
          The agent is one part. This is {companyName}
          &rsquo;s whole system.
        </h2>
        <p className="re-body re-muted-dark mt-4">
          Calls, email, WhatsApp, Instagram and lead scoring running in one place — with every
          conversation feeding the same brain.
        </p>
      </motion.div>

      <ul className="mt-8 grid gap-3 sm:grid-cols-3 lg:mt-10">
        {POINTS.map((p, i) => (
          <motion.li
            key={p.k}
            className="re-card p-5"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease, delay: i * 0.07 }}
          >
            <p className="text-[0.9375rem] font-bold" style={{ color: "var(--re-brand)" }}>
              {p.k}
            </p>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed re-muted-dark">{p.v}</p>
          </motion.li>
        ))}
      </ul>

      <motion.div
        className="mt-10 lg:mt-14"
        initial={{ opacity: 0, y: 34 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.85, ease }}
      >
        <REDashboard
          companyName={companyName}
          logoUrl={logoUrl}
          companyDomain={companyDomain}
        />
      </motion.div>
    </div>
  </section>
);

export default REReveal;
