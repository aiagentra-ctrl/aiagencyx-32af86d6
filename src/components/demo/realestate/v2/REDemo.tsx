import { motion } from "framer-motion";
import { Phone, PhoneOff, MessageSquare, Sparkles } from "lucide-react";
import { possessive } from "./personalize";

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export interface REDemoProps {
  companyName: string;
  firstName?: string;
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
  firstName,
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
  const co = possessive(companyName);
  const vp = voicePrompts?.length ? voicePrompts : defaultVoice;
  const cp = chatPrompts?.length ? chatPrompts : defaultChat;

  return (
    <section
      id="demo-section"
      className="re-section-light scroll-mt-20 px-5 py-16 sm:px-6 lg:px-10 lg:py-24"
    >
      <div className="mx-auto max-w-[78rem]">
        <motion.div
          className="max-w-[40rem]"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.75, ease }}
        >
          <span className="re-eyebrow">Live demo</span>
          <h2 className="re-h2 mt-4">
            {firstName ? `${firstName}, this` : "This"} isn&rsquo;t a pitch. Talk to it yourself.
          </h2>
          <p className="re-body re-muted-light mt-4">
            This agent has already read {co} website. Ask it anything a real buyer would.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-5 lg:mt-14 lg:grid-cols-2 lg:gap-6">
          {/* Voice */}
          <motion.div
            className="re-card-light re-card-hover p-6 sm:p-8 lg:p-10"
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--re-brand-soft)" }}
              >
                <Phone className="h-[1.1rem] w-[1.1rem]" style={{ color: "var(--re-brand)" }} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[1.125rem] font-bold">Voice Agent</h3>
                <p className="text-[0.875rem]" style={{ color: "var(--re-on-light-2)" }}>
                  Answers the phone in one ring
                </p>
              </div>
              {isLive && (
                <span
                  className="re-mono ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-semibold tabular-nums"
                  style={{ background: "var(--re-cta-ring)", color: "#9A3412" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--re-cta)" }} />
                  {fmt(callSeconds)}
                </span>
              )}
            </div>

            <div className="mt-7">
              {isLive ? (
                <button
                  type="button"
                  className="re-btn re-btn-primary re-btn-lg min-h-[48px] w-full"
                  onClick={onEndCall}
                >
                  <PhoneOff className="h-[1.15rem] w-[1.15rem]" />
                  End Call
                </button>
              ) : (
                <button
                  type="button"
                  className="re-btn re-btn-primary re-btn-lg min-h-[48px] w-full"
                  onClick={onTryCall}
                  disabled={isCalling}
                >
                  <Phone className="h-[1.15rem] w-[1.15rem]" />
                  {isCalling ? "Connecting…" : `Hear ${co} Agent`}
                </button>
              )}
            </div>

            <p className="re-eyebrow mt-8">Try saying</p>
            <ul className="mt-3.5 space-y-2.5">
              {vp.slice(0, 4).map((p) => (
                <li
                  key={p}
                  className="rounded-xl px-4 py-3 text-[0.875rem]"
                  style={{ background: "#F3F4F6", color: "var(--re-on-light-2)" }}
                >
                  &ldquo;{p}&rdquo;
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Chat */}
          <motion.div
            className="re-card-light re-card-hover p-6 sm:p-8 lg:p-10"
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease, delay: 0.08 }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--re-brand-soft)" }}
              >
                <MessageSquare
                  className="h-[1.1rem] w-[1.1rem]"
                  style={{ color: "var(--re-brand)" }}
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-[1.125rem] font-bold">Chat Agent</h3>
                <p className="text-[0.875rem]" style={{ color: "var(--re-on-light-2)" }}>
                  Same brain, on your website
                </p>
              </div>
            </div>

            <div className="mt-7">
              <button
                type="button"
                className="re-btn re-btn-primary re-btn-lg min-h-[48px] w-full"
                onClick={onTryChat}
              >
                <Sparkles className="h-[1.15rem] w-[1.15rem]" />
                Try {co} Agent
              </button>
            </div>

            <p className="re-eyebrow mt-8">Try asking</p>
            <ul className="mt-3.5 space-y-2.5">
              {cp.slice(0, 4).map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={onTryChat}
                    className="min-h-[44px] w-full rounded-xl px-4 py-3 text-left text-[0.875rem] transition-colors hover:brightness-95"
                    style={{ background: "#F3F4F6", color: "var(--re-on-light-2)" }}
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
