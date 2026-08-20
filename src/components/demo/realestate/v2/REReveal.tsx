import { motion } from "framer-motion";
import REDashboardShowcase from "./REDashboardShowcase";
import { NICHE_PACKS, DEFAULT_PACK_ID, nicheCtx, type NichePack } from "@/components/demo/niche/packs";

export interface RERevealProps {
  companyName: string;
  firstName?: string;
  logoUrl?: string;
  companyDomain: string;
  pack?: NichePack;
}

const ease = [0.16, 1, 0.3, 1] as const;

const REReveal = ({
  companyName,
  firstName,
  logoUrl,
  companyDomain,
  pack = NICHE_PACKS[DEFAULT_PACK_ID],
}: RERevealProps) => {
  const ctx = nicheCtx(companyName, firstName);
  const r = pack.reveal;

  return (
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
          <h2 className="re-h2 mt-3">{r.headline(ctx)}</h2>
          <p className="re-body re-muted-dark mt-3">{r.sub(ctx)}</p>
        </motion.div>

        {/* 8-step pipeline — rectangular card grid on every screen size:
            2x4 on mobile, 4x2 on desktop. Never a long vertical chain. */}
        <motion.ol
          className="mt-7 grid grid-cols-2 gap-2.5 sm:gap-3 lg:mt-9 lg:grid-cols-4"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease }}
        >
          {r.steps.map((s) => (
            <li
              key={s.title}
              className="re-card flex min-h-[6.25rem] flex-col rounded-xl p-3.5 sm:min-h-[6.75rem] sm:p-4"
            >
              <span
                className="re-mono text-[0.65rem] font-bold tracking-[0.06em]"
                style={{ color: "var(--re-cta)" }}
              >
                {String(s.n).padStart(2, "0")}
              </span>
              <p className="mt-1.5 text-[0.9rem] font-bold leading-tight sm:text-[0.95rem]">
                {s.title}
              </p>
              <p className="re-muted-dark mt-1 text-[0.75rem] leading-snug sm:text-[0.78rem]">
                {s.desc}
              </p>
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
            pack={pack}
          />
        </motion.div>
      </div>
    </section>
  );
};

export default REReveal;
