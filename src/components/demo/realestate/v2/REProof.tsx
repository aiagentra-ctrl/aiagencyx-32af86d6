import { motion } from "framer-motion";
import { Check, Star, ExternalLink } from "lucide-react";
import { NICHE_PACKS, DEFAULT_PACK_ID, nicheCtx, type NichePack } from "@/components/demo/niche/packs";

export interface REProofProps {
  companyName: string;
  firstName?: string;
  pack?: NichePack;
  videoId?: string;
}

const ease = [0.16, 1, 0.3, 1] as const;

const DEFAULT_VIDEO_ID = "eOAyie0kWGQ";

const CLIENTS = [
  { name: "Greenfield Real Estate", system: "Flowly System" },
  { name: "The Captain Network", system: "Growth System" },
  { name: "New Eden", system: "Booking Automation" },
  { name: "Sanara", system: "AI Sales Infrastructure", rating: 5 },
];

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const REProof = ({
  companyName,
  firstName,
  pack = NICHE_PACKS[DEFAULT_PACK_ID],
  videoId,
}: REProofProps) => {
  const vid = videoId || DEFAULT_VIDEO_ID;
  const ctx = nicheCtx(companyName, firstName);
  const OUTCOMES = pack.proof.outcomes;

  return (
    <section className="re-section-light px-5 py-11 sm:px-6 lg:px-10 lg:py-16">
      <div className="mx-auto max-w-[78rem]">
        <motion.div
          className="max-w-[42rem]"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease }}
        >
          <span className="re-eyebrow">Proof</span>
          <h2 className="re-h2 mt-3">{pack.proof.headline(ctx)}</h2>
          <p className="re-body re-muted-light mt-3">{pack.proof.sub}</p>
        </motion.div>

        <div className="mt-6 grid gap-5 lg:mt-8 lg:grid-cols-[1.35fr_0.65fr] lg:gap-7">
          <motion.div
            className="overflow-hidden rounded-[1.25rem]"
            style={{ border: "1px solid var(--re-line-light)", boxShadow: "var(--re-shadow-md)" }}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease }}
          >
            <div className="relative aspect-video w-full bg-black">
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1`}
                title="Client walkthrough — AI Agentra"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          </motion.div>

          <motion.ul
            className="space-y-2.5"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease, delay: 0.08 }}
          >
            {OUTCOMES.map((o) => (
              <li key={o} className="re-card-light flex items-start gap-3 p-4">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "var(--re-brand-soft)" }}
                >
                  <Check className="h-3 w-3" style={{ color: "var(--re-brand)" }} />
                </span>
                <span
                  className="text-[0.9375rem] leading-relaxed"
                  style={{ color: "var(--re-on-light-2)" }}
                >
                  {o}
                </span>
              </li>
            ))}
          </motion.ul>
        </div>

        {/* Client showcase */}
        <motion.div
          className="mt-7 lg:mt-9"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="re-eyebrow">Trusted by teams like these</p>
            <a
              href="https://www.aiagentra.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold"
              style={{ color: "var(--re-cta)" }}
            >
              See the full portfolio on aiagentra.com
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <ul className="mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {CLIENTS.map((c) => (
              <li key={c.name} className="re-card-light flex items-center gap-3 p-3.5">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[0.75rem] font-extrabold text-white"
                  style={{ background: "var(--re-brand)" }}
                  aria-hidden="true"
                >
                  {initials(c.name)}
                </span>
                <div className="min-w-0">
                  <p
                    className="truncate text-[0.875rem] font-bold"
                    style={{ color: "var(--re-on-light)" }}
                  >
                    {c.name}
                  </p>
                  <p
                    className="flex items-center gap-1 truncate text-[0.78rem]"
                    style={{ color: "var(--re-on-light-2)" }}
                  >
                    {c.system}
                    {c.rating && (
                      <span
                        className="inline-flex items-center gap-0.5"
                        aria-label={`${c.rating} star review`}
                      >
                        <Star className="h-3 w-3 fill-current" style={{ color: "var(--re-cta)" }} />
                        <span className="re-mono">{c.rating}.0</span>
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
};

export default REProof;
