import { motion } from "framer-motion";
import { Phone, PhoneOff, MessageSquare, Sparkles } from "lucide-react";

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export interface REDemoProps {
  companyName: string;
  callStatus: "idle" | "calling" | "connected" | "ended";
  callSeconds: number;
  onTryCall: () => void;
  onEndCall: () => void;
  onTryChat: () => void;
  voicePrompts?: string[];
  chatPrompts?: string[];
}

const ease = [0.16, 1, 0.3, 1] as const;

const defaultVoice = [
  "Do you have anything under $600k?",
  "Can I see the townhouse this weekend?",
  "What's the deposit on that listing?",
  "Are you open on Sunday?",
];

const defaultChat = [
  "Send me 3-bed listings",
  "What areas do you cover?",
  "Book me a viewing",
  "How much is my home worth?",
];

const REDemo = ({
  companyName,
  callStatus,
  callSeconds,
  onTryCall,
  onEndCall,
  onTryChat,
  voicePrompts,
  chatPrompts,
}: REDemoProps) => {
  const isLive = callStatus === "connected";
  const isCalling = callStatus === "calling";
  const vp = voicePrompts?.length ? voicePrompts : defaultVoice;
  const cp = chatPrompts?.length ? chatPrompts : defaultChat;

  return (
    <section
      id="demo-section"
      className="px-6 py-24 lg:px-10 lg:py-32"
      style={{ background: "hsl(var(--re-canvas-2))" }}
    >
      <div className="mx-auto max-w-[78rem]">
        <motion.div
          className="max-w-[38rem]"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease }}
        >
          <span className="re-eyebrow">Live demo</span>
          <h2 className="mt-5 text-[2.1rem] font-extrabold sm:text-[2.7rem]">
            Don&rsquo;t take our word for it. Talk to it.
          </h2>
          <p
            className="mt-5 text-[1.0625rem] leading-relaxed"
            style={{ color: "hsl(var(--re-ink-2))" }}
          >
            This agent has already read {companyName}&rsquo;s website. Ask it anything a real buyer
            would ask.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {/* Voice */}
          <motion.div
            className="re-card re-card-hover p-8 lg:p-10"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full"
                style={{ background: "var(--re-accent-soft)" }}
              >
                <Phone className="h-[1.1rem] w-[1.1rem]" style={{ color: "var(--re-accent)" }} />
              </div>
              <div>
                <h3 className="text-[1.05rem] font-bold">Voice Agent</h3>
                <p className="text-[0.8125rem]" style={{ color: "hsl(var(--re-ink-3))" }}>
                  Answers the phone in one ring
                </p>
              </div>
              {isLive && (
                <span
                  className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-semibold tabular-nums"
                  style={{ background: "var(--re-accent-soft)", color: "var(--re-accent)" }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--re-accent)" }}
                  />
                  {fmt(callSeconds)}
                </span>
              )}
            </div>

            <div className="mt-8">
              {isLive ? (
                <button className="re-btn re-btn-primary re-btn-lg w-full" onClick={onEndCall}>
                  <PhoneOff className="h-[1.15rem] w-[1.15rem]" />
                  End Call
                </button>
              ) : (
                <button
                  className="re-btn re-btn-primary re-btn-lg w-full"
                  onClick={onTryCall}
                  disabled={isCalling}
                >
                  <Phone className="h-[1.15rem] w-[1.15rem]" />
                  {isCalling
                    ? "Connecting…"
                    : callStatus === "ended"
                      ? "Call Again"
                      : "Talk to It Now"}
                </button>
              )}
            </div>

            <p className="re-eyebrow mt-9">Try saying</p>
            <ul className="mt-4 space-y-2.5">
              {vp.slice(0, 4).map((p) => (
                <li
                  key={p}
                  className="rounded-xl px-4 py-3 text-[0.875rem]"
                  style={{
                    background: "hsl(var(--re-canvas-2))",
                    color: "hsl(var(--re-ink-2))",
                  }}
                >
                  &ldquo;{p}&rdquo;
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Chat */}
          <motion.div
            className="re-card re-card-hover p-8 lg:p-10"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease, delay: 0.1 }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full"
                style={{ background: "hsl(var(--re-ink) / 0.06)" }}
              >
                <MessageSquare className="h-[1.1rem] w-[1.1rem]" />
              </div>
              <div>
                <h3 className="text-[1.05rem] font-bold">Chat Agent</h3>
                <p className="text-[0.8125rem]" style={{ color: "hsl(var(--re-ink-3))" }}>
                  Same brain, on your website
                </p>
              </div>
            </div>

            <div className="mt-8">
              <button className="re-btn re-btn-ghost re-btn-lg w-full" onClick={onTryChat}>
                <Sparkles className="h-[1.15rem] w-[1.15rem]" />
                Chat With It Now
              </button>
            </div>

            <p className="re-eyebrow mt-9">Try asking</p>
            <ul className="mt-4 space-y-2.5">
              {cp.slice(0, 4).map((p) => (
                <li key={p}>
                  <button
                    onClick={onTryChat}
                    className="w-full rounded-xl px-4 py-3 text-left text-[0.875rem] transition-colors"
                    style={{
                      background: "hsl(var(--re-canvas-2))",
                      color: "hsl(var(--re-ink-2))",
                    }}
                  >
                    {p}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default REDemo;