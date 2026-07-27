import { motion } from "framer-motion";
import { CalendarCheck, ArrowUpRight } from "lucide-react";

export interface REBookCallProps {
  companyName: string;
  firstName?: string;
  onBookCall: () => void;
}

const ease = [0.16, 1, 0.3, 1] as const;

const REBookCall = ({ companyName, firstName, onBookCall }: REBookCallProps) => (
  <section className="relative overflow-hidden re-atmosphere px-6 py-28 lg:px-10 lg:py-40">
    <div className="relative mx-auto max-w-[46rem] text-center">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.85, ease }}
      >
        <span className="re-eyebrow">Next step</span>
        <h2 className="mt-5 text-[2.3rem] font-extrabold sm:text-[3.1rem]">
          {firstName ? `${firstName}, let's ` : "Let's "}switch it on for {companyName}.
        </h2>
        <p
          className="mx-auto mt-6 max-w-[32rem] text-[1.0625rem] leading-relaxed"
          style={{ color: "hsl(var(--re-ink-2))" }}
        >
          Ten minutes is all it takes. We&rsquo;ll walk through your enquiry flow, plug the agent
          into your calendar, and you&rsquo;re live within 24 hours.
        </p>

        <div className="mt-10 flex justify-center">
          <button className="re-btn re-btn-primary re-btn-lg" onClick={onBookCall}>
            <CalendarCheck className="h-[1.15rem] w-[1.15rem]" />
            Book Your 10-Minute Call
            <ArrowUpRight className="h-[1.05rem] w-[1.05rem]" />
          </button>
        </div>

        <p className="mt-6 text-[0.8125rem]" style={{ color: "hsl(var(--re-ink-3))" }}>
          No contracts · Free setup · Cancel any time
        </p>
      </motion.div>
    </div>
  </section>
);

export default REBookCall;