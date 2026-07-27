import { motion } from "framer-motion";
import { Filter, CalendarCheck, LayoutDashboard } from "lucide-react";
import dashboardImg from "@/assets/re-dashboard.jpg";

export interface RERevealProps {
  companyName: string;
}

const ease = [0.16, 1, 0.3, 1] as const;

const flow = [
  {
    icon: Filter,
    label: "Qualify",
    title: "It separates buyers from browsers",
    body: "Budget, timeline, financing, area — asked naturally, captured every time, before the lead ever reaches a human.",
  },
  {
    icon: CalendarCheck,
    label: "Book",
    title: "It puts viewings on the calendar",
    body: "Qualified enquiries get an appointment while they're still interested, with confirmation and reminders handled automatically.",
  },
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    title: "You watch it all from one screen",
    body: "Every call, chat and booked viewing lands in a live command centre with lead scoring and hot-lead alerts.",
  },
];

const REReveal = ({ companyName }: RERevealProps) => (
  <section className="relative overflow-hidden px-6 py-24 lg:px-10 lg:py-36">
    <div className="pointer-events-none absolute inset-0 re-grid-texture" aria-hidden="true" />

    <div className="relative mx-auto max-w-[78rem]">
      <motion.div
        className="mx-auto max-w-[42rem] text-center"
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.85, ease }}
      >
        <span className="re-eyebrow">The reveal</span>
        <h2 className="mt-5 text-[2.25rem] font-extrabold sm:text-[3rem]">
          We didn&rsquo;t just build you a chatbot.
        </h2>
        <p
          className="mx-auto mt-6 max-w-[34rem] text-[1.0625rem] leading-relaxed"
          style={{ color: "hsl(var(--re-ink-2))" }}
        >
          Underneath the conversation sits a full lead engine for {companyName} — qualifying,
          booking and reporting, around the clock.
        </p>
      </motion.div>

      <motion.figure
        className="mx-auto mt-16 max-w-[62rem]"
        initial={{ opacity: 0, y: 56, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.05, ease }}
      >
        <div
          className="overflow-hidden rounded-[1.75rem] p-2"
          style={{
            background: "hsl(var(--re-surface))",
            border: "1px solid hsl(var(--re-line))",
            boxShadow: "var(--re-shadow-lg)",
          }}
        >
          <img
            src={dashboardImg}
            alt={`AI lead dashboard showing captured leads, booked viewings and live activity for ${companyName}`}
            className="w-full rounded-[1.35rem]"
            loading="lazy"
          />
        </div>
      </motion.figure>

      <div className="mt-20 grid gap-10 md:grid-cols-3 md:gap-8">
        {flow.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease, delay: i * 0.12 }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: "var(--re-accent-soft)" }}
              >
                <f.icon className="h-[1.05rem] w-[1.05rem]" style={{ color: "var(--re-accent)" }} />
              </div>
              <span className="re-eyebrow">
                {String(i + 1).padStart(2, "0")} — {f.label}
              </span>
            </div>
            <h3 className="mt-5 text-[1.2rem] font-bold leading-snug">{f.title}</h3>
            <p
              className="mt-3 text-[0.95rem] leading-relaxed"
              style={{ color: "hsl(var(--re-ink-2))" }}
            >
              {f.body}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default REReveal;