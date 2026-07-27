import { useState } from "react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";

export interface REProofProps {
  videoId?: string;
}

const ease = [0.16, 1, 0.3, 1] as const;

const REProof = ({ videoId = "eOAyie0kWGQ" }: REProofProps) => {
  const [playing, setPlaying] = useState(false);

  return (
    <section
      className="px-6 py-24 lg:px-10 lg:py-32"
      style={{ background: "hsl(var(--re-ink))" }}
    >
      <div className="mx-auto max-w-[62rem]">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease }}
        >
          <span className="re-eyebrow" style={{ color: "hsl(0 0% 100% / 0.45)" }}>
            Client proof
          </span>
          <h2
            className="mt-5 text-[2.1rem] font-extrabold sm:text-[2.75rem]"
            style={{ color: "hsl(0 0% 100%)" }}
          >
            Hear it from someone already running it.
          </h2>
        </motion.div>

        <motion.div
          className="relative mt-14 overflow-hidden rounded-[1.5rem]"
          style={{
            aspectRatio: "16 / 9",
            background: "hsl(0 0% 100% / 0.06)",
            border: "1px solid hsl(0 0% 100% / 0.10)",
          }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.95, ease }}
        >
          {playing ? (
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
              title="Client testimonial"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <button
              onClick={() => setPlaying(true)}
              aria-label="Play client testimonial"
              className="group absolute inset-0 h-full w-full"
            >
              <img
                src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
                alt="Client testimonial video thumbnail"
                className="h-full w-full object-cover opacity-80 transition-opacity duration-500 group-hover:opacity-95"
                loading="lazy"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span
                  className="flex h-20 w-20 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: "var(--re-accent)",
                    color: "var(--re-accent-fg)",
                    boxShadow: "0 20px 50px -12px var(--re-accent-ring)",
                  }}
                >
                  <Play className="ml-1 h-7 w-7 fill-current" />
                </span>
              </span>
            </button>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default REProof;