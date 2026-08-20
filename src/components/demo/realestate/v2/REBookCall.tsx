import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { NICHE_PACKS, DEFAULT_PACK_ID, nicheCtx, type NichePack } from "@/components/demo/niche/packs";

export interface REBookCallProps {
  companyName: string;
  firstName?: string;
  pack?: NichePack;
  onBookCall: () => void;
}

const ease = [0.16, 1, 0.3, 1] as const;

const REBookCall = ({
  companyName,
  firstName,
  pack = NICHE_PACKS[DEFAULT_PACK_ID],
  onBookCall,
}: REBookCallProps) => {
  const ctx = nicheCtx(companyName, firstName);
  return (
  <section className="re-section-dark relative overflow-hidden px-5 py-11 sm:px-6 lg:px-10 lg:py-16">
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style={{
        backgroundImage:
          "radial-gradient(46rem 26rem at 50% 0%, rgba(249,115,22,0.12), transparent 65%)",
      }}
    />
    <motion.div
      className="relative z-10 mx-auto max-w-[46rem] text-center"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, ease }}
    >
      <span className="re-eyebrow">Next step</span>
      <h2 className="re-h2 mt-4" style={{ fontSize: "clamp(1.75rem, 4.2vw, 2rem)" }}>
        {pack.cta.headline(ctx)}
      </h2>
      <p className="re-body re-muted-dark mx-auto mt-4 max-w-[34rem]">
        {pack.cta.body(ctx)}
      </p>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          className="re-btn re-btn-primary re-btn-lg min-h-[48px] w-full sm:w-auto"
          onClick={onBookCall}
        >
          See It Running for {companyName}
          <ArrowRight className="h-[1.05rem] w-[1.05rem]" />
        </button>
      </div>

      <p
        className="mt-5 inline-flex items-center gap-2 text-[0.8125rem]"
        style={{ color: "var(--re-on-dark-3)" }}
      >
        <ShieldCheck className="h-4 w-4" style={{ color: "var(--re-brand)" }} />
        No contract, no setup fee — and no pitch if it isn&rsquo;t a fit.
      </p>
    </motion.div>
  </section>
  );
};

export default REBookCall;
