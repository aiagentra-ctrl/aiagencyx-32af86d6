import { motion } from "framer-motion";
import { Check } from "lucide-react";

export interface REProofProps {
  companyName: string;
  videoId?: string;
}

const ease = [0.16, 1, 0.3, 1] as const;

const OUTCOMES = [
  "Enquiries answered in under 5 seconds, any hour",
  "Viewings booked while the team is out on site",
  "Every lead scored and followed up automatically",
];

const REProof = ({ companyName, videoId }: REProofProps) => (
  <section className="re-section-light px-5 py-16 sm:px-6 lg:px-10 lg:py-24">
    <div className="mx-auto max-w-[78rem]">
      <motion.div
        className="max-w-[42rem]"
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.75, ease }}
      >
        <span className="re-eyebrow">Proof</span>
        <h2 className="re-h2 mt-4">Real estate teams like {companyName} are already running this.</h2>
        <p className="re-body re-muted-light mt-4">
          Same setup, same agent, live on their phones and their websites right now.
        </p>
      </motion.div>

      <div className="mt-9 grid gap-6 lg:mt-12 lg:grid-cols-[1.35fr_0.65fr] lg:gap-10">
        <motion.div
          className="overflow-hidden rounded-[1.25rem]"
          style={{ border: "1px solid var(--re-line-light)", boxShadow: "var(--re-shadow-md)" }}
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease }}
        >
          {videoId ? (
            <div className="relative aspect-video w-full bg-black">
              <iframe
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                title="Client proof video"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div
              className="flex aspect-video w-full items-center justify-center p-8 text-center"
              style={{ background: "var(--re-light-2)" }}
            >
              <p className="re-body re-muted-light max-w-sm">
                A walkthrough of the exact system running for a real estate team.
              </p>
            </div>
          )}
        </motion.div>

        <motion.ul
          className="space-y-3"
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease, delay: 0.08 }}
        >
          {OUTCOMES.map((o) => (
            <li key={o} className="re-card-light flex items-start gap-3 p-5">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--re-brand-soft)" }}
              >
                <Check className="h-3 w-3" style={{ color: "var(--re-brand)" }} />
              </span>
              <span className="text-[0.9375rem] leading-relaxed" style={{ color: "var(--re-on-light-2)" }}>
                {o}
              </span>
            </li>
          ))}
        </motion.ul>
      </div>
    </div>
  </section>
);

export default REProof;
